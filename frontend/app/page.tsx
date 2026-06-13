"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Shield, Play, Eye, Mic, Mouse, ChevronRight } from "lucide-react";
import LiveBadge from "../components/LiveBadge";
import FaceCam from "../components/FaceCam";
import VoicePanel from "../components/VoicePanel";
import Evaluate from "../components/Evaluate";
import { useLiveStream } from "../hooks/useLiveStream";
import { useActivityTracker } from "../hooks/useActivityTracker";

function scoreColor(s: number) {
  if (s < 30) return "#22c55e";
  if (s < 60) return "#f59e0b";
  if (s < 80) return "#f97316";
  return "#ef4444";
}
function scoreLabel(s: number) {
  if (s < 30) return "Low Risk";
  if (s < 60) return "Moderate";
  if (s < 80) return "High Risk";
  return "Critical";
}

export default function Home() {
  const [sessionActive, setSessionActive]   = useState(false);
  const [showEvaluate, setShowEvaluate]     = useState(false);
  const live        = useLiveStream();
  const localVitals = useActivityTracker(sessionActive);

  function startSession() { setSessionActive(true); live.connect(); }
  function stopSession()  { setSessionActive(false); live.disconnect(); setShowEvaluate(false); }

  const vitals = live.state.vitals ?? (localVitals
    ? { mouse_velocity: localVitals.mouse_velocity_px_s, key_rate: localVitals.key_rate_per_min, idle_ratio: localVitals.idle_ratio }
    : null);

  const hasScore = live.state.riskScore !== null;
  const score    = live.state.riskScore ?? 0;
  const color    = scoreColor(score);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <header className="sticky top-0 z-40"
        style={{ background: "rgba(10,10,10,0.88)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <Activity size={14} color="var(--amber)" />
            </div>
            <span className="text-sm font-semibold tracking-tight">PulseCheck</span>
            {sessionActive && <LiveBadge connected={live.state.connected} waiting={live.state.waiting} />}
          </div>
          <div className="flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
            <Shield size={11} />
            <span className="text-xs">On-device only</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">

          {/* ── IDLE ── */}
          {!sessionActive && (
            <motion.div key="idle"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center gap-10 py-24">

              <div className="flex flex-col gap-4 max-w-md">
                <h1 className="text-5xl font-bold tracking-tight leading-tight">
                  Burnout,<br />
                  <span style={{ color: "var(--amber)" }}>detected early.</span>
                </h1>
                <p className="text-base leading-relaxed" style={{ color: "var(--muted)" }}>
                  Real-time analysis of your face, voice, and activity. Everything runs locally. Nothing is recorded or uploaded.
                </p>
              </div>

              <motion.button onClick={startSession}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-semibold cursor-pointer"
                style={{ background: "var(--amber)", color: "#000" }}>
                <Play size={14} fill="currentColor" />
                Start Session
              </motion.button>

              <div className="flex items-center gap-2 flex-wrap justify-center">
                {[{ icon: Eye, label: "Face" }, { icon: Mic, label: "Voice" }, { icon: Mouse, label: "Activity" }].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                    <Icon size={11} /> {label}
                  </div>
                ))}
                <span className="text-xs" style={{ color: "var(--muted-2)" }}>Private by design</span>
              </div>
            </motion.div>
          )}

          {/* ── ACTIVE ── */}
          {sessionActive && (
            <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-6">

              {/* Vitals strip */}
              {vitals && (
                <div className="flex items-center gap-5 text-xs" style={{ color: "var(--muted)" }}>
                  <span>
                    <span className="tabular font-semibold" style={{ color: "var(--text)" }}>
                      {vitals.mouse_velocity.toFixed(0)}
                    </span> px/s
                  </span>
                  <span>
                    <span className="tabular font-semibold"
                      style={{ color: vitals.key_rate < 60 ? "var(--amber)" : "var(--text)" }}>
                      {vitals.key_rate.toFixed(0)}
                    </span> kpm
                  </span>
                  <span>
                    <span className="tabular font-semibold"
                      style={{ color: vitals.idle_ratio > 0.55 ? "var(--amber)" : "var(--text)" }}>
                      {(vitals.idle_ratio * 100).toFixed(0)}%
                    </span> idle
                  </span>
                </div>
              )}

              {/* Three panels */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Camera */}
                <FaceCam />

                {/* Voice */}
                <VoicePanel active={sessionActive} />

                {/* Score panel */}
                <div className="rounded-2xl flex flex-col items-center justify-center gap-5 p-6"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", minHeight: 220 }}>

                  {/* Live indicator */}
                  <div className="flex items-center gap-2">
                    <motion.div className="w-1.5 h-1.5 rounded-full"
                      style={{ background: hasScore ? color : "var(--amber)" }}
                      animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {hasScore ? "Live score" : "Warming up..."}
                    </span>
                  </div>

                  {/* Big score number */}
                  <div className="flex flex-col items-center gap-1">
                    <motion.div className="text-7xl font-bold tabular leading-none"
                      style={{ color: hasScore ? color : "var(--muted-2)" }}
                      key={score}
                      initial={{ opacity: 0.6, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.25 }}>
                      {hasScore ? score : "--"}
                    </motion.div>
                    {hasScore && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="text-sm font-medium" style={{ color }}>
                        {scoreLabel(score)}
                      </motion.span>
                    )}
                  </div>

                  {/* Score bar */}
                  {hasScore && (
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <motion.div className="h-full rounded-full" style={{ background: color }}
                        initial={{ width: 0 }} animate={{ width: `${score}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }} />
                    </div>
                  )}

                  {/* Evaluate button - always visible once session starts */}
                  <button
                    onClick={() => hasScore && setShowEvaluate(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium"
                    style={{
                      background: hasScore ? color + "15" : "var(--surface-2)",
                      border: `1px solid ${hasScore ? color + "40" : "var(--border)"}`,
                      color: hasScore ? color : "var(--muted)",
                      cursor: hasScore ? "pointer" : "default",
                      opacity: hasScore ? 1 : 0.5,
                    }}>
                    {hasScore ? "View Evaluation" : "Collecting data..."}
                    {hasScore && <ChevronRight size={12} />}
                  </button>
                </div>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Evaluate modal */}
      <Evaluate
        open={showEvaluate}
        onClose={() => setShowEvaluate(false)}
        onEndSession={() => { setShowEvaluate(false); stopSession(); }}
        score={score}
        readings={live.state.readings}
        attentionWeights={live.state.attentionWeights}
      />
    </div>
  );
}
