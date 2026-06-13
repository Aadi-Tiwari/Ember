"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Shield, Play, Eye, Mic, MessageSquare, X, ChevronRight,
} from "lucide-react";
import LiveBadge from "../components/LiveBadge";
import FaceCam from "../components/FaceCam";
import VoicePanel from "../components/VoicePanel";
import ChatPanel from "../components/ChatPanel";
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
  const [sessionActive, setSessionActive] = useState(false);
  const [chatOpen, setChatOpen]           = useState(false);
  const [showEvaluate, setShowEvaluate]   = useState(false);

  const live        = useLiveStream();
  const localVitals = useActivityTracker(sessionActive);

  function startSession() { setSessionActive(true); live.connect(); }
  function stopSession()  {
    setSessionActive(false);
    live.disconnect();
    setChatOpen(false);
    setShowEvaluate(false);
  }

  const vitals = live.state.vitals ?? (localVitals ? {
    mouse_velocity: localVitals.mouse_velocity_px_s,
    key_rate:       localVitals.key_rate_per_min,
    idle_ratio:     localVitals.idle_ratio,
  } : null);

  const hasScore = live.state.riskScore !== null;
  const score    = live.state.riskScore ?? 0;
  const color    = scoreColor(score);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* ── Minimal header ── */}
      <header className="sticky top-0 z-40"
        style={{ background: "rgba(10,10,10,0.88)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <Activity size={14} color="var(--amber)" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Ember</span>
            {sessionActive && <LiveBadge connected={live.state.connected} waiting={live.state.waiting} />}
          </div>

          {/* Right: score + evaluate (when active) OR privacy note */}
          <div className="flex items-center gap-3">
            {sessionActive ? (
              <>
                {hasScore && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tabular" style={{ color }}>{score}</span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>{scoreLabel(score)}</span>
                  </div>
                )}
                <button
                  onClick={() => hasScore && setShowEvaluate(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium"
                  style={{
                    background: hasScore ? color + "15" : "var(--surface-2)",
                    border:     `1px solid ${hasScore ? color + "35" : "var(--border)"}`,
                    color:      hasScore ? color : "var(--muted)",
                    cursor:     hasScore ? "pointer" : "default",
                    opacity:    hasScore ? 1 : 0.55,
                  }}>
                  Evaluate {hasScore && <ChevronRight size={11} />}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                <Shield size={11} />
                <span className="text-xs">On-device only</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
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
                  Your mental check engine light. Reads face, voice, and how you describe yourself - everything stays on your device.
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
                {[
                  { icon: Eye,            label: "Face detection"  },
                  { icon: Mic,            label: "Voice analysis"  },
                  { icon: MessageSquare,  label: "AI wellness chat" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                    <Icon size={11} /> {label}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── ACTIVE SESSION ── */}
          {sessionActive && (
            <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col gap-5">

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

              {/* Camera + Voice side by side */}
              <div className="grid grid-cols-2 gap-4">
                <FaceCam />
                <VoicePanel active={sessionActive} />
              </div>

              {/* End session */}
              <div className="flex justify-center pt-1 pb-4">
                <button onClick={stopSession}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer"
                  style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}>
                  End session
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ── Floating chat button (bottom right) ── */}
      {sessionActive && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 20 }}
          onClick={() => setChatOpen(v => !v)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl cursor-pointer"
          style={{
            background: chatOpen ? "var(--surface-2)" : "var(--amber)",
            border:     `2px solid ${chatOpen ? "var(--border)" : "var(--amber)"}`,
            boxShadow:  chatOpen ? "none" : "0 8px 32px rgba(245,158,11,0.35)",
          }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}>
          {chatOpen
            ? <X size={20} color="var(--muted)" />
            : <MessageSquare size={20} color="#000" />}
        </motion.button>
      )}

      {/* ── Chat side panel (ElevenLabs style) ── */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 bottom-0 z-40 flex flex-col"
            style={{
              width: 380,
              background: "var(--surface)",
              borderLeft: "1px solid var(--border)",
              boxShadow: "-8px 0 40px rgba(0,0,0,0.4)",
            }}>

            {/* Panel header */}
            <div className="flex items-center gap-2.5 px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "var(--amber)", fontSize: 11, fontWeight: 700, color: "#000" }}>
                E
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Ember AI</span>
                <span className="text-xs" style={{ color: "var(--muted)" }}>Wellness companion</span>
              </div>
              <button onClick={() => setChatOpen(false)}
                className="ml-auto p-1.5 rounded-lg cursor-pointer"
                style={{ color: "var(--muted)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}>
                <X size={15} />
              </button>
            </div>

            {/* Chat fills the rest */}
            <div className="flex-1 overflow-hidden">
              <ChatPanel active={chatOpen} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
