"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Loader, Eye, Activity, Layers } from "lucide-react";

const API_URL      = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SEND_INTERVAL = 4000;

export type EmotionScores = {
  happy: number; sad: number; angry: number;
  fearful: number; disgusted: number; surprised: number; neutral: number;
};

const EMOTION_COLORS: Record<string, string> = {
  happy: "#22c55e", sad: "#60a5fa", angry: "#ef4444",
  surprised: "#f59e0b", fearful: "#a855f7", disgusted: "#f97316", neutral: "#666",
};
const EMOTION_ORDER = ["happy", "sad", "angry", "surprised", "fearful", "disgusted", "neutral"];

export function emotionRiskScore(e: EmotionScores): number {
  const raw = e.sad * 3 + e.fearful * 2.5 + e.disgusted * 1.5 + e.angry * 1.5 + e.neutral * 0.5 - e.happy * 2;
  return Math.min(100, Math.max(0, Math.round(raw * 50)));
}

function blendshapesToEmotions(bs: { categoryName: string; score: number }[]): EmotionScores {
  const get = (n: string) => bs.find(b => b.categoryName === n)?.score ?? 0;
  const mouthSmile  = (get("mouthSmileLeft") + get("mouthSmileRight")) / 2;
  const mouthFrown  = (get("mouthFrownLeft") + get("mouthFrownRight")) / 2;
  const browDown    = (get("browDownLeft") + get("browDownRight")) / 2;
  const browInnerUp = get("browInnerUp");
  const mouthOpen   = get("mouthOpen");
  const noseSneer   = (get("noseSneerLeft") + get("noseSneerRight")) / 2;
  const cheekSquint = (get("cheekSquintLeft") + get("cheekSquintRight")) / 2;

  const happy     = Math.min(1, mouthSmile * 2.2 + cheekSquint * 0.5);
  const sad       = Math.min(1, mouthFrown * 2.5 + browInnerUp * 0.6);
  const angry     = Math.min(1, browDown * 2.0 + noseSneer * 0.8);
  const surprised = Math.min(1, browInnerUp * 2.0 + mouthOpen * 0.8);
  const fearful   = Math.min(1, browInnerUp * 1.2 + browDown * 0.4);
  const disgusted = Math.min(1, noseSneer * 2.5);
  const raw_sum   = happy + sad + angry + surprised + fearful + disgusted;
  const neutral   = Math.max(0, 1 - raw_sum * 0.8);
  const total     = raw_sum + neutral || 1;
  return {
    happy: happy/total, sad: sad/total, angry: angry/total,
    surprised: surprised/total, fearful: fearful/total,
    disgusted: disgusted/total, neutral: neutral/total,
  };
}

function headPose(m: number[]) {
  return {
    pitch: +(Math.atan2(-m[9], m[10]) * 180 / Math.PI).toFixed(1),
    yaw:   +(Math.atan2(m[8], Math.sqrt(m[9]**2 + m[10]**2)) * 180 / Math.PI).toFixed(1),
    roll:  +(Math.atan2(m[4], m[0]) * 180 / Math.PI).toFixed(1),
  };
}

type Props = { onEmotion?: (e: EmotionScores, score: number, eyeOpen: number) => void };

export default function FaceCam({ onEmotion }: Props) {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const landmarkerRef  = useRef<any>(null);
  const smoothRef      = useRef<EmotionScores | null>(null);
  const blinkBuf       = useRef<number[]>([]);
  const lastSend       = useRef(0);
  const lastVideoTime  = useRef(-1);
  const lastTsRef      = useRef(0);       // guarantees monotonic timestamps
  const showOverlayRef = useRef(true);
  const onEmotionRef   = useRef(onEmotion);

  // All state before any effects
  const [phase, setPhase]             = useState<"idle" | "loading" | "active">("idle");
  const [error, setError]             = useState("");
  const [emotions, setEmotions]       = useState<EmotionScores | null>(null);
  const [pose, setPose]               = useState<{ pitch: number; yaw: number; roll: number } | null>(null);
  const [eyeOpen, setEyeOpen]         = useState(1);
  const [perclos, setPerclos]         = useState(0);
  const [faceFound, setFaceFound]     = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => { onEmotionRef.current = onEmotion; }, [onEmotion]);

  useEffect(() => {
    showOverlayRef.current = showOverlay;
    if (!showOverlay) {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [showOverlay]);

  async function start() {
    setError(""); setPhase("loading");
    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
      );
      const landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "LIVE_STREAM",
        numFaces: 1,
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      } as any);

      landmarkerRef.current = { landmarker, FaceLandmarker };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setPhase("active");
    } catch (e: any) {
      setError(
        e?.name === "NotAllowedError" ? "Camera permission denied" :
        e?.name === "NotFoundError"   ? "No camera found" :
        `Error: ${e?.message ?? String(e)}`
      );
      setPhase("idle");
    }
  }

  function stop() {
    const v = videoRef.current;
    if (v?.srcObject) (v.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    const c = canvasRef.current;
    if (c) canvasRef.current?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    landmarkerRef.current = null;
    lastVideoTime.current = -1; lastTsRef.current = 0;
    setPhase("idle"); setEmotions(null); setFaceFound(false); setPose(null);
    smoothRef.current = null; blinkBuf.current = [];
  }

  // Pure detection - does NOT self-schedule
  const detect = useCallback(() => {
    const v   = videoRef.current;
    const c   = canvasRef.current;
    const ref = landmarkerRef.current;
    if (!v || !c || !ref || v.readyState < 2 || !v.videoWidth || !v.videoHeight) return;
    if (v.currentTime === lastVideoTime.current) return;
    lastVideoTime.current = v.currentTime;

    // Guarantee strictly increasing timestamp (fixes Windows Date.now() 15ms resolution bug)
    const ts = Math.max(performance.now(), lastTsRef.current + 1);
    lastTsRef.current = ts;

    const { landmarker, FaceLandmarker } = ref;
    let results: any;
    try { results = landmarker.detectForVideo(v, ts); }
    catch { return; }

    if (c.width !== v.clientWidth || c.height !== v.clientHeight) {
      c.width = v.clientWidth || 640; c.height = v.clientHeight || 480;
    }
    const W = c.width, H = c.height;
    const ctx = c.getContext("2d");
    if (!ctx || !W || !H) return;
    ctx.clearRect(0, 0, W, H);

    if (!results?.faceLandmarks?.length) { setFaceFound(false); return; }

    setFaceFound(true);
    const landmarks   = results.faceLandmarks[0];
    const blendshapes: { categoryName: string; score: number }[] = results.faceBlendshapes?.[0]?.categories ?? [];
    const matrix: number[] = results.facialTransformationMatrixes?.[0]?.data ?? [];
    const px = (lm: { x: number; y: number }) => ({ x: (1 - lm.x) * W, y: lm.y * H });

    const emo   = blendshapesToEmotions(blendshapes);
    const domE  = Object.entries(emo).sort(([,a],[,b]) => (b as number)-(a as number))[0];
    const color = EMOTION_COLORS[domE[0]] ?? "#f59e0b";

    if (showOverlayRef.current) {
      // Tessellation
      ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 0.5;
      FaceLandmarker.FACE_LANDMARKS_TESSELATION.forEach(({ start, end }: any) => {
        const a = px(landmarks[start]), b = px(landmarks[end]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      const line = (idx: any[], col: string, lw = 1.5) => {
        ctx.strokeStyle = col; ctx.lineWidth = lw;
        idx.forEach(({ start, end }: any) => {
          const a = px(landmarks[start]), b = px(landmarks[end]);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        });
      };
      line(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,    "#4ade80",               1.5);
      line(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,     "#4ade80",               1.5);
      line(FaceLandmarker.FACE_LANDMARKS_LIPS,          color,                   1.5);
      line(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,     "rgba(255,255,255,0.3)", 1);
      line(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, "#fbbf24",               1.5);
      line(FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,  "#fbbf24",               1.5);
    }

    // Smooth emotions
    const smoothed = smoothRef.current
      ? Object.fromEntries(Object.keys(emo).map(k => [k, 0.25*(emo as any)[k] + 0.75*(smoothRef.current as any)[k]])) as EmotionScores
      : emo;
    smoothRef.current = smoothed;
    setEmotions(smoothed);

    // PERCLOS
    const blinkL = blendshapes.find(b => b.categoryName === "eyeBlinkLeft")?.score ?? 0;
    const blinkR = blendshapes.find(b => b.categoryName === "eyeBlinkRight")?.score ?? 0;
    const avg    = (blinkL + blinkR) / 2;
    const open   = 1 - avg;
    setEyeOpen(open);
    blinkBuf.current.push(avg);
    if (blinkBuf.current.length > 900) blinkBuf.current.shift();
    const pc = blinkBuf.current.filter(b => b > 0.7).length / Math.max(blinkBuf.current.length, 1);
    setPerclos(pc);
    if (matrix.length >= 16) setPose(headPose(matrix));

    // Send to backend
    const now = Date.now();
    if (now - lastSend.current > SEND_INTERVAL) {
      lastSend.current = now;
      onEmotionRef.current?.(smoothed, emotionRiskScore(smoothed), open);
      fetch(`${API_URL}/ingest`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "emotion", timestamp: new Date().toISOString(),
          ...smoothed, eye_openness: +open.toFixed(3), perclos: +pc.toFixed(3),
          head_pitch: matrix.length >= 16 ? headPose(matrix).pitch : 0,
        }),
      }).catch(() => {});
    }
  }, []);

  // Scheduling: RAF in foreground, setInterval in background tab
  useEffect(() => {
    if (phase !== "active") return;
    let alive = true;
    let rafId  = 0;
    let bgId: ReturnType<typeof setInterval> | null = null;

    const tick = () => { if (alive) detect(); };

    const toForeground = () => {
      if (bgId) { clearInterval(bgId); bgId = null; }
      const loop = () => { if (!alive) return; tick(); rafId = requestAnimationFrame(loop); };
      rafId = requestAnimationFrame(loop);
    };
    const toBackground = () => {
      cancelAnimationFrame(rafId);
      bgId = setInterval(tick, 500); // keep running at 2fps in background
    };

    const onVisibility = () => document.hidden ? toBackground() : (cancelAnimationFrame(rafId), toForeground());
    document.addEventListener("visibilitychange", onVisibility);
    toForeground();

    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
      if (bgId) clearInterval(bgId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase, detect]);

  const dom      = emotions ? Object.entries(emotions).sort(([,a],[,b])=>(b as number)-(a as number))[0] as [string,number] : null;
  const domColor = dom ? EMOTION_COLORS[dom[0]] : "var(--amber)";
  const eyeStatus = eyeOpen > 0.75 ? "Alert" : eyeOpen > 0.5 ? "Tired" : "Drowsy";
  const eyeColor  = eyeOpen > 0.75 ? "#22c55e" : eyeOpen > 0.5 ? "#f59e0b" : "#ef4444";
  const poseLabel = pose ? (
    [
      Math.abs(pose.pitch) > 15 ? (pose.pitch < 0 ? "Head down" : "Head up") : null,
      Math.abs(pose.yaw)   > 20 ? (pose.yaw   > 0 ? "Looking right" : "Looking left") : null,
    ].filter(Boolean).join(" - ") || "Head centered"
  ) : "";

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

      {/* Camera viewport */}
      <div className="relative bg-black" style={{ aspectRatio: "4/3", minHeight: 180 }}>
        <video ref={videoRef} muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: phase === "active" ? "block" : "none", transform: "scaleX(-1)" }} />
        <canvas ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ display: phase === "active" ? "block" : "none" }} />

        {/* Idle / loading */}
        {phase !== "active" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
              {phase === "loading"
                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Loader size={18} color="var(--amber)" />
                  </motion.div>
                : <Camera size={18} color="var(--amber)" />}
            </div>
            {phase !== "loading" && (
              <button onClick={start} className="px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "var(--amber)" }}>
                Enable Camera
              </button>
            )}
            {phase === "loading" && (
              <p className="text-xs" style={{ color: "var(--muted)" }}>Loading AI model...</p>
            )}
            {error && <p className="text-xs text-red-400 max-w-xs text-center px-4">{error}</p>}
          </div>
        )}

        {/* Active overlays */}
        {phase === "active" && (
          <>
            {dom && faceFound && (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-xs font-bold"
                style={{ background: "rgba(0,0,0,0.75)", color: domColor }}>
                {dom[0].toUpperCase()} {((dom[1] as number)*100).toFixed(0)}%
              </div>
            )}
            {faceFound && (
              <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs"
                style={{ background: "rgba(0,0,0,0.7)", color: eyeColor }}>
                <Eye size={10} /> {eyeStatus}
              </div>
            )}
            {pose && faceFound && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md text-xs"
                style={{ background: "rgba(0,0,0,0.7)", color: "var(--muted)" }}>
                {poseLabel}
              </div>
            )}
            {perclos > 0.2 && (
              <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute bottom-2 right-10 px-2 py-0.5 rounded-md text-xs font-semibold"
                style={{ background: "rgba(239,68,68,0.85)", color: "#fff" }}>
                Drowsy
              </motion.div>
            )}
            {!faceFound && (
              <div className="absolute inset-0 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.4)" }}>
                <p className="text-xs" style={{ color: "var(--muted)" }}>Move closer</p>
              </div>
            )}
            {/* Controls */}
            <button onClick={() => setShowOverlay(v => !v)}
              className="absolute top-2 right-8 p-1.5 rounded-md cursor-pointer"
              style={{ background: "rgba(0,0,0,0.6)", opacity: showOverlay ? 1 : 0.5 }}
              title={showOverlay ? "Hide mesh" : "Show mesh"}>
              <Layers size={11} color="#fff" />
            </button>
            <button onClick={stop} className="absolute top-2 right-2 p-1.5 rounded-md cursor-pointer"
              style={{ background: "rgba(0,0,0,0.6)" }}>
              <CameraOff size={11} color="#fff" />
            </button>
          </>
        )}
      </div>

      {/* Emotion bars */}
      <AnimatePresence>
        {emotions && faceFound && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="p-3 flex flex-col gap-2">
            {/* Eye + pose row */}
            <div className="flex items-center justify-between text-xs" style={{ color: "var(--muted)" }}>
              <span style={{ color: eyeColor }}><Eye size={10} className="inline mr-1" />{eyeStatus} · PERCLOS {(perclos*100).toFixed(0)}%</span>
              {pose && <span>{pose.pitch.toFixed(0)}° P · {pose.yaw.toFixed(0)}° Y</span>}
            </div>
            {/* Bars */}
            {EMOTION_ORDER.map(name => {
              const val = (emotions as any)[name] as number ?? 0;
              const pct = Math.min(100, val * 100);
              const isDom = name === dom?.[0];
              return (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-xs w-14 capitalize"
                    style={{ color: isDom ? "var(--text)" : "var(--muted)", fontWeight: isDom ? 600 : 400 }}>
                    {name}
                  </span>
                  <div className="flex-1 h-px rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                    <motion.div className="h-full rounded-full" style={{ background: EMOTION_COLORS[name] }}
                      initial={{ width: "0%" }} animate={{ width: `${pct.toFixed(1)}%` }}
                      transition={{ duration: 0.2 }} />
                  </div>
                  <span className="text-xs tabular w-6 text-right" style={{ color: isDom ? domColor : "var(--muted-2)" }}>
                    {pct.toFixed(0)}
                  </span>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
