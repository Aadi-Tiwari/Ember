"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Loader, Eye, Activity } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SEND_INTERVAL = 4000;

export type EmotionScores = {
  happy: number; sad: number; angry: number;
  fearful: number; disgusted: number; surprised: number; neutral: number;
};

const EMOTION_COLORS: Record<string, string> = {
  happy: "#22c55e", sad: "#60a5fa", angry: "#ef4444",
  surprised: "#f59e0b", fearful: "#a855f7", disgusted: "#f97316", neutral: "#94a3b8",
};
const EMOTION_ORDER = ["happy", "sad", "angry", "surprised", "fearful", "disgusted", "neutral"];

export function emotionRiskScore(e: EmotionScores): number {
  const raw = e.sad * 3 + e.fearful * 2.5 + e.disgusted * 1.5 + e.angry * 1.5 + e.neutral * 0.5 - e.happy * 2;
  return Math.min(100, Math.max(0, Math.round(raw * 50)));
}

// Map 52 MediaPipe blendshapes to 7 emotion scores
function blendshapesToEmotions(bs: { categoryName: string; score: number }[]): EmotionScores {
  const get = (name: string) => bs.find(b => b.categoryName === name)?.score ?? 0;

  const mouthSmile  = (get("mouthSmileLeft") + get("mouthSmileRight")) / 2;
  const mouthFrown  = (get("mouthFrownLeft") + get("mouthFrownRight")) / 2;
  const browDown    = (get("browDownLeft") + get("browDownRight")) / 2;
  const browInnerUp = get("browInnerUp");
  const mouthOpen   = get("mouthOpen");
  const noseSneer   = (get("noseSneerLeft") + get("noseSneerRight")) / 2;
  const cheekSquint = (get("cheekSquintLeft") + get("cheekSquintRight")) / 2;

  const happy    = Math.min(1, mouthSmile * 2.2 + cheekSquint * 0.5);
  const sad      = Math.min(1, mouthFrown * 2.5 + browInnerUp * 0.6);
  const angry    = Math.min(1, browDown * 2.0 + noseSneer * 0.8);
  const surprised = Math.min(1, browInnerUp * 2.0 + mouthOpen * 0.8);
  const fearful  = Math.min(1, browInnerUp * 1.2 + browDown * 0.4);
  const disgusted = Math.min(1, noseSneer * 2.5);
  const raw_sum  = happy + sad + angry + surprised + fearful + disgusted;
  const neutral  = Math.max(0, 1 - raw_sum * 0.8);

  const total = happy + sad + angry + surprised + fearful + disgusted + neutral || 1;
  return {
    happy: happy / total, sad: sad / total, angry: angry / total,
    surprised: surprised / total, fearful: fearful / total,
    disgusted: disgusted / total, neutral: neutral / total,
  };
}

// Extract Euler angles from 4x4 transformation matrix
function headPose(m: number[]): { pitch: number; yaw: number; roll: number } {
  const pitch = Math.atan2(-m[9], m[10]) * 180 / Math.PI;
  const yaw   = Math.atan2(m[8], Math.sqrt(m[9] ** 2 + m[10] ** 2)) * 180 / Math.PI;
  const roll  = Math.atan2(m[4], m[0]) * 180 / Math.PI;
  return { pitch: +pitch.toFixed(1), yaw: +yaw.toFixed(1), roll: +roll.toFixed(1) };
}

type Props = { onEmotion?: (e: EmotionScores, score: number, eyeOpen: number) => void };

export default function FaceCam({ onEmotion }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<any>(null);
  const rafRef     = useRef<number>(0);
  const smoothRef  = useRef<EmotionScores | null>(null);
  const blinkBuf   = useRef<number[]>([]);
  const lastSend   = useRef(0);
  const lastTs     = useRef(0);

  const [phase, setPhase] = useState<"idle" | "loading" | "active">("idle");
  const [error, setError]     = useState("");
  const [emotions, setEmotions]   = useState<EmotionScores | null>(null);
  const [pose, setPose]       = useState<{ pitch: number; yaw: number; roll: number } | null>(null);
  const [eyeOpen, setEyeOpen] = useState(1);
  const [perclos, setPerclos] = useState(0);
  const [faceFound, setFaceFound] = useState(false);

  async function start() {
    setError("");
    setPhase("loading");
    try {
      const { FaceLandmarker, FilesetResolver, DrawingUtils } = await import("@mediapipe/tasks-vision");

      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      const landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO" as any,
        numFaces: 1,
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
      landmarkerRef.current = { landmarker, FaceLandmarker, DrawingUtils };

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
        : `Error: ${e?.message ?? String(e)}`;
      setError(msg);
      setPhase("idle");
    }
  }

  function stop() {
    cancelAnimationFrame(rafRef.current);
    const v = videoRef.current;
    if (v?.srcObject) (v.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setPhase("idle"); setEmotions(null); setFaceFound(false); setPose(null);
    smoothRef.current = null; blinkBuf.current = []; lastTs.current = 0;
  }

  const detect = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    const ref = landmarkerRef.current;
    if (!v || !c || !ref || v.readyState < 2 || !v.videoWidth || !v.videoHeight) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }

    const { landmarker, FaceLandmarker } = ref;
    // VIDEO mode requires strictly monotonically increasing timestamps
    const ts = Math.max(performance.now(), lastTs.current + 1);
    lastTs.current = ts;

    let results: any;
    try {
      results = landmarker.detectForVideo(v, ts);
    } catch (err: any) {
      // Skip frame on transient errors (GPU context loss, etc.)
      rafRef.current = requestAnimationFrame(detect);
      return;
    }

    // Sync canvas
    if (c.width !== v.clientWidth || c.height !== v.clientHeight) {
      c.width = v.clientWidth;
      c.height = v.clientHeight;
    }

    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);

    if (!results?.faceLandmarks?.length) {
      setFaceFound(false);
      rafRef.current = requestAnimationFrame(detect);
      return;
    }

    setFaceFound(true);
    const landmarks = results.faceLandmarks[0];
    const blendshapes: { categoryName: string; score: number }[] =
      results.faceBlendshapes?.[0]?.categories ?? [];
    const matrix: number[] = results.facialTransformationMatrixes?.[0]?.data ?? [];

    // ── DRAW FACE MESH ──
    // Canvas is NOT CSS-mirrored but video IS → flip X coords
    const W = c.width, H = c.height;
    if (!W || !H) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }

    // Helper: normalized landmark → canvas pixel (with x-mirror)
    const px = (lm: { x: number; y: number; z?: number }) => ({
      x: (1 - lm.x) * W,
      y: lm.y * H,
    });

    // Draw tessellation (full mesh lines)
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 0.5;
    FaceLandmarker.FACE_LANDMARKS_TESSELATION.forEach(({ start, end }: { start: number; end: number }) => {
      const a = px(landmarks[start]);
      const b = px(landmarks[end]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });

    // Get dominant emotion color
    const emo = blendshapesToEmotions(blendshapes);
    const dom = Object.entries(emo).sort(([, a], [, b]) => (b as number) - (a as number))[0];
    const color = EMOTION_COLORS[dom[0]] ?? "#f59e0b";

    // Draw eye outlines
    const drawConnectors = (indices: { start: number; end: number }[], col: string, lw = 1.5) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      indices.forEach(({ start, end }) => {
        const a = px(landmarks[start]);
        const b = px(landmarks[end]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
    };
    drawConnectors(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, "#4ade80", 1.5);
    drawConnectors(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, "#4ade80", 1.5);
    drawConnectors(FaceLandmarker.FACE_LANDMARKS_LIPS, color, 1.5);
    drawConnectors(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, "rgba(255,255,255,0.4)", 1);
    drawConnectors(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, "#fbbf24", 1.5);
    drawConnectors(FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, "#fbbf24", 1.5);

    // ── BLENDSHAPES → EMOTIONS ──
    const smoothed = smoothRef.current
      ? (() => {
          const r: any = {};
          Object.keys(emo).forEach(k => r[k] = 0.25 * (emo as any)[k] + 0.75 * (smoothRef.current as any)[k]);
          return r as EmotionScores;
        })()
      : emo;
    smoothRef.current = smoothed;
    setEmotions(smoothed);

    // ── BLINK / PERCLOS ──
    const blinkL = blendshapes.find(b => b.categoryName === "eyeBlinkLeft")?.score ?? 0;
    const blinkR = blendshapes.find(b => b.categoryName === "eyeBlinkRight")?.score ?? 0;
    const avgBlink = (blinkL + blinkR) / 2;
    const openness = 1 - avgBlink;
    setEyeOpen(openness);

    blinkBuf.current.push(avgBlink);
    if (blinkBuf.current.length > 900) blinkBuf.current.shift(); // ~30s at 30fps
    const pc = blinkBuf.current.filter(b => b > 0.7).length / blinkBuf.current.length;
    setPerclos(pc);

    // ── HEAD POSE ──
    if (matrix.length >= 16) {
      setPose(headPose(matrix));
    }

    // ── SEND TO BACKEND ──
    const now = Date.now();
    if (now - lastSend.current > SEND_INTERVAL) {
      lastSend.current = now;
      const score = emotionRiskScore(smoothed);
      onEmotion?.(smoothed, score, openness);
      fetch(`${API_URL}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "emotion",
          timestamp: new Date().toISOString(),
          ...smoothed,
          eye_openness: +openness.toFixed(3),
          perclos: +pc.toFixed(3),
          head_pitch: matrix.length >= 16 ? headPose(matrix).pitch : 0,
        }),
      }).catch(() => {});
    }

    rafRef.current = requestAnimationFrame(detect);
  }, [onEmotion]);

  useEffect(() => {
    if (phase !== "active") return;
    rafRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, detect]);

  const dom = emotions
    ? Object.entries(emotions).sort(([, a], [, b]) => (b as number) - (a as number))[0] as [string, number]
    : null;
  const domColor = dom ? EMOTION_COLORS[dom[0]] : "var(--amber)";

  const eyeStatus = eyeOpen > 0.75 ? "Alert" : eyeOpen > 0.5 ? "Tired" : "Drowsy";
  const eyeColor  = eyeOpen > 0.75 ? "#22c55e" : eyeOpen > 0.5 ? "#f59e0b" : "#ef4444";
  const perclosWarning = perclos > 0.2;

  const poseLabel = pose ? [
    Math.abs(pose.pitch) > 15 ? (pose.pitch < 0 ? "Head down" : "Head up") : null,
    Math.abs(pose.yaw) > 20 ? (pose.yaw > 0 ? "Looking right" : "Looking left") : null,
  ].filter(Boolean).join(" · ") || "Head centered" : "";

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

      {/* Camera + overlay */}
      <div className="relative bg-black" style={{ aspectRatio: "4/3", minHeight: 200 }}>
        <video ref={videoRef} muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: phase === "active" ? "block" : "none", transform: "scaleX(-1)" }}
        />
        <canvas ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ display: phase === "active" ? "block" : "none" }}
        />

        {/* Idle / loading */}
        {phase !== "active" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)" }}>
              {phase === "loading"
                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader size={22} color="var(--amber)" /></motion.div>
                : <Camera size={22} color="var(--amber)" />}
            </div>
            {phase !== "loading" && (
              <button onClick={start}
                className="px-5 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: "var(--amber)" }}>
                Enable Camera
              </button>
            )}
            {phase === "loading" && (
              <div className="text-center">
                <p className="text-xs font-medium" style={{ color: "var(--amber)" }}>Loading MediaPipe AI...</p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>478 landmarks · 52 blendshapes · GPU accelerated</p>
              </div>
            )}
            <p className="text-xs text-center" style={{ color: "var(--muted)" }}>All processing runs locally</p>
            {error && <p className="text-xs text-center text-red-400 max-w-xs">{error}</p>}
          </div>
        )}

        {/* Active overlays */}
        {phase === "active" && (
          <>
            {/* Dominant emotion badge */}
            {dom && faceFound && (
              <motion.div key={dom[0]} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg text-xs font-bold"
                style={{ background: "rgba(0,0,0,0.82)", color: domColor, border: `1px solid ${domColor}44` }}>
                {dom[0].toUpperCase()} {((dom[1] as number) * 100).toFixed(0)}%
              </motion.div>
            )}

            {/* Eye status top-left */}
            {faceFound && (
              <div className="absolute top-2 left-2 px-2 py-1 rounded-lg text-xs flex items-center gap-1.5"
                style={{ background: "rgba(0,0,0,0.75)", color: eyeColor }}>
                <Eye size={11} /> {eyeStatus}
              </div>
            )}

            {/* Head pose top-center */}
            {pose && faceFound && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-xs"
                style={{ background: "rgba(0,0,0,0.75)", color: "var(--muted)" }}>
                {poseLabel}
              </div>
            )}

            {/* PERCLOS warning */}
            {perclosWarning && (
              <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute bottom-2 right-2 px-2 py-1 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(239,68,68,0.9)", color: "#fff" }}>
                HIGH DROWSINESS
              </motion.div>
            )}

            {!faceFound && (
              <div className="absolute inset-0 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.45)" }}>
                <p className="text-xs" style={{ color: "var(--muted)" }}>Move closer to camera</p>
              </div>
            )}
            <button onClick={stop} className="absolute top-2 right-2 p-1.5 rounded-lg"
              style={{ background: "rgba(0,0,0,0.65)" }}>
              <CameraOff size={13} color="#fff" />
            </button>
          </>
        )}
      </div>

      {/* Data panels */}
      <AnimatePresence>
        {emotions && faceFound && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="p-3 flex flex-col gap-2">

            {/* Eye + head pose row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg p-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-1 mb-1">
                  <Eye size={10} color={eyeColor} />
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Eye openness</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <motion.div className="h-full rounded-full" style={{ background: eyeColor }}
                    initial={{ width: "0%" }} animate={{ width: `${eyeOpen * 100}%` }}
                    transition={{ duration: 0.3 }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs" style={{ color: eyeColor }}>{eyeStatus}</span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    PERCLOS {(perclos * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {pose && (
                <div className="rounded-lg p-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-1 mb-1">
                    <Activity size={10} color="var(--muted)" />
                    <span className="text-xs" style={{ color: "var(--muted)" }}>Head pose</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[["P", pose.pitch, "#60a5fa"], ["Y", pose.yaw, "#f59e0b"], ["R", pose.roll, "#a855f7"]].map(([l, v, c]) => (
                      <div key={l as string} className="text-center">
                        <div className="text-xs" style={{ color: c as string, fontWeight: 600 }}>
                          {(v as number).toFixed(0)}°
                        </div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs mt-1 truncate" style={{ color: "var(--muted)" }}>{poseLabel}</p>
                </div>
              )}
            </div>

            {/* Emotion bars */}
            <div className="flex flex-col gap-1">
              {EMOTION_ORDER.map(name => {
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
                      <motion.div className="h-full rounded-full"
                        style={{ background: EMOTION_COLORS[name] }}
                        initial={{ width: "0%" }}
                        animate={{ width: `${pct.toFixed(1)}%` }}
                        transition={{ duration: 0.25 }} />
                    </div>
                    <span className="text-xs tabular-nums w-7 text-right"
                      style={{ color: isDom ? domColor : "var(--muted)" }}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
