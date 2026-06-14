"use client";
import { useState, useEffect, useRef } from "react";

const API_URL          = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const FFT_SIZE         = 2048;
const SAMPLE_MS        = 100;
const SEND_MS          = 6_000;
const WINDOW           = Math.floor(30_000 / SAMPLE_MS); // 300 samples = 30s
const SPEAKING_THRESH  = 0.01;   // RMS threshold for voice activity
const PITCH_HISTORY    = 40;

export type VoiceData = {
  energy:          number;
  cadence:         number;
  pitch_hz:        number;
  pitch_variation: number;
  jitter:          number;
  spectral_centroid: number;
  is_speaking:     boolean;
};

/** Reliable autocorrelation pitch detector - human voice range only */
function detectPitch(buf: Float32Array, sr: number): number {
  const N    = buf.length;
  const HALF = Math.floor(N / 2);

  // RMS gate - skip if too quiet
  let sq = 0;
  for (let i = 0; i < N; i++) sq += buf[i] * buf[i];
  const rms = Math.sqrt(sq / N);
  if (rms < 0.01) return -1;

  // Autocorrelation
  const ac = new Float32Array(HALF);
  for (let lag = 0; lag < HALF; lag++) {
    let s = 0;
    for (let j = 0; j < HALF; j++) s += buf[j] * buf[j + lag];
    ac[lag] = s;
  }

  // Search only in human-voice lag range (80 Hz - 600 Hz)
  const lagMin = Math.floor(sr / 600);
  const lagMax = Math.min(Math.floor(sr / 80), HALF - 1);

  let bestVal = -1, bestLag = -1;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    if (ac[lag] > bestVal) { bestVal = ac[lag]; bestLag = lag; }
  }

  // Must be at least 50% of zero-lag energy to count as a real pitch
  if (bestLag < 0 || ac[0] === 0 || bestVal / ac[0] < 0.5) return -1;

  return sr / bestLag;
}

function calcCentroid(freqData: Uint8Array, sr: number): number {
  const N = freqData.length;
  const binHz = sr / (N * 2);
  let wSum = 0, sum = 0;
  for (let i = 0; i < N; i++) {
    const mag = freqData[i] / 255;
    wSum += i * binHz * mag;
    sum  += mag;
  }
  return sum < 0.01 ? 0 : Math.min(1, (wSum / sum) / 3000);
}

export function useVoiceAnalyzer(active: boolean): VoiceData | null {
  const [data, setData] = useState<VoiceData | null>(null);

  // Keep refs so the intervals always see the latest values
  const rmsRef   = useRef<number[]>([]);
  const pitchRef = useRef<number[]>([]);
  const frameRef = useRef(0); // separate frame counter - not dependent on buffer length

  useEffect(() => {
    if (!active) {
      setData(null);
      rmsRef.current   = [];
      pitchRef.current = [];
      frameRef.current = 0;
      return;
    }

    let samplerTimer: ReturnType<typeof setInterval> | null = null;
    let senderTimer:  ReturnType<typeof setInterval> | null = null;
    let audioCtx:     AudioContext | null = null;
    let stream:       MediaStream  | null = null;
    let alive = true;

    (async () => {
      try {
        // Request mic with constraints that improve voice detection
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation:  true,
            noiseSuppression:  true,
            autoGainControl:   true,
            channelCount:      1,
          },
          video: false,
        });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }

        // Create AudioContext and RESUME it (critical - browsers suspend by default)
        audioCtx = new AudioContext({ sampleRate: 44100 });
        await audioCtx.resume();
        if (!alive) { audioCtx.close(); stream.getTracks().forEach(t => t.stop()); return; }

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize                = FFT_SIZE;
        analyser.smoothingTimeConstant  = 0.5; // smooth out frame-to-frame noise
        audioCtx.createMediaStreamSource(stream).connect(analyser);

        const timeBuf = new Float32Array(analyser.fftSize);
        const freqBuf = new Uint8Array(analyser.frequencyBinCount);
        const sr      = audioCtx.sampleRate;

        // ── Sample loop ──────────────────────────────────────────────────────
        samplerTimer = setInterval(() => {
          if (!alive) return;

          analyser.getFloatTimeDomainData(timeBuf);
          analyser.getByteFrequencyData(freqBuf);

          // RMS energy
          let sq = 0;
          for (let i = 0; i < timeBuf.length; i++) sq += timeBuf[i] * timeBuf[i];
          const rms = Math.sqrt(sq / timeBuf.length);

          rmsRef.current.push(rms);
          if (rmsRef.current.length > WINDOW) rmsRef.current.shift();

          // Only run pitch on voiced frames
          if (rms > SPEAKING_THRESH) {
            const f0 = detectPitch(timeBuf, sr);
            if (f0 > 0) {
              pitchRef.current.push(f0);
              if (pitchRef.current.length > PITCH_HISTORY) pitchRef.current.shift();
            }
          }

          // Update display every 5 frames (~500ms) using a dedicated counter
          frameRef.current += 1;
          if (frameRef.current % 5 === 0) {
            setData(buildVoiceData(rmsRef.current, pitchRef.current, freqBuf, sr));
          }
        }, SAMPLE_MS);

        // ── Send to backend ───────────────────────────────────────────────────
        senderTimer = setInterval(() => {
          if (!alive) return;
          analyser.getByteFrequencyData(freqBuf);
          const d = buildVoiceData(rmsRef.current, pitchRef.current, freqBuf, sr);
          fetch(`${API_URL}/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "voice", timestamp: new Date().toISOString(), ...d }),
          }).catch(() => {});
        }, SEND_MS);

      } catch {
        // Mic permission denied or device unavailable - fail silently
      }
    })();

    // Full cleanup including intervals and streams
    return () => {
      alive = false;
      if (samplerTimer) clearInterval(samplerTimer);
      if (senderTimer)  clearInterval(senderTimer);
      stream?.getTracks().forEach(t => t.stop());
      audioCtx?.close().catch(() => {});
      rmsRef.current   = [];
      pitchRef.current = [];
      frameRef.current = 0;
    };
  }, [active]);

  return data;
}

function buildVoiceData(
  rms: number[],
  pitches: number[],
  freqBuf: Uint8Array,
  sr: number,
): VoiceData {
  if (!rms.length) {
    return { energy: 0, cadence: 0, pitch_hz: -1, pitch_variation: 0, jitter: 0, spectral_centroid: 0, is_speaking: false };
  }

  const energy      = rms.reduce((s, v) => s + v, 0) / rms.length;
  const cadence     = rms.filter(v => v > SPEAKING_THRESH).length / rms.length;
  const is_speaking = rms.length > 0 && rms[rms.length - 1] > SPEAKING_THRESH;

  const valid   = pitches.filter(p => p > 0);
  const pitch_hz = valid.length ? valid[valid.length - 1] : -1;

  let pitch_variation = 0, jitter = 0;
  if (valid.length >= 4) {
    const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
    const std  = Math.sqrt(valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length);
    pitch_variation = Math.min(1, std / 80);

    const periods = valid.map(f => 1 / f);
    const pMean   = periods.reduce((s, v) => s + v, 0) / periods.length;
    if (pMean > 0) {
      const pStd = Math.sqrt(periods.reduce((s, v) => s + (v - pMean) ** 2, 0) / periods.length);
      jitter = Math.min(1, (pStd / pMean) * 20);
    }
  }

  return {
    energy:            +energy.toFixed(4),
    cadence:           +cadence.toFixed(4),
    pitch_hz:          pitch_hz > 0 ? +pitch_hz.toFixed(1) : -1,
    pitch_variation:   +pitch_variation.toFixed(4),
    jitter:            +jitter.toFixed(4),
    spectral_centroid: calcCentroid(freqBuf, sr),
    is_speaking,
  };
}
