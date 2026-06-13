"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Shield, ChevronRight, RotateCcw, Zap, Radio } from "lucide-react";
import BurnoutGauge from "../components/BurnoutGauge";
import SensorGrid from "../components/SensorGrid";
import UploadZone from "../components/UploadZone";
import TrendChart from "../components/TrendChart";
import HistoryPanel from "../components/HistoryPanel";
import ResourceCard from "../components/ResourceCard";
import LiveBadge from "../components/LiveBadge";
import VitalsRow from "../components/VitalsRow";
import { useAnalysis } from "../hooks/useAnalysis";
import { useLiveStream } from "../hooks/useLiveStream";
import { useActivityTracker } from "../hooks/useActivityTracker";
import { saveRun } from "../lib/history";

type Tab = "scan" | "counselor";
type Mode = "idle" | "live" | "batch";

export default function Home() {
  const analysis = useAnalysis();
  const live = useLiveStream();

  const [tab, setTab] = useState<Tab>("scan");
  const [mode, setMode] = useState<Mode>("idle");
  const [sentimentText, setSentimentText] = useState("");
  const [showSentiment, setShowSentiment] = useState(false);
  const savedRef = useRef(false);

  // Browser-based activity tracking - starts immediately when live mode is on
  const localVitals = useActivityTracker(mode === "live");

  // Save batch analysis to history when done
  useEffect(() => {
    if (analysis.state.status === "done" && analysis.state.riskScore !== null && !savedRef.current) {
      savedRef.current = true;
      saveRun({
        timestamp: new Date().toISOString(),
        scenario: "scan",
        riskScore: analysis.state.riskScore,
        daysToThreshold: analysis.state.daysToThreshold,
      });
    }
  }, [analysis.state.status, analysis.state.riskScore, analysis.state.daysToThreshold]);

  function goLive() {
    setMode("live");
    live.connect();
  }

  function stopLive() {
    live.disconnect();
    setMode("idle");
  }

  function handleDemo(scenario: "healthy" | "crisis") {
    savedRef.current = false;
    setMode("batch");
    analysis.runDemo(scenario);
  }

  function handleFile(file: File) {
    savedRef.current = false;
    setMode("batch");
    analysis.runFile(file, sentimentText);
  }

  function handleReset() {
    savedRef.current = false;
    analysis.reset();
    setMode("idle");
  }

  const isLive = mode === "live";
  const isBatch = mode === "batch";
  const batchRunning = analysis.state.status === "running";
  const batchDone = analysis.state.status === "done";

  // Use live vitals from WebSocket if available, fall back to local browser tracker
  const displayVitals = live.state.vitals ?? (localVitals
    ? {
        mouse_velocity: localVitals.mouse_velocity_px_s,
        key_rate: localVitals.key_rate_per_min,
        idle_ratio: localVitals.idle_ratio,
      }
    : null);

  const displayReadings = isLive ? live.state.readings : analysis.state.readings;
  const displayScore = isLive ? live.state.riskScore : analysis.state.riskScore;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-4"
        style={{
          background: "rgba(13,13,13,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            <Activity size={16} color="var(--amber)" />
          </div>
          <span className="font-semibold text-sm tracking-tight">PulseCheck</span>
          {isLive && <LiveBadge connected={live.state.connected} waiting={!localVitals} />}
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {(["scan", "counselor"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize"
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
          <span className="text-xs">No messages read</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8">
        <AnimatePresence mode="wait">
          {tab === "scan" ? (
            <motion.div
              key="scan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-8"
            >
              {/* IDLE */}
              {mode === "idle" && (
                <>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-6 flex flex-col items-center gap-3"
                  >
                    <h1 className="text-3xl font-bold tracking-tight">
                      Your mental{" "}
                      <span style={{ color: "var(--amber)" }}>check engine light</span>
                    </h1>
                    <p className="text-sm max-w-md leading-relaxed" style={{ color: "var(--muted)" }}>
                      Analyzes how you move, type, and idle - not what you say.
                      Detects burnout patterns before you feel them.
                    </p>
                  </motion.div>

                  {/* Primary CTA */}
                  <motion.button
                    onClick={goLive}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center gap-3 py-5 rounded-2xl text-base font-semibold"
                    style={{
                      background: "linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(239,68,68,0.1) 100%)",
                      border: "1px solid rgba(245,158,11,0.4)",
                      color: "var(--amber)",
                    }}
                  >
                    <Radio size={20} />
                    Go Live - Monitor me right now
                  </motion.button>

                  <p className="text-center text-xs -mt-4" style={{ color: "var(--muted)" }}>
                    Tracks mouse speed, typing rate, and idle time in your browser. Nothing leaves this session.
                  </p>

                  {/* Demo / upload */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                      <span className="text-xs" style={{ color: "var(--muted)" }}>or run a demo</span>
                      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleDemo("healthy")}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
                        style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
                      >
                        <Zap size={14} /> Healthy Baseline
                      </button>
                      <button
                        onClick={() => handleDemo("crisis")}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}
                      >
                        <Zap size={14} /> Crisis Pattern
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                      <span className="text-xs" style={{ color: "var(--muted)" }}>or upload a Discord/Slack export</span>
                      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                    </div>
                    <UploadZone onFile={handleFile} />

                    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                      <button
                        className="w-full flex items-center justify-between px-5 py-3 text-left"
                        style={{ background: "var(--surface)" }}
                        onClick={() => setShowSentiment(!showSentiment)}
                      >
                        <span className="text-xs font-medium">Optional: Add a text note for tone analysis</span>
                        <ChevronRight
                          size={14}
                          color="var(--muted)"
                          style={{ transform: showSentiment ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}
                        />
                      </button>
                      <AnimatePresence>
                        {showSentiment && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                            <textarea
                              value={sentimentText}
                              onChange={(e) => setSentimentText(e.target.value)}
                              placeholder="How have you been feeling lately? (optional)"
                              rows={3}
                              className="w-full px-5 py-3 text-sm resize-none outline-none"
                              style={{ background: "var(--surface-2)", color: "var(--text)", border: "none" }}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <HistoryPanel />
                </>
              )}

              {/* LIVE MODE */}
              {isLive && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">

                  {/* Vitals - shows immediately from browser tracking */}
                  {displayVitals ? (
                    <VitalsRow vitals={displayVitals} />
                  ) : (
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="rounded-xl px-4 py-3 text-sm text-center"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
                    >
                      Move your mouse to start tracking...
                    </motion.div>
                  )}

                  {/* Gauge + sources */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div
                      className="rounded-2xl p-6 flex flex-col items-center justify-center gap-4"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-2 self-start">
                        <motion.div
                          className="w-2 h-2 rounded-full"
                          style={{ background: displayScore !== null ? "#22c55e" : "var(--amber)" }}
                          animate={{ opacity: [1, 0.4, 1] }}
                          transition={{ duration: 1.4, repeat: Infinity }}
                        />
                        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                          {displayScore !== null ? "Live risk score" : "Calculating..."}
                        </span>
                      </div>
                      <BurnoutGauge score={displayScore} animating={displayScore === null} />
                    </div>

                    <div
                      className="rounded-2xl p-6 flex flex-col gap-4"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <h3 className="text-sm font-semibold">Active Sensors</h3>
                      {[
                        {
                          label: "Browser Activity",
                          desc: "Mouse, keyboard, idle - running now",
                          active: localVitals !== null,
                        },
                        {
                          label: "Discord Bot",
                          desc: "Message metadata - optional",
                          active: live.state.sources.discord,
                        },
                      ].map((s) => (
                        <div key={s.label} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{s.label}</p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{s.desc}</p>
                          </div>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: s.active ? "rgba(34,197,94,0.12)" : "rgba(100,100,100,0.1)",
                              color: s.active ? "#22c55e" : "var(--muted)",
                              border: `1px solid ${s.active ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                            }}
                          >
                            {s.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      ))}

                      {!live.state.connected && (
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>
                          Run backend to enable full analysis:
                          <code className="ml-1 px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--surface-2)", color: "#22c55e" }}>
                            uvicorn main:app --reload
                          </code>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Sensor cards from WebSocket analysis */}
                  {live.state.readings.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <h2 className="text-sm font-semibold">Live Sensor Readings</h2>
                      <SensorGrid readings={live.state.readings} isRunning={false} />
                    </div>
                  )}

                  {displayScore !== null && displayScore >= 50 && (
                    <ResourceCard riskScore={displayScore} />
                  )}

                  <div className="flex justify-center">
                    <button
                      onClick={stopLive}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
                    >
                      <RotateCcw size={14} /> Stop monitoring
                    </button>
                  </div>
                </motion.div>
              )}

              {/* BATCH MODE */}
              {isBatch && (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div
                      className="rounded-2xl p-6 flex flex-col items-center justify-center gap-4"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-2 self-start">
                        <div
                          className={`w-2 h-2 rounded-full ${batchRunning ? "animate-pulse" : ""}`}
                          style={{ background: batchRunning ? "var(--amber)" : "#22c55e" }}
                        />
                        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                          {batchRunning
                            ? `Analyzing... ${analysis.state.readings.length}/5 sensors`
                            : "Analysis complete"}
                        </span>
                      </div>
                      <BurnoutGauge score={displayScore} animating={batchRunning} />
                    </div>

                    {batchDone && analysis.state.riskScore !== null && analysis.state.daysToThreshold !== null ? (
                      <TrendChart riskScore={analysis.state.riskScore} daysToThreshold={analysis.state.daysToThreshold} />
                    ) : (
                      <div
                        className="rounded-2xl p-6 flex items-center justify-center"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                            <Activity size={24} color="var(--amber)" />
                          </motion.div>
                          <span className="text-xs" style={{ color: "var(--muted)" }}>Analyzing patterns...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {(batchRunning || batchDone) && (
                    <div className="flex flex-col gap-3">
                      <h2 className="text-sm font-semibold">Sensor Readings</h2>
                      <SensorGrid readings={displayReadings} isRunning={batchRunning} />
                    </div>
                  )}

                  {batchDone && analysis.state.riskScore !== null && (
                    <ResourceCard riskScore={analysis.state.riskScore} />
                  )}

                  {(batchDone || analysis.state.status === "error") && (
                    <div className="flex justify-center">
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
                      >
                        <RotateCcw size={14} /> Scan again
                      </button>
                    </div>
                  )}

                  {analysis.state.status === "error" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-2xl p-6 text-center"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}
                    >
                      <p className="text-sm text-red-400">{analysis.state.error}</p>
                    </motion.div>
                  )}
                </div>
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

type StudentRow = {
  id: string;
  score: number;
  days: number | null;
  trend: "rising" | "stable" | "falling";
  lastActive: string;
  isLive?: boolean;
};

const SIMULATED: StudentRow[] = [
  { id: "S-001", score: 74, days: 8, trend: "rising", lastActive: "2h ago" },
  { id: "S-002", score: 41, days: null, trend: "stable", lastActive: "1d ago" },
  { id: "S-003", score: 88, days: 3, trend: "rising", lastActive: "30m ago" },
  { id: "S-004", score: 22, days: null, trend: "falling", lastActive: "3d ago" },
];

function getColor(score: number) {
  if (score < 30) return "#22c55e";
  if (score < 60) return "#f59e0b";
  if (score < 80) return "#f97316";
  return "#ef4444";
}

function CounselorView() {
  const [liveScore, setLiveScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    fetch(`${API_URL}/live-score`)
      .then((r) => r.json())
      .then((d) => {
        setLiveScore(d.score ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [API_URL]);

  const liveRow: StudentRow | null = liveScore !== null
    ? {
        id: "You (this session)",
        score: Math.round(liveScore),
        days: liveScore > 60 ? Math.max(1, Math.round(30 - liveScore * 0.3)) : null,
        trend: liveScore > 60 ? "rising" : liveScore < 30 ? "falling" : "stable",
        lastActive: "now",
        isLive: true,
      }
    : null;

  const rows: StudentRow[] = liveRow ? [liveRow, ...SIMULATED] : SIMULATED;
  const avg = Math.round(rows.reduce((a, s) => a + s.score, 0) / rows.length);
  const highRisk = rows.filter((s) => s.score >= 70).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">Counselor Dashboard</h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Anonymized behavioral risk scores. No message content is accessible.
          </p>
        </div>
        <span
          className="text-xs px-2 py-1 rounded-lg"
          style={{ background: "rgba(245,158,11,0.1)", color: "var(--amber)", border: "1px solid rgba(245,158,11,0.2)" }}
        >
          {liveRow ? "Live + simulated" : "Simulated students"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Students monitored", value: rows.length, color: "var(--text)" },
          { label: "Avg risk score", value: loading ? "..." : avg, color: getColor(avg) },
          { label: "High risk alerts", value: highRisk, color: highRisk > 0 ? "#ef4444" : "#22c55e" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <span className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div
          className="grid grid-cols-5 px-5 py-3 text-xs font-medium"
          style={{ background: "var(--surface)", color: "var(--muted)", borderBottom: "1px solid var(--border)" }}
        >
          <span>Student ID</span>
          <span>Risk Score</span>
          <span>Trend</span>
          <span>Days to threshold</span>
          <span>Last active</span>
        </div>
        {rows.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="grid grid-cols-5 px-5 py-4 text-sm items-center"
            style={{
              background: s.isLive
                ? "rgba(245,158,11,0.05)"
                : i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
              borderBottom: "1px solid var(--border)",
              borderLeft: s.isLive ? "2px solid rgba(245,158,11,0.4)" : "2px solid transparent",
            }}
          >
            <span className="font-mono text-xs">
              {s.id}
              {s.isLive && (
                <span className="ml-1.5 text-xs px-1 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.15)", color: "var(--amber)" }}>
                  live
                </span>
              )}
            </span>
            <span className="font-bold tabular-nums" style={{ color: getColor(s.score) }}>{s.score}</span>
            <span
              className="text-xs"
              style={{ color: s.trend === "rising" ? "#ef4444" : s.trend === "falling" ? "#22c55e" : "var(--muted)" }}
            >
              {s.trend === "rising" ? "Rising" : s.trend === "falling" ? "Improving" : "Stable"}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {s.days !== null ? `~${s.days} days` : "None"}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{s.lastActive}</span>
          </motion.div>
        ))}
      </div>

      {!liveRow && !loading && (
        <div
          className="rounded-xl p-3 text-xs text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
        >
          Run a live session in "My Scan" to see your own data appear here in real time.
        </div>
      )}

      <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <Shield size={16} color="var(--amber)" className="shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          Student IDs are one-way hashed and cannot be reverse-mapped. In a real deployment, students opt in
          and counselors only see aggregate risk scores - never message content.
        </p>
      </div>
    </motion.div>
  );
}
