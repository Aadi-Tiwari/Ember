"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const API_URL          = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SAMPLE_MS        = 80;
const SEND_INTERVAL_MS = 6_000;
const WINDOW_SAMPLES   = Math.floor(30_000 / SAMPLE_MS); // 30-second rolling window
const SPEAKING_THRESH  = 0.015;
const PITCH_HISTORY    = 60; // keep last 60 F0 values for jitter / variation

export type VoiceData = {
  energy:            number;  // 0-1 RMS amplitude
  cadence:           number;  // 0-1 fraction of time speaking
  pitch_hz:          number;  // fundamental frequency in Hz (-1 = undetected)
  pitch_variation:   number;  // 0-1 normalised pitch std-dev (expressiveness)
  jitter:            number;  // 0-1 cycle-to-cycle pitch instability (stress proxy)
  spectral_centroid: number;  // 0-1 normalised brightness (stress proxy)
  is_speaking:       boolean;
};

// Autocorrelation pitch detection (cwilso / PitchDetect pattern)
function detectPitch(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  const HALF = Math.floor(SIZE / 2);

  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.008) return -1;

  // Trim leading/trailing silence
  let r1 = 0, r2 = SIZE - 1;
  const THRESH = 0.2;
  for (let i = 0; i < HALF; i++) { if (Math.abs(buf[i]) < THRESH) { r1 = i; break; } }
  for (let i = 1; i < HALF; i++) { if (Math.abs(buf[SIZE - i]) < THRESH) { r2 = SIZE - i; break; } }

  const trimmed = buf.slice(r1, r2 + 1);
  const tLen    = trimmed.length;
  if (tLen < 2) return -1;

  // Autocorrelation
  const corr = new Float32Array(HALF);
  for (let lag = 0; lag < HALF; lag++) {
    let s = 0;
    for (let j = 0; j < HALF; j++) s += (trimmed[j] ?? 0) * (trimmed[j + lag] ?? 0);
    corr[lag] = s;
  }

  // Find first local minimum then scan for max
  let d = 0;
  while (d < corr.length - 1 && corr[d] > corr[d + 1]) d++;

  let maxVal = -1, maxPos = -1;
  for (let i = d; i < HALF; i++) {
    if (corr[i] > maxVal) { maxVal = corr[i]; maxPos = i; }
  }
  if (maxPos < 2 || maxPos >= HALF - 1) return -1;

  // Parabolic interpolation for sub-sample accuracy
  const x1 = corr[maxPos - 1], x2 = corr[maxPos], x3 = corr[maxPos + 1];
  const a  = (x1 + x3 - 2 * x2) / 2;
  const b  = (x3 - x1) / 2;
  const T0 = a ? maxPos - b / (2 * a) : maxPos;

  const hz = sampleRate / T0;
  // Plausible voice range 70 Hz (bass) - 1050 Hz (head voice)
  return hz >= 70 && hz <= 1050 ? hz : -1;
}

// Spectral centroid from frequency-domain data (normalised 0-1)
function spectralCentroid(freqData: Uint8Array, sampleRate: number): number {
  const N   = freqData.length;
  const BIN = sampleRate / (N * 2);
  let wSum = 0, sum = 0;
  for (let i = 0; i < N; i++) {
    const mag  = freqData[i] / 255;
    const freq = i * BIN;
    wSum += freq * mag;
    sum  += mag;
  }
  if (sum < 0.01) return 0;
  // Normalise: typical voice centroid 300-3000 Hz → map to 0-1
  return Math.min(1, (wSum / sum) / 3000);
}

export function useVoiceAnalyzer(active: boolean): VoiceData | null {
  const [data, setData] = useState<VoiceData | null>(null);

  const ctxRef      = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const samplerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const senderRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rolling buffers
  const rmsBuffer  = useRef<number[]>([]);
  const pitchBuf   = useRef<number[]>([]);   // recent F0 values (speaking frames only)

  const compute = useCallback((): VoiceData => {
    const rms    = rmsBuffer.current;
    const pitches = pitchBuf.current;

    if (!rms.length) {
      return { energy: 0, cadence: 0, pitch_hz: -1, pitch_variation: 0, jitter: 0, spectral_centroid: 0, is_speaking: false };
    }

    const energy      = rms.reduce((s, v) => s + v, 0) / rms.length;
    const cadence     = rms.filter(v => v > SPEAKING_THRESH).length / rms.length;
    const is_speaking = (rms[rms.length - 1] ?? 0) > SPEAKING_THRESH;

    // Pitch stats
    const validPitches = pitches.filter(p => p > 0);
    const pitch_hz     = validPitches.length ? validPitches[validPitches.length - 1] : -1;

    let pitch_variation = 0;
    let jitter          = 0;

    if (validPitches.length >= 4) {
      const mean = validPitches.reduce((s, v) => s + v, 0) / validPitches.length;
      const std  = Math.sqrt(validPitches.reduce((s, v) => s + (v - mean) ** 2, 0) / validPitches.length);
      pitch_variation = Math.min(1, std / 80); // 80 Hz std = max expressiveness

      // Jitter: period-to-period instability (convert F0 to periods first)
      const periods = validPitches.map(f => 1 / f);
      const pMean   = periods.reduce((s, v) => s + v, 0) / periods.length;
      if (pMean > 0) {
        const pStd = Math.sqrt(periods.reduce((s, v) => s + (v - pMean) ** 2, 0) / periods.length);
        jitter = Math.min(1, (pStd / pMean) * 20); // scale: 5% jitter = 1.0
      }
    }

    return {
      energy:            +energy.toFixed(4),
      cadence:           +cadence.toFixed(4),
      pitch_hz:          pitch_hz > 0 ? +pitch_hz.toFixed(1) : -1,
      pitch_variation:   +pitch_variation.toFixed(4),
      jitter:            +jitter.toFixed(4),
      spectral_centroid: 0, // filled below from latest freq data
      is_speaking,
    };
  }, []);

  const sendToBackend = useCallback((d: VoiceData) => {
    fetch(`${API_URL}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "voice", timestamp: new Date().toISOString(), ...d }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!active) {
      if (samplerRef.current) clearInterval(samplerRef.current);
      if (senderRef.current)  clearInterval(senderRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null; analyserRef.current = null; streamRef.current = null;
      rmsBuffer.current = []; pitchBuf.current = [];
      setData(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;
        ctx.createMediaStreamSource(stream).connect(analyser);

        const timeBuf = new Float32Array(analyser.fftSize);
        const freqBuf = new Uint8Array(analyser.frequencyBinCount);

        samplerRef.current = setInterval(() => {
          const a = analyserRef.current;
          if (!a) return;

          a.getFloatTimeDomainData(timeBuf);
          a.getByteFrequencyData(freqBuf);

          // RMS energy
          let sq = 0;
          for (let i = 0; i < timeBuf.length; i++) sq += timeBuf[i] * timeBuf[i];
          const rms = Math.sqrt(sq / timeBuf.length);
          rmsBuffer.current.push(rms);
          if (rmsBuffer.current.length > WINDOW_SAMPLES) rmsBuffer.current.shift();

          // Pitch detection (only on speaking frames to avoid noise floor)
          if (rms > SPEAKING_THRESH) {
            const f0 = detectPitch(timeBuf, ctx.sampleRate);
            pitchBuf.current.push(f0);
            if (pitchBuf.current.length > PITCH_HISTORY) pitchBuf.current.shift();
          }

          // Update display every ~6 samples (~480ms)
          if (rmsBuffer.current.length % 6 === 0) {
            const d = compute();
            // Attach latest spectral centroid
            d.spectral_centroid = spectralCentroid(freqBuf, ctx.sampleRate);
            setData(d);
          }
        }, SAMPLE_MS);

        // Send to backend with spectral centroid attached
        senderRef.current = setInterval(() => {
          const d = compute();
          if (analyserRef.current && ctxRef.current) {
            const fb = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(fb);
            d.spectral_centroid = spectralCentroid(fb, ctxRef.current.sampleRate);
          }
          sendToBackend(d);
        }, SEND_INTERVAL_MS);

      } catch {
        // Mic permission denied or unavailable
      }
    })();

    return () => { cancelled = true; };
  }, [active, compute, sendToBackend]);

  return data;
}
