"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Shield, Play, Eye, Mic, MessageSquare, ChevronRight } from "lucide-react";
import LiveBadge from "../components/LiveBadge";
import FaceCam from "../components/FaceCam";
import VoicePanel from "../components/VoicePanel";
import ChatPanel from "../components/ChatPanel";
import Evaluate from "../components/Evaluate";
import { useLiveStream } from "../hooks/useLiveStream";
import { useActivityTracker } from "../hooks/useActivityTracker";

type Tab = "camera" | "voice" | "chat";

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

const TABS: { id: Tab; icon: React.ElementType; label: string }[] = [
  { id: "camera", icon: Eye,           label: "Camera" },
  { id: "voice",  icon: Mic,           label: "Voice"  },
  { id: "chat",   icon: MessageSquare, label: "Chat"   },
];

export default function Home() {
  const [sessionActive, setSessionActive] = useState(false);
  const [activeTab, setActiveTab]         = useState<Tab>("camera");
  const [showEvaluate, setShowEvaluate]   = useState(false);

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

      {/* ── Floating pill header ── */}
      <div className="sticky top-0 z-40 px-6 py-3"
        style={{ background: "rgba(10,10,10,0.6)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

            {/* Logo */}
            <div className="flex items-center gap-2.5 min-w-[120px]">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <Activity size={12} color="var(--amber)" />
              </div>
              <span className="text-sm font-semibold tracking-tight">Ember</span>
            </div>

            {/* Center: tabs when active, privacy when idle */}
            <div className="flex items-center justify-center">
              {sessionActive ? (
                <div className="flex items-center gap-0.5 p-0.5 rounded-xl"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  {TABS.map(({ id, icon: Icon, label }) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                      style={{
                        background: activeTab === id ? "var(--surface)" : "transparent",
                        color:      activeTab === id ? "var(--text)"    : "var(--muted)",
                      }}>
                      <Icon size={11} />
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                  <Shield size={11} />
                  <span className="text-xs">On-device only</span>
                </div>
              )}
            </div>

            {/* Right: score + evaluate OR live badge */}
            <div className="flex items-center gap-3 min-w-[120px] justify-end">
              {sessionActive ? (
                <>
                  {hasScore && (
                    <div className="flex items-center gap-1.5">
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
                      opacity:    hasScore ? 1 : 0.6,
                    }}>
                    Evaluate
                    {hasScore && <ChevronRight size={11} />}
                  </button>
                </>
              ) : (
                <LiveBadge connected={false} waiting={false} />
              )}
            </div>
          </div>
        </div>
      </div>

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
                {TABS.map(({ id, icon: Icon, label }) => (
                  <div key={id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                    <Icon size={11} />
                    {label}
                  </div>
                ))}
                <span className="text-xs" style={{ color: "var(--muted-2)" }}>Nothing leaves your device</span>
              </div>
            </motion.div>
          )}

          {/* ── ACTIVE SESSION ── */}
          {sessionActive && (
            <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col gap-6">

              {/* Vitals strip */}
              {vitals && (
                <div className="flex items-center gap-5 text-xs" style={{ color: "var(--muted)" }}>
                  <span>
                    <span className="tabular font-semibold" style={{ color: "var(--text)" }}>{vitals.mouse_velocity.toFixed(0)}</span> px/s
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
                  <span className="ml-auto flex items-center gap-1.5">
                    <LiveBadge connected={live.state.connected} waiting={live.state.waiting} />
                  </span>
                </div>
              )}

              {/* Tab content */}
              <AnimatePresence mode="wait">
                <motion.div key={activeTab}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>

                  {activeTab === "camera" && (
                    <div className="max-w-sm mx-auto">
                      <FaceCam />
                    </div>
                  )}

                  {activeTab === "voice" && (
                    <div className="max-w-sm mx-auto">
                      <VoicePanel active={activeTab === "voice"} />
                    </div>
                  )}

                  {activeTab === "chat" && (
                    <div className="max-w-xl mx-auto">
                      <ChatPanel active={activeTab === "chat"} />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Bottom hint */}
              <p className="text-xs text-center" style={{ color: "var(--muted-2)" }}>
                {activeTab === "camera" && "Face and emotion data is being captured and fused into your score"}
                {activeTab === "voice"  && "Voice energy, pitch, and affect are being analyzed in real time"}
                {activeTab === "chat"   && "Your words are analyzed for emotional tone and added to your score"}
              </p>
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
