"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Eye, ScanFace, Layers } from "lucide-react";

// MediaPipe's WASM module routes its C++ stderr through console.error, producing
// "INFO: Created TensorFlow Lite XNNPACK delegate for CPU." on every detection call.
// This patches it out so Next.js dev mode doesn't surface it as an error overlay.
if (typeof window !== "undefined") {
  const _orig = console.error.bind(console);
  console.error = (...args: any[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (/^INFO:|XNNPACK|TensorFlow Lite|EGL|WebGL|MediaPipe/.test(msg)) return;
    _orig(...args);
  };
}

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

type Props = { enabled?: boolean; onEmotion?: (e: EmotionScores, score: number, eyeOpen: number) => void };

export default function FaceCam({ enabled = true, onEmotion }: Props) {
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
  const mountedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const captureRef = useRef(0);

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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      captureRef.current += 1;
      streamRef.current?.getTracks().forEach(track => track.stop());
      landmarkerRef.current?.landmarker.close();
      landmarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    showOverlayRef.current = showOverlay;
    if (!showOverlay) {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [showOverlay]);

  async function start() {
    if (!enabled || phase !== "idle") return;
    const capture = ++captureRef.current;
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
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      } as any);

      if (!mountedRef.current || capture !== captureRef.current) { landmarker.close(); return; }
      landmarkerRef.current = { landmarker, FaceLandmarker };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      if (!mountedRef.current || capture !== captureRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      if (!mountedRef.current || capture !== captureRef.current) return;
      setPhase("active");
    } catch (e: any) {
      if (!mountedRef.current || capture !== captureRef.current) return;
      streamRef.current?.getTracks().forEach(track => track.stop());
      landmarkerRef.current?.landmarker.close();
      landmarkerRef.current = null;
      if (!mountedRef.current) return;
      setError(
        e?.name === "NotAllowedError" ? "Camera permission denied" :
        e?.name === "NotFoundError"   ? "No camera found" :
        `Error: ${e?.message ?? String(e)}`
      );
      setPhase("idle");
    }
  }

  const stop = useCallback(() => {
    captureRef.current += 1;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v?.srcObject) (v.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    const c = canvasRef.current;
    if (c) canvasRef.current?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    landmarkerRef.current?.landmarker.close();
    landmarkerRef.current = null;
    lastVideoTime.current = -1; lastTsRef.current = 0;
    setPhase("idle"); setEmotions(null); setFaceFound(false); setPose(null);
    smoothRef.current = null; blinkBuf.current = [];
  }, []);

  useEffect(() => { if (!enabled) stop(); }, [enabled, stop]);

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

  const eyeStatus = eyeOpen > 0.75 ? "Open" : eyeOpen > 0.5 ? "Partly open" : "Mostly closed";
  const poseLabel = pose ? (
    [
      Math.abs(pose.pitch) > 15 ? (pose.pitch < 0 ? "Head down" : "Head up") : null,
      Math.abs(pose.yaw)   > 20 ? (pose.yaw   > 0 ? "Looking right" : "Looking left") : null,
    ].filter(Boolean).join(" - ") || "Head centered"
  ) : "";

  return <section className="panel media-panel">
    <div className="panel-heading"><div className="panel-label"><span className="icon-tile icon-mint"><ScanFace size={18} /></span><div><h3>Face</h3><p>Facial observations</p></div></div><span className={`tag ${phase === "active" ? "tag-live" : "tag-neutral"}`}>{phase === "active" ? "Camera on" : phase === "loading" ? "Connecting" : "Off"}</span></div>
    <div className={`media-viewport camera-viewport ${phase === "active" ? "camera-active" : ""}`}>
      <video ref={videoRef} muted playsInline aria-label="Your camera preview" style={{ display: phase === "active" ? "block" : "none" }} />
      <canvas ref={canvasRef} aria-hidden="true" style={{ display: phase === "active" ? "block" : "none" }} />
      {phase !== "active" && <div className="camera-placeholder" aria-hidden="true">
        <span className="scan-corner corner-tl" /><span className="scan-corner corner-tr" /><span className="scan-corner corner-bl" /><span className="scan-corner corner-br" />
        <svg viewBox="0 0 120 130"><ellipse cx="60" cy="52" rx="26" ry="34" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M21 120c0-24 17-37 39-37s39 13 39 37M47 49h3m20 0h3M60 52v13h5M50 73q10 6 20 0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><circle cx="37" cy="50" r="2" /><circle cx="84" cy="50" r="2" /><circle cx="60" cy="23" r="2" /><circle cx="60" cy="86" r="2" /></svg>
        {phase === "loading" && <span className="camera-scan" />}
      </div>}
      {phase === "active" && <>
        <span className="camera-label">{faceFound ? "Face tracked" : "Move into the frame"}</span>
        <div className="camera-tools"><button type="button" className="icon-button" onClick={() => setShowOverlay(value => !value)} aria-label={showOverlay ? "Hide face mesh" : "Show face mesh"} aria-pressed={showOverlay}><Layers size={15} /></button><button type="button" className="icon-button" onClick={stop} aria-label="Turn camera off"><CameraOff size={15} /></button></div>
      </>}
    </div>
    <div className="media-controls">
      {phase === "idle" ? <><p>{enabled ? "Add facial observations to your session." : "Start collection to enable your camera."}</p><button type="button" className="button button-secondary" onClick={start} disabled={!enabled}><Camera size={14} /> Enable camera</button></>
        : phase === "loading" ? <><p role="status">Preparing the camera model...</p><button type="button" className="button button-quiet" onClick={stop}>Cancel</button></>
        : <div className="camera-readings"><span><Eye size={14} /> {faceFound ? eyeStatus : "Waiting for a face"}</span>{faceFound && <span>{poseLabel}</span>}</div>}
      {error && <p role="alert" className="notice notice-error">{error}</p>}
    </div>
    <AnimatePresence>{emotions && faceFound && <motion.details className="feature-details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <summary>Expression features <span>Heuristic observations</span></summary>
      <div className="feature-readings">{EMOTION_ORDER.map(name => {
        const value = Math.min(100, emotions[name as keyof EmotionScores] * 100);
        return <div key={name}><span>{name}</span><div className="measurement-track"><span style={{ transform: `scaleX(${value / 100})`, background: EMOTION_COLORS[name] }} /></div><small>{value.toFixed(0)}</small></div>;
      })}<p>Eye closure: {(perclos * 100).toFixed(0)}%. Expression features do not establish how you feel.</p></div>
    </motion.details>}</AnimatePresence>
    <div className="media-privacy">Camera frames stay in this browser.</div>
  </section>;
}
