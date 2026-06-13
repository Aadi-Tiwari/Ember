"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff } from "lucide-react";

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

type Props = {
  onEmotion?: (e: EmotionScores, score: number) => void;
};

export default function FaceCam({ onEmotion }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceapiRef = useRef<any>(null);
  const [state, setState] = useState<"idle" | "loading" | "active">("idle");
  const [emotions, setEmotions] = useState<EmotionScores | null>(null);
  const [faceVisible, setFaceVisible] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setState("loading");
    setError("");
    try {
      const faceapi = await import("@vladmandic/face-api");
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceExpressionNet.loadFromUri("/models"),
      ]);
      faceapiRef.current = faceapi;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("active");
    } catch (e: any) {
      setError(e?.message?.includes("Permission") ? "Camera permission denied" : "Could not start camera");
      setState("idle");
    }
  }

  function stop() {
    const v = videoRef.current;
    if (v?.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
    setState("idle");
    setEmotions(null);
    setFaceVisible(false);
  }

  // Detection loop
  useEffect(() => {
    if (state !== "active" || !faceapiRef.current) return;
    const faceapi = faceapiRef.current;

    const id = setInterval(async () => {
      if (!videoRef.current) return;
      try {
        const result = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
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
            body: JSON.stringify({
              type: "emotion",
              timestamp: new Date().toISOString(),
              ...Object.fromEntries(
                Object.entries(e).map(([k, v]) => [k, Math.round((v as number) * 1000) / 1000])
              ),
            }),
          }).catch(() => {});
        } else {
          setFaceVisible(false);
        }
      } catch {}
    }, 2000);

    return () => clearInterval(id);
  }, [state, onEmotion]);

  const dominant = emotions
    ? (Object.entries(emotions).sort(([, a], [, b]) => (b as number) - (a as number))[0] as [string, number])
    : null;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Camera feed */}
      <div className="relative bg-black" style={{ aspectRatio: "4/3", minHeight: 160 }}>
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ display: state === "active" ? "block" : "none", transform: "scaleX(-1)" }}
        />

        {state !== "active" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)" }}
            >
              <Camera size={22} color="var(--amber)" />
            </div>
            <button
              onClick={start}
              disabled={state === "loading"}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{
                background: "rgba(245,158,11,0.15)",
                border: "1px solid rgba(245,158,11,0.35)",
                color: "var(--amber)",
              }}
            >
              {state === "loading" ? "Loading model..." : "Enable Camera"}
            </button>
            <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
              Emotion detection runs locally.{"\n"}No video is ever uploaded.
            </p>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )}

        {state === "active" && (
          <>
            {/* Dominant emotion badge */}
            {faceVisible && dominant && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg text-xs font-bold"
                style={{ background: "rgba(0,0,0,0.75)", color: COLORS[dominant[0]] }}
              >
                {dominant[0].toUpperCase()} {((dominant[1] as number) * 100).toFixed(0)}%
              </motion.div>
            )}
            {!faceVisible && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.55)" }}
              >
                <p className="text-xs" style={{ color: "var(--muted)" }}>Looking for face...</p>
              </div>
            )}
            {/* Stop button */}
            <button
              onClick={stop}
              className="absolute top-2 right-2 p-1.5 rounded-lg"
              style={{ background: "rgba(0,0,0,0.65)" }}
            >
              <CameraOff size={14} color="#fff" />
            </button>
          </>
        )}
      </div>

      {/* Emotion bars */}
      <AnimatePresence>
        {emotions && faceVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-3 flex flex-col gap-1.5"
          >
            {(Object.entries(emotions) as [string, number][])
              .sort(([, a], [, b]) => b - a)
              .map(([name, val]) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-xs w-16 capitalize" style={{ color: "var(--muted)" }}>
                    {name}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: COLORS[name] }}
                      animate={{ width: `${val * 100}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-xs tabular-nums w-8 text-right" style={{ color: "var(--muted)" }}>
                    {(val * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
