"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { SensorReading, AttentionWeight } from "../hooks/useLiveStream";

type Props = {
  open: boolean;
  onClose: () => void;
  score: number;
  readings: SensorReading[];
  attentionWeights: AttentionWeight[];
};

function riskInfo(s: number): { label: string; color: string; bg: string } {
  if (s < 30) return { label: "Low Risk",  color: "#22c55e", bg: "rgba(34,197,94,0.08)"   };
  if (s < 60) return { label: "Moderate",  color: "#f59e0b", bg: "rgba(245,158,11,0.08)"  };
  if (s < 80) return { label: "High Risk", color: "#f97316", bg: "rgba(249,115,22,0.08)"  };
  return              { label: "Critical", color: "#ef4444", bg: "rgba(239,68,68,0.08)"   };
}

function sensorColor(s: number) {
  if (s < 30) return "#22c55e";
  if (s < 60) return "#f59e0b";
  if (s < 80) return "#f97316";
  return "#ef4444";
}

function interpret(score: number, readings: SensorReading[]): string {
  const em  = readings.find(r => r.label === "Emotion");
  const vo  = readings.find(r => r.label === "Voice");
  const ac  = readings.find(r => r.label === "Activity");

  if (score < 30)
    return "All sensors look healthy. Your facial expressions, voice, and movement patterns are within normal range. Keep it up.";
  if (score < 60) {
    const flags = [
      em?.score  && em.score  > 40 ? "mild facial stress markers" : null,
      vo?.score  && vo.score  > 40 ? "reduced vocal energy" : null,
      ac?.score  && ac.score  > 40 ? "lower-than-normal activity" : null,
    ].filter(Boolean);
    return flags.length
      ? `Mild signals detected - ${flags.join(" and ")}. Not alarming, but a short break would help.`
      : "Some mild stress signals are present. A short break or change of environment could help reset.";
  }
  if (score < 80)
    return "Multiple burnout signals are active across face, voice, or movement. Your body is showing signs of significant fatigue. A real break - not just a few minutes - is recommended.";
  return "Critical burnout signals detected across multiple sensors. Please step away from screens now. Hydrate, rest, and consider reaching out to someone you trust.";
}

function recommendations(score: number, readings: SensorReading[]): string[] {
  const recs: string[] = [];
  const vo = readings.find(r => r.label === "Voice");
  const ac = readings.find(r => r.label === "Activity");
  const em = readings.find(r => r.label === "Emotion");

  if (score >= 60) recs.push("Take a 15-20 min break away from all screens");
  else if (score >= 30) recs.push("Take a 5-minute break and step outside");

  if (score >= 30) recs.push("Box breathing: 4s inhale - 4s hold - 4s exhale - 4s hold");
  if (vo?.score && vo.score > 35) recs.push("Rest your voice - skip calls or meetings for a bit");
  if (ac?.score && ac.score > 40) recs.push("Move your body - even a 2-minute walk resets your state");
  if (em?.score && em.score > 50) recs.push("Ground yourself: name 5 things you can see right now");
  if (score >= 70) recs.push("Consider talking to a friend, counselor, or the 988 Lifeline");

  return recs.slice(0, 4);
}

// Radial score ring
function ScoreRing({ score, color }: { score: number; color: string }) {
  const R = 54, C = 2 * Math.PI * R;
  const fill = C * (1 - score / 100);
  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      <circle cx={70} cy={70} r={R} fill="none" stroke="var(--border)" strokeWidth={10} />
      <motion.circle cx={70} cy={70} r={R} fill="none" stroke={color} strokeWidth={10}
        strokeLinecap="round" strokeDasharray={C}
        initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: fill }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.15 }}
        style={{ rotate: -90, transformOrigin: "70px 70px" }} />
      <text x={70} y={66} textAnchor="middle" fill={color} fontSize={30} fontWeight={700}
        fontFamily="system-ui" style={{ fontVariantNumeric: "tabular-nums" }}>{score}</text>
      <text x={70} y={84} textAnchor="middle" fill="var(--muted)" fontSize={11}>{
        score < 30 ? "Low Risk" : score < 60 ? "Moderate" : score < 80 ? "High Risk" : "Critical"
      }</text>
    </svg>
  );
}

export default function Evaluate({ open, onClose, score, readings, attentionWeights }: Props) {
  const { color } = riskInfo(score);
  const recs      = recommendations(score, readings);
  const summary   = interpret(score, readings);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div key="bd" className="fixed inset-0 z-50 cursor-pointer"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} />

          {/* Sheet */}
          <motion.div key="sheet"
            className="fixed z-50 bottom-0 left-0 right-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[520px] rounded-t-3xl sm:rounded-2xl overflow-hidden"
            style={{ background: "#111", border: "1px solid var(--border)", maxHeight: "90vh" }}
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-sm font-semibold">Session Report</span>
              <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer"
                style={{ color: "var(--muted)" }}>
                <X size={15} />
              </button>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 60px)" }}>
              <div className="px-6 py-5 flex flex-col gap-6">

                {/* Score + ring */}
                <div className="flex items-center gap-6">
                  <ScoreRing score={score} color={color} />
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium tracking-wider uppercase"
                      style={{ color: "var(--muted)" }}>Overall Burnout Risk</p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                      {summary}
                    </p>
                  </div>
                </div>

                {/* Sensor breakdown */}
                {readings.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-medium tracking-wider uppercase"
                      style={{ color: "var(--muted)" }}>Sensor Breakdown</p>
                    {readings.map((r, i) => {
                      const c = sensorColor(r.score);
                      return (
                        <motion.div key={r.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.07 }} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{r.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs tabular font-bold" style={{ color: c }}>{r.score}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                                style={{ background: c + "18", color: c }}>
                                {r.score < 30 ? "Normal" : r.score < 60 ? "Mild" : r.score < 80 ? "High" : "Critical"}
                              </span>
                            </div>
                          </div>
                          {/* Bar */}
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                            <motion.div className="h-full rounded-full" style={{ background: c }}
                              initial={{ width: 0 }} animate={{ width: `${r.score}%` }}
                              transition={{ delay: i * 0.07 + 0.1, duration: 0.6, ease: "easeOut" }} />
                          </div>
                          <p className="text-xs" style={{ color: "var(--muted)" }}>{r.finding}</p>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* What drove the score */}
                {attentionWeights.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-medium tracking-wider uppercase"
                      style={{ color: "var(--muted)" }}>Score Drivers</p>
                    <div className="grid grid-cols-3 gap-2">
                      {attentionWeights.map((w, i) => {
                        const c = w.zscore >= 1.5 ? "#f97316" : w.zscore >= 0.8 ? "#f59e0b" : "#22c55e";
                        return (
                          <motion.div key={w.label} initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
                            className="rounded-xl p-3 flex flex-col gap-1 text-center"
                            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                            <span className="text-xs" style={{ color: "var(--muted)" }}>{w.label}</span>
                            <span className="text-lg font-bold tabular" style={{ color: c }}>
                              {w.pct.toFixed(0)}%
                            </span>
                            <span className="text-xs tabular font-mono" style={{ color: "var(--muted-2)" }}>
                              {w.zscore > 0 ? "+" : ""}{w.zscore.toFixed(1)}σ
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {recs.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-medium tracking-wider uppercase"
                      style={{ color: "var(--muted)" }}>What to do</p>
                    <div className="flex flex-col gap-2">
                      {recs.map((r, i) => (
                        <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.06 }}
                          className="flex items-start gap-3 text-sm"
                          style={{ color: "var(--muted)" }}>
                          <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs mt-0.5"
                            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color }}>
                            {i + 1}
                          </span>
                          {r}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Close */}
                <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm cursor-pointer"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
