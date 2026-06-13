"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Shield, Play, Square, Eye, Mic, Mouse } from "lucide-react";
import BurnoutGauge from "../components/BurnoutGauge";
import SensorGrid from "../components/SensorGrid";
import ResourceCard from "../components/ResourceCard";
import LiveBadge from "../components/LiveBadge";
import FaceCam from "../components/FaceCam";
import VoicePanel from "../components/VoicePanel";
import AttentionWeights from "../components/AttentionWeights";
import { useLiveStream } from "../hooks/useLiveStream";
import { useActivityTracker } from "../hooks/useActivityTracker";

export default function Home() {
  const [sessionActive, setSessionActive] = useState(false);
  const live        = useLiveStream();
  const localVitals = useActivityTracker(sessionActive);

  function startSession() {
    setSessionActive(true);
    live.connect();
  }

  function stopSession() {
    setSessionActive(false);
    live.disconnect();
  }

  const displayVitals = live.state.vitals ?? (localVitals
    ? { mouse_velocity: localVitals.mouse_velocity_px_s, key_rate: localVitals.key_rate_per_min, idle_ratio: localVitals.idle_ratio }
    : null);

  const hasScore = live.state.riskScore !== null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">

          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
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

          {/* IDLE */}
          {!sessionActive && (
            <motion.div key="idle" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}
              className="flex flex-col items-center text-center gap-10 py-20">

              <div className="flex flex-col gap-4 max-w-md">
                <h1 className="text-5xl font-bold tracking-tight leading-tight">
                  Burnout,<br />
                  <span style={{ color: "var(--amber)" }}>detected early.</span>
                </h1>
                <p className="text-base leading-relaxed" style={{ color: "var(--muted)" }}>
                  Real-time face, voice, and activity analysis. Everything runs locally. Nothing is recorded.
                </p>
              </div>

              <motion.button onClick={startSession} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-semibold cursor-pointer"
                style={{ background: "var(--amber)", color: "#000" }}>
                <Play size={15} fill="currentColor" />
                Start Session
              </motion.button>

              <div className="flex items-center gap-2 flex-wrap justify-center">
                {[{ icon: Eye, label: "Face" }, { icon: Mic, label: "Voice" }, { icon: Mouse, label: "Activity" }].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                    <Icon size={11} />
                    {label}
                  </div>
                ))}
                <span className="text-xs" style={{ color: "var(--muted-2)" }}>No data leaves this device</span>
              </div>
            </motion.div>
          )}

          {/* ACTIVE SESSION */}
          {sessionActive && (
            <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }} className="flex flex-col gap-8">

              {/* Vitals strip */}
              {displayVitals && (
                <div className="flex items-center gap-6 text-xs" style={{ color: "var(--muted)" }}>
                  <span>
                    <span className="tabular font-semibold" style={{ color: "var(--text)" }}>
                      {displayVitals.mouse_velocity.toFixed(0)}
                    </span>{" "}px/s mouse
                  </span>
                  <span>
                    <span className="tabular font-semibold"
                      style={{ color: displayVitals.key_rate < 60 ? "var(--amber)" : "var(--text)" }}>
                      {displayVitals.key_rate.toFixed(0)}
                    </span>{" "}kpm keys
                  </span>
                  <span>
                    <span className="tabular font-semibold"
                      style={{ color: displayVitals.idle_ratio > 0.55 ? "var(--amber)" : "var(--text)" }}>
                      {(displayVitals.idle_ratio * 100).toFixed(0)}%
                    </span>{" "}idle
                  </span>
                </div>
              )}

              {/* Three panels */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FaceCam />
                <VoicePanel active={sessionActive} />

                {/* Score */}
                <div className="rounded-2xl flex flex-col items-center justify-center gap-4 p-6"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", minHeight: 200 }}>
                  <div className="flex items-center gap-2">
                    <motion.div className="w-1.5 h-1.5 rounded-full"
                      style={{ background: hasScore ? "var(--green)" : "var(--amber)" }}
                      animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {hasScore ? "Live score" : "Warming up..."}
                    </span>
                  </div>
                  <BurnoutGauge score={live.state.riskScore} animating={!hasScore} />
                </div>
              </div>

              {/* Sensor readings */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium tracking-wider uppercase" style={{ color: "var(--muted)" }}>
                  Sensor Readings
                </p>
                <SensorGrid readings={live.state.readings} isRunning={!hasScore} />
              </div>

              {/* Why this score */}
              {live.state.attentionWeights.length > 0 && (
                <AttentionWeights weights={live.state.attentionWeights} divergenceDaysAgo={null} />
              )}

              {/* Resources at high risk */}
              {hasScore && live.state.riskScore! >= 60 && (
                <ResourceCard riskScore={live.state.riskScore!} />
              )}

              {/* End session */}
              <div className="flex justify-center pt-2 pb-4">
                <button onClick={stopSession}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer"
                  style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}>
                  <Square size={11} />
                  End session
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
