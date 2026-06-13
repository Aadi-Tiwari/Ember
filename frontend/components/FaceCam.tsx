"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import Script from "next/script";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Loader, Eye } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DETECT_INTERVAL = 300; // ms - fast detection
const SEND_INTERVAL = 5000;  // ms - backend POST rate

export type EmotionScores = {
  happy: number; sad: number; angry: number;
  fearful: number; disgusted: number; surprised: number; neutral: number;
};

const COLORS: Record<string, string> = {
  happy: "#22c55e", sad: "#60a5fa", angry: "#ef4444",
  surprised: "#f59e0b", fearful: "#a855f7", disgusted: "#f97316", neutral: "#94a3b8",
};
const ORDER = ["happy", "sad", "angry", "surprised", "fearful", "disgusted", "neutral"];

export function emotionRiskScore(e: EmotionScores): number {
  const raw = e.sad * 3 + e.fearful * 2.5 + e.disgusted * 1.5 + e.angry * 1.5 + e.neutral * 0.5 - e.happy * 2;
  return Math.min(100, Math.max(0, Math.round(raw * 50)));
}

// Eye aspect ratio - measure eye openness from 6 landmark points
function eyeAR(pts: { x: number; y: number }[]): number {
  if (pts.length < 6) return 0.3;
  const A = Math.hypot(pts[1].x - pts[5].x, pts[1].y - pts[5].y);
  const B = Math.hypot(pts[2].x - pts[4].x, pts[2].y - pts[4].y);
  const C = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);
  return C > 0 ? (A + B) / (2 * C) : 0.3;
}

// Gentle amplification so subtle emotions register
function amplify(raw: EmotionScores): EmotionScores {
  const AMP = 1.6;
  const a: any = { ...raw, happy: raw.happy * AMP, sad: raw.sad * AMP, angry: raw.angry * AMP, fearful: raw.fearful * AMP, disgusted: raw.disgusted * AMP, surprised: raw.surprised * AMP };
  const total = Object.values(a).reduce((s: number, v) => s + (v as number), 0);
  if (!total) return raw;
  const r: any = {};
  Object.keys(a).forEach(k => r[k] = (a[k] as number) / total);
  return r as EmotionScores;
}

// Exponential moving average
function ema(prev: EmotionScores | null, next: EmotionScores, a = 0.25): EmotionScores {
  if (!prev) return next;
  const r: any = {};
  Object.keys(next).forEach(k => r[k] = a * (next as any)[k] + (1 - a) * (prev as any)[k]);
  return r as EmotionScores;
}

type Props = { onEmotion?: (e: EmotionScores, score: number, ear: number) => void };

export default function FaceCam({ onEmotion }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smoothedRef = useRef<EmotionScores | null>(null);
  const earSmoothRef = useRef(0.3);
  const lastSendRef = useRef(0);

  const [scriptReady, setScriptReady] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading" | "active">("idle");
  const [error, setError] = useState("");
  const [emotions, setEmotions] = useState<EmotionScores | null>(null);
  const [earVal, setEarVal] = useState(0.3);
  const [faceFound, setFaceFound] = useState(false);

  // Load models and start camera
  async function start() {
    setError("");
    const fa = (window as any).faceapi;
    if (!fa) { setError("Library still loading, wait a moment"); return; }

    setPhase("loading");
    try {
      if (fa.tf?.ready) await fa.tf.ready();
      await Promise.all([
        fa.nets.tinyFaceDetector.loadFromUri("/models"),
        fa.nets.ssdMobilenetv1.loadFromUri("/models"),
        fa.nets.faceLandmark68Net.loadFromUri("/models"),
        fa.nets.faceExpressionNet.loadFromUri("/models"),
      ]);
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
        : `Error: ${e?.message ?? e?.name ?? String(e)}`;
      setError(msg);
      setPhase("idle");
    }
  }

  function stop() {
    const v = videoRef.current;
    if (v?.srcObject) (v.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setPhase("idle"); setEmotions(null); setFaceFound(false); setEarVal(0.3);
    smoothedRef.current = null;
  }

  // Core detection loop
  const detect = useCallback(async () => {
    const fa = (window as any).faceapi;
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!fa || !v || !c || v.readyState < 2) return;

    // Sync canvas to video display size
    if (c.width !== v.clientWidth || c.height !== v.clientHeight) {
      c.width = v.clientWidth;
      c.height = v.clientHeight;
    }
    const W = c.width, H = c.height;
    const sx = v.videoWidth > 0 ? W / v.videoWidth : 1;
    const sy = v.videoHeight > 0 ? H / v.videoHeight : 1;

    const ctx = c.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, W, H);

    // Try TinyFaceDetector first (fast), fallback to SSD (accurate)
    let result = await fa
      .detectSingleFace(v, new fa.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 }))
      .withFaceLandmarks().withFaceExpressions();

    if (!result) {
      result = await fa
        .detectSingleFace(v, new fa.SsdMobilenetv1Options({ minConfidence: 0.15 }))
        .withFaceLandmarks().withFaceExpressions();
    }

    if (!result) { setFaceFound(false); return; }

    setFaceFound(true);
    const { detection, landmarks, expressions } = result;
    const box = detection.box;

    // Video is CSS-mirrored (scaleX(-1)), canvas is not - flip x coords
    const bx = W - (box.x + box.width) * sx;
    const by = box.y * sy;
    const bw = box.width * sx;
    const bh = box.height * sy;

    // Smooth emotions
    const amplified = amplify(expressions as EmotionScores);
    const smoothed = ema(smoothedRef.current, amplified);
    smoothedRef.current = smoothed;
    setEmotions(smoothed);

    // Eye aspect ratio (fatigue signal)
    const leftEAR = eyeAR(landmarks.getLeftEye());
    const rightEAR = eyeAR(landmarks.getRightEye());
    const rawEAR = (leftEAR + rightEAR) / 2;
    earSmoothRef.current = 0.2 * rawEAR + 0.8 * earSmoothRef.current;
    setEarVal(+earSmoothRef.current.toFixed(3));

    // Get dominant emotion color
    const dom = Object.entries(smoothed).sort(([, a], [, b]) => (b as number) - (a as number))[0][0];
    const color = COLORS[dom] ?? "#f59e0b";

    if (ctx) {
      // Bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.shadowBlur = 0;

      // 68 landmark dots - draw on mirrored canvas coords
      ctx.fillStyle = color + "bb";
      landmarks.positions.forEach((pt: { x: number; y: number }) => {
        const lx = W - pt.x * sx;
        const ly = pt.y * sy;
        ctx.beginPath();
        ctx.arc(lx, ly, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Eye openness indicators
      [landmarks.getLeftEye(), landmarks.getRightEye()].forEach(eye => {
        if (eye.length < 6) return;
        const cx2 = W - ((eye[0].x + eye[3].x) / 2) * sx;
        const cy2 = ((eye[1].y + eye[2].y + eye[4].y + eye[5].y) / 4) * sy;
        const earColor = rawEAR < 0.18 ? "#ef4444" : rawEAR < 0.22 ? "#f59e0b" : "#22c55e";
        ctx.strokeStyle = earColor;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = earColor;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(cx2, cy2, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
    }

    // Send to backend (rate limited)
    const now = Date.now();
    if (now - lastSendRef.current > SEND_INTERVAL) {
      lastSendRef.current = now;
      const score = emotionRiskScore(smoothed);
      onEmotion?.(smoothed, score, earSmoothRef.current);
      fetch(`${API_URL}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "emotion",
          timestamp: new Date().toISOString(),
          ...smoothed,
          eye_openness: +earSmoothRef.current.toFixed(3),
        }),
      }).catch(() => {});
    }
  }, [onEmotion]);

  // Detection interval
  useEffect(() => {
    if (phase !== "active") return;
    const id = setInterval(detect, DETECT_INTERVAL);
    return () => clearInterval(id);
  }, [phase, detect]);

  const isLoading = phase === "loading";
  const dom = emotions
    ? Object.entries(emotions).sort(([, a], [, b]) => (b as number) - (a as number))[0] as [string, number]
    : null;
  const domColor = dom ? COLORS[dom[0]] : "var(--amber)";
  const eyeOpenPct = Math.min(100, Math.max(0, Math.round((earVal - 0.1) / 0.25 * 100)));
  const eyeStatus = earVal < 0.18 ? "Drowsy" : earVal < 0.22 ? "Tired" : "Alert";
  const eyeColor = earVal < 0.18 ? "#ef4444" : earVal < 0.22 ? "#f59e0b" : "#22c55e";

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js"
        onReady={() => setScriptReady(true)} strategy="lazyOnload" />

      <div className="rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

        {/* Camera + canvas overlay */}
        <div className="relative bg-black" style={{ aspectRatio: "4/3", minHeight: 180 }}>
          <video ref={videoRef} muted playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ display: phase === "active" ? "block" : "none", transform: "scaleX(-1)" }}
          />
          <canvas ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ display: phase === "active" ? "block" : "none" }}
          />

          {/* Idle/loading state */}
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
                  className="px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: "var(--amber)" }}>
                  {scriptReady ? "Enable Camera" : "Loading..."}
                </button>
              )}
              {isLoading && (
                <div className="flex flex-col items-center gap-1">
                  <p className="text-xs" style={{ color: "var(--muted)" }}>Loading 4 AI models...</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>Face detection + landmarks + expressions</p>
                </div>
              )}
              <p className="text-xs text-center" style={{ color: "var(--muted)" }}>Runs locally - no video transmitted</p>
              {error && <p className="text-xs text-center text-red-400 max-w-xs">{error}</p>}
            </div>
          )}

          {/* Active overlays */}
          {phase === "active" && (
            <>
              {dom && faceFound && (
                <motion.div key={dom[0]} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg text-xs font-bold"
                  style={{ background: "rgba(0,0,0,0.82)", color: domColor, border: `1px solid ${domColor}55` }}>
                  {dom[0].toUpperCase()} {((dom[1] as number) * 100).toFixed(0)}%
                </motion.div>
              )}
              {phase === "active" && faceFound && (
                <div className="absolute top-2 left-2 px-2 py-1 rounded-lg text-xs flex items-center gap-1.5"
                  style={{ background: "rgba(0,0,0,0.75)", color: eyeColor }}>
                  <Eye size={11} />
                  <span>{eyeStatus}</span>
                </div>
              )}
              {!faceFound && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>Move closer or look at camera</p>
                </div>
              )}
              <button onClick={stop} className="absolute top-2 right-2 p-1.5 rounded-lg"
                style={{ background: "rgba(0,0,0,0.65)" }}>
                <CameraOff size={13} color="#fff" />
              </button>
            </>
          )}
        </div>

        {/* Eye openness bar + emotion bars */}
        <AnimatePresence>
          {emotions && faceFound && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-3 flex flex-col gap-1.5">
              {/* Eye fatigue indicator */}
              <div className="flex items-center gap-2 pb-1 mb-0.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <Eye size={11} color={eyeColor} />
                <span className="text-xs" style={{ color: "var(--muted)" }}>Eye openness</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <motion.div className="h-full rounded-full" style={{ background: eyeColor }}
                    initial={{ width: "0%" }}
                    animate={{ width: `${eyeOpenPct}%` }}
                    transition={{ duration: 0.4 }} />
                </div>
                <span className="text-xs tabular-nums w-12 text-right" style={{ color: eyeColor }}>
                  {eyeStatus}
                </span>
              </div>

              {/* Emotion bars */}
              {ORDER.map(name => {
                const val = (emotions as any)[name] as number ?? 0;
                const pct = Math.min(100, val * 100);
                const isDom = name === dom?.[0];
                return (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-xs w-16 capitalize"
                      style={{ color: isDom ? "var(--text)" : "var(--muted)", fontWeight: isDom ? 600 : 400 }}>
                      {name}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <motion.div className="h-full rounded-full" style={{ background: COLORS[name] }}
                        initial={{ width: "0%" }}
                        animate={{ width: `${pct.toFixed(1)}%` }}
                        transition={{ duration: 0.35, ease: "easeOut" }} />
                    </div>
                    <span className="text-xs tabular-nums w-7 text-right"
                      style={{ color: isDom ? domColor : "var(--muted)" }}>
                      {pct.toFixed(0)}%
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
