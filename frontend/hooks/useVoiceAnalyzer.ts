"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SAMPLE_MS = 80;
const SEND_INTERVAL_MS = 6000;
const WINDOW_SAMPLES = Math.floor(30_000 / SAMPLE_MS); // 30-second window

export type VoiceData = {
  energy: number;
  cadence: number;
  pitch_variation: number;
  is_speaking: boolean;
};

export function useVoiceAnalyzer(active: boolean): VoiceData | null {
  const [data, setData] = useState<VoiceData | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rmsBuffer = useRef<number[]>([]);
  const zcrBuffer = useRef<number[]>([]);
  const samplerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const senderRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const compute = useCallback((): VoiceData => {
    const rms = rmsBuffer.current;
    const zcr = zcrBuffer.current;
    if (!rms.length) return { energy: 0, cadence: 0, pitch_variation: 0, is_speaking: false };

    const SPEAKING_THRESH = 0.015;
    const energy = rms.reduce((s, v) => s + v, 0) / rms.length;
    const cadence = rms.filter((v) => v > SPEAKING_THRESH).length / rms.length;
    const is_speaking = (rms[rms.length - 1] ?? 0) > SPEAKING_THRESH;

    // Pitch variation = std dev of ZCR (expressiveness proxy)
    const zcrMean = zcr.reduce((s, v) => s + v, 0) / Math.max(zcr.length, 1);
    const zcrStd = Math.sqrt(
      zcr.reduce((s, v) => s + (v - zcrMean) ** 2, 0) / Math.max(zcr.length, 1)
    );
    const pitch_variation = Math.min(1, zcrStd * 20);

    return { energy: +energy.toFixed(4), cadence: +cadence.toFixed(4), pitch_variation: +pitch_variation.toFixed(4), is_speaking };
  }, []);

  const sendToBackend = useCallback(() => {
    const d = compute();
    fetch(`${API_URL}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "voice", timestamp: new Date().toISOString(), ...d }),
    }).catch(() => {});
  }, [compute]);

  useEffect(() => {
    if (!active) {
      // Cleanup
      if (samplerRef.current) clearInterval(samplerRef.current);
      if (senderRef.current) clearInterval(senderRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      analyserRef.current = null;
      streamRef.current = null;
      rmsBuffer.current = [];
      zcrBuffer.current = [];
      setData(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyserRef.current = analyser;

        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        const buf = new Float32Array(analyser.fftSize);

        // Sample loop
        samplerRef.current = setInterval(() => {
          if (!analyserRef.current) return;
          analyserRef.current.getFloatTimeDomainData(buf);

          // RMS
          const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);

          // ZCR
          let zcr = 0;
          for (let i = 1; i < buf.length; i++) {
            if ((buf[i] >= 0) !== (buf[i - 1] >= 0)) zcr++;
          }
          zcr /= buf.length;

          rmsBuffer.current.push(rms);
          zcrBuffer.current.push(zcr);

          // Keep rolling window
          if (rmsBuffer.current.length > WINDOW_SAMPLES) rmsBuffer.current.shift();
          if (zcrBuffer.current.length > WINDOW_SAMPLES) zcrBuffer.current.shift();

          // Update display state every ~500ms (every 6 samples)
          if (rmsBuffer.current.length % 6 === 0) {
            setData(compute());
          }
        }, SAMPLE_MS);

        // Send to backend
        senderRef.current = setInterval(sendToBackend, SEND_INTERVAL_MS);
        sendToBackend();
      } catch {
        // Mic permission denied or not available - silently fail
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, compute, sendToBackend]);

  return data;
}
