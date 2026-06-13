"use client";
import { useRef, useEffect, useState } from "react";
import Script from "next/script";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Loader } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type EmotionScores = {
  happy: number;
  sad: number;
  angry: number;
  fearful: number;
  disgusted: number;
  surprised: number;
  neutral: number;
};

const COLORS: Record<string, string> = {
  happy: "#22c55e",
  neutral: "#94a3b8",
  surprised: "#f59e0b",
  sad: "#60a5fa",
  angry: "#ef4444",
  fearful: "#a855f7",
  disgusted: "#f97316",
};

export function emotionRiskScore(e: EmotionScores): number {
  const raw = e.sad * 3 + e.fearful * 2.5 + e.disgusted * 1.5 + e.angry * 1.5 + e.neutral * 0.5 - e.happy * 2;
  return Math.min(100, Math.max(0, Math.round(raw * 50)));
}

type Props = { onEmotion?: (e: EmotionScores, score: number) => void };

export default function FaceCam({ onEmotion }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading-models" | "loading-cam" | "active">("idle");
  const [error, setError] = useState("");
  const [emotions, setEmotions] = useState<EmotionScores | null>(null);
  const [faceVisible, setFaceVisible] = useState(false);

  async function start() {
    setError("");
    const faceapi = (window as any).faceapi;
    if (!faceapi) {
      setError("AI library not loaded yet - try again in a moment");
      return;
    }

    // Load models from /models directory
    setPhase("loading-models");
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceExpressionNet.loadFromUri("/models"),
      ]);
    } catch (e: any) {
      setError(`Model error: ${e?.message ?? String(e)}`);
      setPhase("idle");
      return;
    }

    // Start camera
    setPhase("loading-cam");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("active");
    } catch (e: any) {
      const msg =
        e?.name === "NotAllowedError" ? "Camera permission denied" :
        e?.name === "NotFoundError" ? "No camera found on this device" :
        `Camera error: ${e?.message ?? e?.name ?? "unknown"}`;
      setError(msg);
      setPhase("idle");
    }
  }

  function stop() {
    const v = videoRef.current;
    if (v?.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
    setPhase("idle");
    setEmotions(null);
    setFaceVisible(false);
  }

  // Detection loop
  useEffect(() => {
    if (phase !== "active") return;
    const faceapi = (window as any).faceapi;
    if (!faceapi) return;

    const id = setInterval(async () => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      try {
        const result = await faceapi
          .detectSingleFace(v, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
          .withFaceExpressions();

        if (result?.expressions) {
          const e = result.expressions as EmotionScores;
          setEmotions(e);
          setFaceVisible(true);
          const score = emotionRiskScore(e);
          onEmotion?.(e, score);
          fetch(`${API_URL}/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "emotion", timestamp: new Date().toISOString(), ...e }),
          }).catch(() => {});
        } else {
          setFaceVisible(false);
        }
      } catch {}
    }, 2000);

    return () => clearInterval(id);
  }, [phase, onEmotion]);

  const isLoading = phase === "loading-models" || phase === "loading-cam";
  const loadingLabel = phase === "loading-models" ? "Loading AI model..." : "Starting camera...";
  const dominant = emotions
    ? (Object.entries(emotions).sort(([, a], [, b]) => (b as number) - (a as number))[0] as [string, number])
    : null;

  return (
    <>
      {/* Load face-api.js from CDN - bypasses bundler Node.js issues */}
      <Script
        src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js"
        onReady={() => setScriptReady(true)}
        strategy="lazyOnload"
      />

      <div
        className="rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Camera feed */}
        <div className="relative bg-black" style={{ aspectRatio: "4/3", minHeight: 140 }}>
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ display: phase === "active" ? "block" : "none", transform: "scaleX(-1)" }}
          />

          {phase !== "active" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)" }}
              >
                {isLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Loader size={20} color="var(--amber)" />
                  </motion.div>
                ) : (
                  <Camera size={20} color="var(--amber)" />
                )}
              </div>

              {!isLoading && (
                <button
                  onClick={start}
                  disabled={!scriptReady}
                  className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                  style={{
                    background: "rgba(245,158,11,0.15)",
                    border: "1px solid rgba(245,158,11,0.35)",
                    color: "var(--amber)",
                  }}
                >
                  {scriptReady ? "Enable Camera" : "Loading..."}
                </button>
              )}

              {isLoading && (
                <p className="text-xs" style={{ color: "var(--muted)" }}>{loadingLabel}</p>
              )}

              <p className="text-xs text-center leading-relaxed" style={{ color: "var(--muted)" }}>
                Emotion detection runs locally.{" "}
                <span style={{ color: "var(--text)" }}>No video is ever uploaded.</span>
              </p>

              {error && <p className="text-xs text-center text-red-400 max-w-xs">{error}</p>}
            </div>
          )}

          {phase === "active" && (
            <>
              {faceVisible && dominant && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg text-xs font-bold"
                  style={{ background: "rgba(0,0,0,0.75)", color: COLORS[dominant[0]] }}
                >
                  {dominant[0].toUpperCase()} {((dominant[1] as number) * 100).toFixed(0)}%
                </motion.div>
              )}
              {!faceVisible && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>No face detected</p>
                </div>
              )}
              <button onClick={stop} className="absolute top-2 right-2 p-1.5 rounded-lg" style={{ background: "rgba(0,0,0,0.65)" }}>
                <CameraOff size={13} color="#fff" />
              </button>
            </>
          )}
        </div>

        {/* Emotion bars */}
        <AnimatePresence>
          {emotions && faceVisible && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-3 flex flex-col gap-1.5">
              {(Object.entries(emotions) as [string, number][])
                .sort(([, a], [, b]) => b - a)
                .map(([name, val]) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-xs w-16 capitalize" style={{ color: "var(--muted)" }}>{name}</span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: COLORS[name] }}
                        animate={{ width: `${val * 100}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                    <span className="text-xs tabular-nums w-7 text-right" style={{ color: "var(--muted)" }}>
                      {(val * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
