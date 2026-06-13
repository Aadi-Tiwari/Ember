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

  const displayReadings = isLive ? live.state.readings : analysis.state.readings;
  const displayScore = isLive ? live.state.riskScore : analysis.state.riskScore;
  const showSensors = isLive ? live.state.readings.length > 0 : (batchRunning || batchDone);

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
          {isLive && <LiveBadge connected={live.state.connected} waiting={live.state.waiting} />}
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
            <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-8">

              {/* IDLE: landing */}
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
                      Analyzes how you move, type, and message - not what you say.
                      Detects burnout patterns before you feel them.
                    </p>
                  </motion.div>

                  {/* Primary CTA - Go Live */}
                  <motion.button
                    onClick={goLive}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center gap-3 py-5 rounded-2xl text-base font-semibold transition-all"
                    style={{
                      background: "linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(239,68,68,0.1) 100%)",
                      border: "1px solid rgba(245,158,11,0.4)",
                      color: "var(--amber)",
                    }}
                  >
                    <Radio size={20} />
                    Go Live - Monitor me right now
                  </motion.button>

                  <p className="text-center text-xs" style={{ color: "var(--muted)" }}>
                    Tracks mouse speed, typing rate, and idle time. Nothing is recorded or stored.
                  </p>

                  {/* Demo / upload */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                      <span className="text-xs" style={{ color: "var(--muted)" }}>or use demo data</span>
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
                  {/* Setup instructions if waiting */}
                  {live.state.waiting && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl p-5 flex flex-col gap-3"
                      style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}
                    >
                      <p className="text-sm font-semibold" style={{ color: "var(--amber)" }}>
                        Start the activity monitor in a new terminal:
                      </p>
                      <code
                        className="text-xs px-3 py-2 rounded-lg block"
                        style={{ background: "var(--surface-2)", color: "#22c55e" }}
                      >
                        python monitor/activity_monitor.py
                      </code>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        Then move your mouse or type. The dashboard updates every 5 seconds.
                      </p>
                    </motion.div>
                  )}

                  {/* Vitals row */}
                  {live.state.vitals && <VitalsRow vitals={live.state.vitals} />}

                  {/* Gauge + source status */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div
                      className="rounded-2xl p-6 flex flex-col items-center justify-center gap-4"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-2 self-start">
                        <motion.div
                          className="w-2 h-2 rounded-full"
                          style={{ background: live.state.riskScore !== null ? "#22c55e" : "var(--amber)" }}
                          animate={{ opacity: [1, 0.4, 1] }}
                          transition={{ duration: 1.4, repeat: Infinity }}
                        />
                        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                          {live.state.riskScore !== null ? "Live reading" : "Waiting for data..."}
                        </span>
                      </div>
                      <BurnoutGauge score={displayScore} animating={live.state.waiting} />
                    </div>

                    <div
                      className="rounded-2xl p-6 flex flex-col gap-4"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <h3 className="text-sm font-semibold">Data Sources</h3>
                      {[
                        { label: "Activity Monitor", desc: "Mouse, keyboard, idle", active: live.state.sources.activity },
                        { label: "Discord Bot", desc: "Message metadata", active: live.state.sources.discord },
                      ].map((s) => (
                        <div key={s.label} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{s.label}</p>
                            <p className="text-xs" style={{ color: "var(--muted)" }}>{s.desc}</p>
                          </div>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: s.active ? "rgba(34,197,94,0.12)" : "rgba(100,100,100,0.12)",
                              color: s.active ? "#22c55e" : "var(--muted)",
                              border: `1px solid ${s.active ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                            }}
                          >
                            {s.active ? "Connected" : "Not running"}
                          </span>
                        </div>
                      ))}

                      <div className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                        Updates every 5 seconds. Add Discord bot for messaging pattern analysis.
                      </div>
                    </div>
                  </div>

                  {/* Live sensor cards */}
                  {live.state.readings.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <h2 className="text-sm font-semibold">Live Sensor Readings</h2>
                      <SensorGrid readings={live.state.readings} isRunning={false} />
                    </div>
                  )}

                  {live.state.riskScore !== null && live.state.riskScore >= 50 && (
                    <ResourceCard riskScore={live.state.riskScore} />
                  )}

                  <div className="flex justify-center">
                    <button
                      onClick={stopLive}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-colors"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
                    >
                      <RotateCcw size={14} /> Stop monitoring
                    </button>
                  </div>
                </motion.div>
              )}

              {/* BATCH MODE (demo or upload) */}
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

                  {showSensors && (
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
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-colors"
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

function CounselorView() {
  const students = [
    { id: "S-001", score: 74, days: 8, trend: "rising", lastActive: "2h ago" },
    { id: "S-002", score: 41, days: null, trend: "stable", lastActive: "1d ago" },
    { id: "S-003", score: 88, days: 3, trend: "rising", lastActive: "30m ago" },
    { id: "S-004", score: 22, days: null, trend: "falling", lastActive: "3d ago" },
    { id: "S-005", score: 56, days: 21, trend: "rising", lastActive: "6h ago" },
  ];

  function getColor(score: number) {
    if (score < 30) return "#22c55e";
    if (score < 60) return "#f59e0b";
    if (score < 80) return "#f97316";
    return "#ef4444";
  }

  const avg = Math.round(students.reduce((a, s) => a + s.score, 0) / students.length);
  const highRisk = students.filter((s) => s.score >= 70).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">Counselor Dashboard</h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Anonymized aggregate view. No individual message content accessible.
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(245,158,11,0.1)", color: "var(--amber)", border: "1px solid rgba(245,158,11,0.2)" }}>
          Demo data
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Monitored", value: students.length, color: "var(--text)" },
          { label: "Avg risk score", value: avg, color: getColor(avg) },
          { label: "High risk", value: highRisk, color: highRisk > 0 ? "#ef4444" : "#22c55e" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <span className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="grid grid-cols-5 px-5 py-3 text-xs font-medium" style={{ background: "var(--surface)", color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
          <span>Student ID</span><span>Risk Score</span><span>Trend</span><span>Days to threshold</span><span>Last active</span>
        </div>
        {students.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="grid grid-cols-5 px-5 py-4 text-sm items-center"
            style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
          >
            <span className="font-mono text-xs">{s.id}</span>
            <span className="font-bold tabular-nums" style={{ color: getColor(s.score) }}>{s.score}</span>
            <span className="text-xs" style={{ color: s.trend === "rising" ? "#ef4444" : s.trend === "falling" ? "#22c55e" : "var(--muted)" }}>
              {s.trend === "rising" ? "Rising" : s.trend === "falling" ? "Improving" : "Stable"}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{s.days !== null ? `~${s.days} days` : "None"}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{s.lastActive}</span>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <Shield size={16} color="var(--amber)" className="shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          Student IDs are one-way hashed. No message content is ever stored or transmitted. Only behavioral timing metadata is used.
        </p>
      </div>
    </motion.div>
  );
}
