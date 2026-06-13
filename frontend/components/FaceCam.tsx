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

const EMOTION_ORDER = ["happy", "sad", "angry", "surprised", "fearful", "disgusted", "neutral"];

export function emotionRiskScore(e: EmotionScores): number {
  const raw = e.sad * 3 + e.fearful * 2.5 + e.disgusted * 1.5 + e.angry * 1.5 + e.neutral * 0.5 - e.happy * 2;
  return Math.min(100, Math.max(0, Math.round(raw * 50)));
}

/** Amplify subtle non-neutral emotions so they actually show up */
function amplify(raw: EmotionScores): EmotionScores {
  const AMP = 4.0;
  const amp: any = { ...raw };
  amp.happy    *= AMP;
  amp.sad      *= AMP;
  amp.angry    *= AMP;
  amp.fearful  *= AMP;
  amp.disgusted *= AMP;
  amp.surprised *= AMP;
  // neutral stays as-is - it competes against the amplified others
  const total = Object.values(amp).reduce((s: number, v) => s + (v as number), 0);
  if (total === 0) return raw;
  const result: any = {};
  Object.keys(amp).forEach(k => result[k] = (amp[k] as number) / total);
  return result as EmotionScores;
}

/** Smooth emotions with exponential moving average */
function smooth(prev: EmotionScores | null, next: EmotionScores, alpha = 0.35): EmotionScores {
  if (!prev) return next;
  const result: any = {};
  Object.keys(next).forEach(k => {
    result[k] = alpha * (next as any)[k] + (1 - alpha) * (prev as any)[k];
  });
  return result as EmotionScores;
}

type Props = { onEmotion?: (e: EmotionScores, score: number) => void };

export default function FaceCam({ onEmotion }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smoothedRef = useRef<EmotionScores | null>(null);

  const [scriptReady, setScriptReady] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading-models" | "loading-cam" | "active">("idle");
  const [error, setError] = useState("");
  const [emotions, setEmotions] = useState<EmotionScores | null>(null);
  const [faceBox, setFaceBox] = useState<{x:number;y:number;w:number;h:number} | null>(null);
  const [faceVisible, setFaceVisible] = useState(false);

  async function start() {
    setError("");
    const faceapi = (window as any).faceapi;
    if (!faceapi) { setError("AI library loading, try again in a moment"); return; }

    setPhase("loading-models");
    try {
      if (faceapi.tf?.ready) await faceapi.tf.ready();
      // SSD MobileNet: much more accurate than TinyFaceDetector
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
        faceapi.nets.faceExpressionNet.loadFromUri("/models"),
      ]);
    } catch (e: any) {
      setError(`Model error: ${e?.message ?? String(e)}`);
      setPhase("idle");
      return;
    }

    setPhase("loading-cam");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("active");
    } catch (e: any) {
      const msg = e?.name === "NotAllowedError" ? "Camera permission denied"
        : e?.name === "NotFoundError" ? "No camera found"
        : `Camera error: ${e?.message ?? e?.name}`;
      setError(msg);
      setPhase("idle");
    }
  }

  function stop() {
    const v = videoRef.current;
    if (v?.srcObject) {
      (v.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      v.srcObject = null;
    }
    const c = canvasRef.current;
    if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setPhase("idle");
    setEmotions(null);
    setFaceBox(null);
    setFaceVisible(false);
    smoothedRef.current = null;
  }

  // Detection loop - 600ms for responsiveness
  useEffect(() => {
    if (phase !== "active") return;
    const faceapi = (window as any).faceapi;
    if (!faceapi) return;

    const id = setInterval(async () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || v.readyState < 2 || !c) return;

      try {
        const result = await faceapi
          .detectSingleFace(v, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
          .withFaceExpressions();

        const ctx = c.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, c.width, c.height);

        if (result?.expressions && result?.detection) {
          const box = result.detection.box;
          const scaleX = c.width / v.videoWidth;
          const scaleY = c.height / v.videoHeight;

          // Draw bounding box on canvas
          if (ctx) {
            const dominant = Object.entries(result.expressions as EmotionScores)
              .sort(([,a],[,b]) => (b as number)-(a as number))[0][0];
            const color = COLORS[dominant] ?? "#f59e0b";
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            // Mirror x because video is flipped
            const bx = c.width - (box.x + box.width) * scaleX;
            const by = box.y * scaleY;
            const bw = box.width * scaleX;
            const bh = box.height * scaleY;
            ctx.strokeRect(bx, by, bw, bh);
            ctx.shadowBlur = 0;
          }

          // Amplify + smooth
          const amplified = amplify(result.expressions as EmotionScores);
          const smoothed = smooth(smoothedRef.current, amplified);
          smoothedRef.current = smoothed;

          setEmotions(smoothed);
          setFaceVisible(true);
          const score = emotionRiskScore(smoothed);
          onEmotion?.(smoothed, score);

          fetch(`${API_URL}/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "emotion", timestamp: new Date().toISOString(), ...smoothed }),
          }).catch(() => {});
        } else {
          setFaceVisible(false);
        }
      } catch {}
    }, 600);

    return () => clearInterval(id);
  }, [phase, onEmotion]);

  // Sync canvas size to video
  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    const sync = () => { c.width = v.clientWidth; c.height = v.clientHeight; };
    v.addEventListener("loadedmetadata", sync);
    sync();
    return () => v.removeEventListener("loadedmetadata", sync);
  }, []);

  const isLoading = phase === "loading-models" || phase === "loading-cam";
  const loadLabel = phase === "loading-models" ? "Loading SSD model (~2MB)..." : "Starting camera...";

  const dominant = emotions
    ? (Object.entries(emotions).sort(([,a],[,b]) => (b as number)-(a as number))[0] as [string, number])
    : null;

  const dominantColor = dominant ? COLORS[dominant[0]] : "var(--amber)";

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js"
        onReady={() => setScriptReady(true)}
        strategy="lazyOnload"
      />

      <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

        {/* Camera + canvas overlay */}
        <div className="relative bg-black" style={{ aspectRatio: "4/3", minHeight: 160 }}>
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ display: phase === "active" ? "block" : "none", transform: "scaleX(-1)" }}
          />
          {/* Canvas for bounding box - NOT mirrored (we compensate in JS) */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ display: phase === "active" ? "block" : "none" }}
          />

          {phase !== "active" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)" }}>
                {isLoading
                  ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader size={22} color="var(--amber)" /></motion.div>
                  : <Camera size={22} color="var(--amber)" />}
              </div>
              {!isLoading && (
                <button onClick={start} disabled={!scriptReady}
                  className="px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                  style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", color: "var(--amber)" }}>
                  {scriptReady ? "Enable Camera" : "Loading..."}
                </button>
              )}
              {isLoading && <p className="text-xs" style={{ color: "var(--muted)" }}>{loadLabel}</p>}
              <p className="text-xs text-center" style={{ color: "var(--muted)" }}>Runs locally - no video uploaded</p>
              {error && <p className="text-xs text-center text-red-400 max-w-xs">{error}</p>}
            </div>
          )}

          {/* Overlays when active */}
          {phase === "active" && (
            <>
              {dominant && faceVisible && (
                <motion.div
                  key={dominant[0]}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg text-xs font-bold"
                  style={{ background: "rgba(0,0,0,0.8)", color: dominantColor, border: `1px solid ${dominantColor}55` }}
                >
                  {dominant[0].toUpperCase()} {((dominant[1] as number) * 100).toFixed(0)}%
                </motion.div>
              )}
              {!faceVisible && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>No face detected - look at camera</p>
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
              {EMOTION_ORDER.map(name => {
                const val = (emotions as any)[name] as number ?? 0;
                return (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-xs w-16 capitalize" style={{ color: name === dominant?.[0] ? "var(--text)" : "var(--muted)", fontWeight: name === dominant?.[0] ? 600 : 400 }}>
                      {name}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: COLORS[name] }}
                        animate={{ width: `${(val * 100).toFixed(1)}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <span className="text-xs tabular-nums w-7 text-right" style={{ color: name === dominant?.[0] ? dominantColor : "var(--muted)" }}>
                      {(val * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
