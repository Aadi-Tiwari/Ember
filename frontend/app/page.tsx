"use client";
import { useState, useEffect } from "react";
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
      <header className="sticky top-0 z-40" style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <Activity size={14} color="var(--amber)" />
            </div>
            <span className="text-sm font-semibold tracking-tight">PulseCheck</span>
            {sessionActive && <LiveBadge connected={live.state.connected} waiting={live.state.waiting} />}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0.5 p-1 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {(["scan", "counselor"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                style={{ background: tab === t ? "var(--surface-2)" : "transparent", color: tab === t ? "var(--text)" : "var(--muted)" }}>
                {t === "counselor" ? "Counselor" : "My Scan"}
              </button>
            ))}
          </div>

          {/* Privacy */}
          <div className="flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
            <Shield size={11} />
            <span className="text-xs">On-device only</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          {tab === "scan" ? (
            <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* IDLE */}
              {!sessionActive && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
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

                  {/* Feature chips */}
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    {[
                      { icon: Eye, label: "Face" },
                      { icon: Mic, label: "Voice" },
                      { icon: Mouse, label: "Activity" },
                    ].map(({ icon: Icon, label }) => (
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-8">

                  {/* Vitals strip */}
                  {displayVitals && (
                    <div className="flex items-center gap-6 text-xs" style={{ color: "var(--muted)" }}>
                      <span>
                        <span className="tabular font-semibold" style={{ color: "var(--text)" }}>{displayVitals.mouse_velocity.toFixed(0)}</span>
                        {" "}px/s mouse
                      </span>
                      <span>
                        <span className="tabular font-semibold" style={{ color: displayVitals.key_rate < 60 ? "var(--amber)" : "var(--text)" }}>
                          {displayVitals.key_rate.toFixed(0)}
                        </span>
                        {" "}kpm keys
                      </span>
                      <span>
                        <span className="tabular font-semibold" style={{ color: displayVitals.idle_ratio > 0.55 ? "var(--amber)" : "var(--text)" }}>
                          {(displayVitals.idle_ratio * 100).toFixed(0)}%
                        </span>
                        {" "}idle
                      </span>
                    </div>
                  )}

                  {/* Three panels */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FaceCam />
                    <VoicePanel active={sessionActive} />

                    {/* Score panel */}
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

                  {/* Resources */}
                  {hasScore && live.state.riskScore! >= 60 && (
                    <ResourceCard riskScore={live.state.riskScore!} />
                  )}

                  {/* End session */}
                  <div className="flex justify-center pt-2 pb-4">
                    <button onClick={stopSession} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer transition-colors"
                      style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}>
                      <Square size={11} />
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

// ── Counselor View ──────────────────────────────────────────────────────────

type StudentRow = {
  id: string; score: number; trend: string;
  last_active: string; days_to_threshold: number | null; is_live?: boolean;
};

function scoreColor(s: number) {
  return s < 30 ? "var(--green)" : s < 60 ? "var(--amber)" : s < 80 ? "var(--orange)" : "var(--red)";
}

function CounselorView() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const load = () => {
    fetch(`${API}/counselor-data`)
      .then(r => r.json())
      .then(d => { setRows(d.students ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0;
  const highRisk = rows.filter(r => r.score >= 70).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-8">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Counselor Dashboard</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Anonymized scores only. No message content.</p>
        </div>
        <button onClick={load} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}>
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Sessions", value: rows.length || "--", color: "var(--text)" },
          { label: "Average", value: rows.length ? avg : "--", color: rows.length ? scoreColor(avg) : "var(--muted)" },
          { label: "High risk", value: highRisk, color: highRisk > 0 ? "var(--red)" : "var(--green)" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-3xl font-bold tabular" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {!loading && rows.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ border: "1px solid var(--border)" }}>
          <p className="text-sm font-medium">No sessions yet</p>
          <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>
            Complete a scan in "My Scan" to see anonymized data here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {/* Column headers */}
          <div className="grid grid-cols-5 px-5 py-3 text-xs font-medium tracking-wider uppercase"
            style={{ background: "var(--surface)", color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
            <span>User</span><span>Score</span><span>Trend</span><span>Est. days</span><span>Last seen</span>
          </div>

          {rows.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
              className="grid grid-cols-5 px-5 py-4 items-center text-sm"
              style={{
                background: r.is_live ? "rgba(245,158,11,0.04)" : i % 2 === 0 ? "var(--surface)" : "transparent",
                borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none",
                borderLeft: r.is_live ? "2px solid rgba(245,158,11,0.4)" : "2px solid transparent",
              }}>
              <span className="font-mono text-xs flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                {r.id.slice(0, 8)}
                {r.is_live && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                    style={{ background: "rgba(245,158,11,0.12)", color: "var(--amber)" }}>live</span>
                )}
              </span>
              <span className="font-bold tabular" style={{ color: scoreColor(r.score) }}>{r.score}</span>
              <span className="text-xs" style={{ color: r.trend === "rising" ? "var(--red)" : r.trend === "falling" ? "var(--green)" : "var(--muted)" }}>
                {r.trend === "rising" ? "Rising" : r.trend === "falling" ? "Improving" : "Stable"}
              </span>
              <span className="text-xs tabular" style={{ color: "var(--muted)" }}>
                {r.days_to_threshold ? `~${r.days_to_threshold}d` : "--"}
              </span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{r.last_active}</span>
            </motion.div>
          ))}
        </div>
      )}

      {/* Privacy note */}
      <div className="flex items-start gap-3 rounded-2xl p-4"
        style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.15)" }}>
        <Shield size={14} color="var(--amber)" className="shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          User IDs are one-way hashed. All scoring is derived from face, voice, and activity patterns only. No audio, video, or text is ever stored or transmitted.
        </p>
      </div>
    </motion.div>
  );
}
