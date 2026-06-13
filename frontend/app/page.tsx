"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Shield, ChevronRight, RotateCcw, Zap } from "lucide-react";
import BurnoutGauge from "../components/BurnoutGauge";
import SensorGrid from "../components/SensorGrid";
import UploadZone from "../components/UploadZone";
import TrendChart from "../components/TrendChart";
import HistoryPanel from "../components/HistoryPanel";
import ResourceCard from "../components/ResourceCard";
import { useAnalysis } from "../hooks/useAnalysis";
import { saveRun } from "../lib/history";

type Tab = "scan" | "counselor";

export default function Home() {
  const { state, runDemo, runFile, reset } = useAnalysis();
  const [tab, setTab] = useState<Tab>("scan");
  const [sentimentText, setSentimentText] = useState("");
  const [showSentiment, setShowSentiment] = useState(false);
  const savedRef = useRef(false);

  const isRunning = state.status === "running";
  const isDone = state.status === "done";

  // Save to localStorage when analysis finishes
  useEffect(() => {
    if (isDone && state.riskScore !== null && !savedRef.current) {
      savedRef.current = true;
      saveRun({
        timestamp: new Date().toISOString(),
        scenario: "upload",
        riskScore: state.riskScore,
        daysToThreshold: state.daysToThreshold,
      });
    }
  }, [isDone, state.riskScore, state.daysToThreshold]);

  function handleReset() {
    savedRef.current = false;
    reset();
  }

  function handleDemo(scenario: "healthy" | "crisis") {
    savedRef.current = false;
    runDemo(scenario).then(() => {
      if (state.riskScore !== null) {
        saveRun({ timestamp: new Date().toISOString(), scenario, riskScore: state.riskScore, daysToThreshold: state.daysToThreshold });
      }
    });
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(13,13,13,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            <Activity size={16} color="var(--amber)" />
          </div>
          <span className="font-semibold text-sm tracking-tight">PulseCheck</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "rgba(245,158,11,0.1)", color: "var(--amber)", border: "1px solid rgba(245,158,11,0.2)" }}
          >
            beta
          </span>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
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
              {/* Hero */}
              {state.status === "idle" && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-8 flex flex-col items-center gap-3"
                >
                  <h1 className="text-3xl font-bold tracking-tight">
                    Check your{" "}
                    <span style={{ color: "var(--amber)" }}>mental pulse</span>
                  </h1>
                  <p className="text-sm max-w-md leading-relaxed" style={{ color: "var(--muted)" }}>
                    Six behavioral sensors analyze when you message, how often, how fast you reply -
                    without ever reading your words. Detects burnout weeks before you feel it.
                  </p>
                </motion.div>
              )}

              {/* Input area */}
              {state.status === "idle" && (
                <div className="flex flex-col gap-4">
                  <UploadZone onFile={(file) => runFile(file, sentimentText)} />

                  {/* Optional VADER input */}
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{ border: "1px solid var(--border)" }}
                  >
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
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
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

                  {/* Demo buttons */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                    <span className="text-xs" style={{ color: "var(--muted)" }}>or try a demo</span>
                    <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleDemo("healthy")}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors"
                      style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
                    >
                      <Zap size={14} />
                      Healthy Baseline
                    </button>
                    <button
                      onClick={() => handleDemo("crisis")}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}
                    >
                      <Zap size={14} />
                      Crisis Pattern
                    </button>
                  </div>
                </div>
              )}

              {/* Running / Done state */}
              {(isRunning || isDone) && (
                <div className="flex flex-col gap-6">
                  {/* Top row: gauge + summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div
                      className="rounded-2xl p-6 flex flex-col items-center justify-center gap-4"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-2 self-start">
                        <div
                          className={`w-2 h-2 rounded-full ${isRunning ? "animate-pulse" : ""}`}
                          style={{ background: isRunning ? "var(--amber)" : "#22c55e" }}
                        />
                        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                          {isRunning ? `Scanning... ${state.readings.length}/5 sensors` : "Analysis complete"}
                        </span>
                      </div>
                      <BurnoutGauge score={state.riskScore} animating={isRunning} />
                    </div>

                    {isDone && state.riskScore !== null && state.daysToThreshold !== null ? (
                      <TrendChart riskScore={state.riskScore} daysToThreshold={state.daysToThreshold} />
                    ) : (
                      <div
                        className="rounded-2xl p-6 flex items-center justify-center"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          >
                            <Activity size={24} color="var(--amber)" />
                          </motion.div>
                          <span className="text-xs" style={{ color: "var(--muted)" }}>Analyzing patterns...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sensor cards */}
                  <div className="flex flex-col gap-3">
                    <h2 className="text-sm font-semibold">Sensor Readings</h2>
                    <SensorGrid readings={state.readings} isRunning={isRunning} />
                  </div>

                  {/* Resources (only when done and high risk) */}
                  {isDone && state.riskScore !== null && (
                    <ResourceCard riskScore={state.riskScore} />
                  )}

                  {/* Reset */}
                  {isDone && (
                    <div className="flex justify-center">
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-colors"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
                      >
                        <RotateCcw size={14} />
                        Scan again
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Error state */}
              {state.status === "error" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl p-6 text-center flex flex-col gap-3"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}
                >
                  <p className="text-sm text-red-400">{state.error}</p>
                  <button onClick={handleReset} className="text-xs underline" style={{ color: "var(--muted)" }}>
                    Try again
                  </button>
                </motion.div>
              )}

              {/* History */}
              {state.status === "idle" && <HistoryPanel />}
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
  const mockStudents = [
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

  const avgScore = Math.round(mockStudents.reduce((a, s) => a + s.score, 0) / mockStudents.length);
  const highRisk = mockStudents.filter((s) => s.score >= 70).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">Counselor Dashboard</h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Anonymized aggregate view. No individual messages are accessible.
          </p>
        </div>
        <span
          className="text-xs px-2 py-1 rounded-lg"
          style={{ background: "rgba(245,158,11,0.1)", color: "var(--amber)", border: "1px solid rgba(245,158,11,0.2)" }}
        >
          Demo data
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Students monitored", value: mockStudents.length, color: "var(--text)" },
          { label: "Avg risk score", value: avgScore, color: getColor(avgScore) },
          { label: "High risk alerts", value: highRisk, color: highRisk > 0 ? "#ef4444" : "#22c55e" },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-2xl p-5 flex flex-col gap-1"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <span className="text-2xl font-bold" style={{ color: c.color }}>
              {c.value}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Student list */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
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
        {mockStudents.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="grid grid-cols-5 px-5 py-4 text-sm items-center"
            style={{
              background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span className="font-mono text-xs">{s.id}</span>
            <span className="font-bold tabular-nums" style={{ color: getColor(s.score) }}>
              {s.score}
            </span>
            <span
              className="text-xs"
              style={{ color: s.trend === "rising" ? "#ef4444" : s.trend === "falling" ? "#22c55e" : "var(--muted)" }}
            >
              {s.trend === "rising" ? "Rising" : s.trend === "falling" ? "Improving" : "Stable"}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {s.days !== null ? `~${s.days} days` : "None predicted"}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{s.lastActive}</span>
          </motion.div>
        ))}
      </div>

      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}
      >
        <Shield size={16} color="var(--amber)" className="shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          This dashboard shows anonymized behavioral risk scores only. Student IDs are hashed and cannot be
          reverse-mapped. Individual message content is never processed or stored.
        </p>
      </div>
    </motion.div>
  );
}
