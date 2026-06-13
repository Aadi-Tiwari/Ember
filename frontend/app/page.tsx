"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Shield, RotateCcw, Play, Square } from "lucide-react";
import BurnoutGauge from "../components/BurnoutGauge";
import SensorGrid from "../components/SensorGrid";
import ResourceCard from "../components/ResourceCard";
import LiveBadge from "../components/LiveBadge";
import VitalsRow from "../components/VitalsRow";
import FaceCam from "../components/FaceCam";
import VoicePanel from "../components/VoicePanel";
import AttentionWeights from "../components/AttentionWeights";
import { useLiveStream } from "../hooks/useLiveStream";
import { useActivityTracker } from "../hooks/useActivityTracker";

type Tab = "scan" | "counselor";

export default function Home() {
  const [tab, setTab] = useState<Tab>("scan");
  const [sessionActive, setSessionActive] = useState(false);
  const live = useLiveStream();
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
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(13,13,13,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            <Activity size={16} color="var(--amber)" />
          </div>
          <span className="font-semibold text-sm tracking-tight">PulseCheck</span>
          {sessionActive && <LiveBadge connected={live.state.connected} waiting={live.state.waiting} />}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {(["scan", "counselor"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: tab === t ? "var(--surface-2)" : "transparent",
                color: tab === t ? "var(--text)" : "var(--muted)",
              }}
            >
              {t === "counselor" ? "Counselor View" : "My Scan"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <Shield size={12} />
          <span className="text-xs">Nothing leaves your device</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {tab === "scan" ? (
            <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">

              {/* IDLE STATE */}
              {!sessionActive && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-8 py-16">
                  <div className="text-center flex flex-col gap-3">
                    <h1 className="text-4xl font-bold tracking-tight">
                      Your mental{" "}
                      <span style={{ color: "var(--amber)" }}>check engine light</span>
                    </h1>
                    <p className="text-base max-w-lg mx-auto leading-relaxed" style={{ color: "var(--muted)" }}>
                      PulseCheck reads your face, voice, and movement to detect burnout
                      before you feel it. No text. No messages. No data leaves this device.
                    </p>
                  </div>

                  <motion.button
                    onClick={startSession}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-3 px-10 py-4 rounded-2xl text-base font-semibold"
                    style={{
                      background: "linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(239,68,68,0.12) 100%)",
                      border: "1px solid rgba(245,158,11,0.45)",
                      color: "var(--amber)",
                    }}
                  >
                    <Play size={20} />
                    Start Session
                  </motion.button>

                  <div className="grid grid-cols-3 gap-4 max-w-lg text-center">
                    {[
                      { icon: "👁", label: "Face", desc: "Emotion detection" },
                      { icon: "🎤", label: "Voice", desc: "Energy + affect" },
                      { icon: "🖱", label: "Activity", desc: "Mouse + keyboard" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl p-4 flex flex-col gap-1.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                        <span className="text-2xl">{s.icon}</span>
                        <span className="text-sm font-medium">{s.label}</span>
                        <span className="text-xs" style={{ color: "var(--muted)" }}>{s.desc}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ACTIVE SESSION */}
              {sessionActive && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">

                  {/* Vitals bar */}
                  {displayVitals && <VitalsRow vitals={displayVitals} />}

                  {/* Top row: camera + voice + gauge */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FaceCam />
                    <VoicePanel active={sessionActive} />

                    {/* Gauge */}
                    <div
                      className="rounded-2xl p-5 flex flex-col items-center justify-center gap-3"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-2 self-start">
                        <motion.div
                          className="w-2 h-2 rounded-full"
                          style={{ background: hasScore ? "#22c55e" : "var(--amber)" }}
                          animate={{ opacity: [1, 0.4, 1] }}
                          transition={{ duration: 1.4, repeat: Infinity }}
                        />
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          {hasScore ? "Live risk score" : "Warming up..."}
                        </span>
                      </div>
                      <BurnoutGauge score={live.state.riskScore} animating={!hasScore} />
                    </div>
                  </div>

                  {/* Sensor cards - always visible, skeletons while waiting */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold">Sensor Readings</h2>
                      {!hasScore && (
                        <span className="text-xs" style={{ color: "var(--muted)" }}>
                          Collecting data...
                        </span>
                      )}
                    </div>
                    <SensorGrid
                      readings={live.state.readings}
                      isRunning={!hasScore}
                    />
                  </div>

                  {/* Attention weights - show once we have data */}
                  {live.state.attentionWeights.length > 0 && (
                    <AttentionWeights
                      weights={live.state.attentionWeights}
                      divergenceDaysAgo={null}
                    />
                  )}

                  {/* Resources at high risk */}
                  {hasScore && live.state.riskScore! >= 60 && (
                    <ResourceCard riskScore={live.state.riskScore!} />
                  )}

                  {/* End session */}
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={stopSession}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
                    >
                      <Square size={13} />
                      End session
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <CounselorView key="counselor" />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ---------- Counselor View ----------

type StudentRow = { id: string; score: number; trend: string; last_active: string; days_to_threshold: number | null; is_live?: boolean };

function getColor(s: number) {
  return s < 30 ? "#22c55e" : s < 60 ? "#f59e0b" : s < 80 ? "#f97316" : "#ef4444";
}

function CounselorView() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const load = () => {
    fetch(`${API}/counselor-data`).then(r => r.json()).then(d => { setRows(d.students ?? []); setLoading(false); }).catch(() => setLoading(false));
  };

  useState(() => { load(); const t = setInterval(load, 10_000); return () => clearInterval(t); });

  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0;
  const highRisk = rows.filter(r => r.score >= 70).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">Counselor Dashboard</h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Real scores only. No message content accessible.</p>
        </div>
        <button onClick={load} className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>Refresh</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Users", value: rows.length, color: "var(--text)" },
          { label: "Avg score", value: rows.length ? avg : "--", color: rows.length ? getColor(avg) : "var(--muted)" },
          { label: "High risk", value: highRisk, color: highRisk > 0 ? "#ef4444" : "#22c55e" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{c.label}</div>
          </div>
        ))}
      </div>

      {!loading && rows.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-medium mb-2">No sessions yet</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Start a session in "My Scan" - your anonymized score will appear here.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-5 px-5 py-3 text-xs font-medium" style={{ background: "var(--surface)", color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
            <span>User ID</span><span>Score</span><span>Trend</span><span>Days</span><span>Last active</span>
          </div>
          {rows.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
              className="grid grid-cols-5 px-5 py-4 text-sm items-center"
              style={{ background: r.is_live ? "rgba(245,158,11,0.05)" : i % 2 === 0 ? "var(--surface)" : "var(--surface-2)", borderBottom: "1px solid var(--border)", borderLeft: r.is_live ? "2px solid rgba(245,158,11,0.5)" : "2px solid transparent" }}
            >
              <span className="font-mono text-xs flex items-center gap-1.5">
                {r.id}
                {r.is_live && <span className="px-1 rounded text-xs" style={{ background: "rgba(245,158,11,0.15)", color: "var(--amber)" }}>live</span>}
              </span>
              <span className="font-bold tabular-nums" style={{ color: getColor(r.score) }}>{r.score}</span>
              <span className="text-xs" style={{ color: r.trend === "rising" ? "#ef4444" : r.trend === "falling" ? "#22c55e" : "var(--muted)" }}>
                {r.trend === "rising" ? "Rising" : r.trend === "falling" ? "Improving" : "Stable"}
              </span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{r.days_to_threshold ? `~${r.days_to_threshold}d` : "None"}</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{r.last_active}</span>
            </motion.div>
          ))}
        </div>
      )}

      <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <Shield size={16} color="var(--amber)" className="shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          User IDs are one-way hashed. Scores are derived from face, voice, and activity patterns only. No audio, video, or text is stored or transmitted.
        </p>
      </div>
    </motion.div>
  );
}
