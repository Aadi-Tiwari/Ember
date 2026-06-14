"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, ArrowLeft, CheckCircle, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";

type SensorReading   = { label: string; score: number; finding: string; confidence: number; zscore?: number };
type AttentionWeight = { label: string; pct: number; zscore: number };

type SessionData = {
  score:            number;
  readings:         SensorReading[];
  attentionWeights: AttentionWeight[];
  timestamp:        string;
  duration:         number; // seconds
};

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
function sensorColor(s: number) {
  if (s < 30) return "#22c55e";
  if (s < 60) return "#f59e0b";
  if (s < 80) return "#f97316";
  return "#ef4444";
}
function sensorBadge(s: number) {
  if (s < 30) return "Normal";
  if (s < 60) return "Mild";
  if (s < 80) return "High";
  return "Critical";
}

function interpret(score: number, readings: SensorReading[]): string {
  const em = readings.find(r => r.label === "Emotion");
  const vo = readings.find(r => r.label === "Voice");
  const ac = readings.find(r => r.label === "Activity");

  if (score < 30) return "All sensors look healthy. Your facial expressions, voice patterns, and movement are all within normal range. Keep it up.";
  if (score < 60) {
    const flags = [
      em?.score && em.score > 40 ? "mild facial stress markers" : null,
      vo?.score && vo.score > 40 ? "reduced vocal energy" : null,
      ac?.score && ac.score > 40 ? "lower activity levels" : null,
    ].filter(Boolean);
    return flags.length
      ? `Mild signals detected - ${flags.join(" and ")}. Not alarming, but worth taking a short break.`
      : "Some mild stress signals are present. A short break or change of environment could help reset.";
  }
  if (score < 80) return "Multiple burnout signals are active. Face, voice, or movement patterns are showing significant fatigue. Take a real break - not just a few minutes.";
  return "Critical burnout signals detected across multiple sensors. Step away from screens, hydrate, and consider talking to someone you trust.";
}

function getRecommendations(score: number, readings: SensorReading[]): string[] {
  const recs: string[] = [];
  const vo = readings.find(r => r.label === "Voice");
  const ac = readings.find(r => r.label === "Activity");
  const em = readings.find(r => r.label === "Emotion");

  if (score >= 60) recs.push("Take a 15-20 minute break away from all screens");
  else if (score >= 30) recs.push("Take a 5-minute break and step outside if possible");

  if (score >= 30) recs.push("Box breathing: 4s inhale - 4s hold - 4s exhale - 4s hold");
  if (vo?.score && vo.score > 35) recs.push("Rest your voice - avoid calls or extra talking for a bit");
  if (ac?.score && ac.score > 40) recs.push("Move your body - even a 2-minute walk resets your state");
  if (em?.score && em.score > 50) recs.push("Ground yourself: name 5 things you can see right now");
  if (score >= 70) recs.push("Consider reaching out to a friend, counselor, or the 988 Lifeline");

  return recs.slice(0, 4);
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const R = 72, C = 2 * Math.PI * R;
  return (
    <svg width={180} height={180} viewBox="0 0 180 180">
      <circle cx={90} cy={90} r={R} fill="none" stroke="var(--border)" strokeWidth={12} />
      <motion.circle cx={90} cy={90} r={R} fill="none" stroke={color} strokeWidth={12}
        strokeLinecap="round" strokeDasharray={C}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: C * (1 - score / 100) }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
        style={{ rotate: -90, transformOrigin: "90px 90px" }} />
      <text x={90} y={84} textAnchor="middle" fill={color} fontSize={40} fontWeight={700}
        fontFamily="system-ui" style={{ fontVariantNumeric: "tabular-nums" }}>{score}</text>
      <text x={90} y={108} textAnchor="middle" fill="var(--muted)" fontSize={13}>
        {scoreLabel(score)}
      </text>
    </svg>
  );
}

function SensorCard({ r, index }: { r: SensorReading; index: number }) {
  const c = sensorColor(r.score);
  const Icon = r.score > 59 ? TrendingUp : r.score < 30 ? TrendingDown : Minus;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.08 }}
      className="rounded-2xl p-6 flex flex-col gap-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={15} color={c} />
          <span className="text-sm font-semibold">{r.label}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: c + "18", color: c }}>{sensorBadge(r.score)}</span>
      </div>
      <div className="flex items-end gap-3">
        <span className="text-4xl font-bold tabular leading-none" style={{ color: c }}>{r.score}</span>
        <span className="text-sm mb-0.5" style={{ color: "var(--muted)" }}>/ 100</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <motion.div className="h-full rounded-full" style={{ background: c }}
          initial={{ width: 0 }} animate={{ width: `${r.score}%` }}
          transition={{ delay: 0.3 + index * 0.08, duration: 0.7, ease: "easeOut" }} />
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{r.finding}</p>
      <div className="flex items-center justify-between pt-1"
        style={{ borderTop: "1px solid var(--border)" }}>
        <span className="text-xs" style={{ color: "var(--muted-2)" }}>Confidence</span>
        <span className="text-xs font-semibold tabular" style={{ color: "var(--text)" }}>
          {Math.round(r.confidence * 100)}%
        </span>
      </div>
    </motion.div>
  );
}

export default function EvaluatePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("ember_session");
    if (raw) {
      try { setSession(JSON.parse(raw)); }
      catch { /* corrupted */ }
    }
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: "var(--bg)" }}>
        <p className="text-sm" style={{ color: "var(--muted)" }}>No session data found.</p>
        <button onClick={() => router.push("/")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm cursor-pointer"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
          <ArrowLeft size={13} /> Back to Ember
        </button>
      </div>
    );
  }

  const color  = scoreColor(session.score);
  const summary = interpret(session.score, session.readings);
  const recs    = getRecommendations(session.score, session.readings);
  const ts      = new Date(session.timestamp);
  const mins    = Math.floor(session.duration / 60);
  const secs    = session.duration % 60;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <header className="sticky top-0 z-40"
        style={{ background: "rgba(10,10,10,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <button onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-xs cursor-pointer"
            style={{ color: "var(--muted)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}>
            <ArrowLeft size={13} /> Back
          </button>
          <div className="w-px h-4" style={{ background: "var(--border)" }} />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <Activity size={12} color="var(--amber)" />
            </div>
            <span className="text-sm font-semibold">Ember</span>
          </div>
          <span className="text-xs ml-auto" style={{ color: "var(--muted)" }}>
            Session Report
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-10">

        {/* Hero: score + summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="flex flex-col items-center md:items-start gap-2">
            <ScoreRing score={session.score} color={color} />
            <div className="flex items-center gap-2 mt-2">
              <Clock size={11} color="var(--muted)" />
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                {ts.toLocaleDateString()} at {ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {session.duration > 0 && ` - ${mins > 0 ? `${mins}m ` : ""}${secs}s session`}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-medium tracking-wider uppercase mb-2"
                style={{ color: "var(--muted)" }}>Overall Burnout Risk</p>
              <p className="text-base leading-relaxed" style={{ color: "var(--muted)" }}>{summary}</p>
            </div>
            {/* Backend confirmation badge */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <CheckCircle size={14} color="#22c55e" />
              <span className="text-xs font-medium" style={{ color: "#22c55e" }}>
                Backend analysis complete
              </span>
              <span className="text-xs ml-auto" style={{ color: "var(--muted)" }}>
                {session.readings.length} sensor{session.readings.length !== 1 ? "s" : ""} fused
              </span>
            </div>
          </div>
        </motion.div>

        {/* Sensor breakdown */}
        {session.readings.length > 0 && (
          <div className="flex flex-col gap-4">
            <p className="text-xs font-medium tracking-wider uppercase" style={{ color: "var(--muted)" }}>
              Sensor Breakdown
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {session.readings.map((r, i) => <SensorCard key={r.label} r={r} index={i} />)}
            </div>
          </div>
        )}

        {/* Score drivers */}
        {session.attentionWeights.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="flex flex-col gap-4">
            <p className="text-xs font-medium tracking-wider uppercase" style={{ color: "var(--muted)" }}>
              Score Drivers
            </p>
            <div className="grid grid-cols-3 gap-3">
              {session.attentionWeights.map((w, i) => {
                const c = w.zscore >= 1.5 ? "#f97316" : w.zscore >= 0.8 ? "#f59e0b" : "#22c55e";
                return (
                  <motion.div key={w.label} initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.07 }}
                    className="rounded-2xl p-5 flex flex-col gap-1"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>{w.label}</span>
                    <span className="text-3xl font-bold tabular" style={{ color: c }}>
                      {w.pct.toFixed(0)}%
                    </span>
                    <span className="text-xs font-mono" style={{ color: "var(--muted-2)" }}>
                      {w.zscore > 0 ? "+" : ""}{w.zscore.toFixed(1)}σ from baseline
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Recommendations */}
        {recs.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            className="flex flex-col gap-4">
            <p className="text-xs font-medium tracking-wider uppercase" style={{ color: "var(--muted)" }}>
              Recommended Actions
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recs.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-2xl"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                    style={{ background: color + "18", color, border: `1px solid ${color}30` }}>
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{rec}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Raw backend output */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid var(--border)" }}>
          <div className="px-5 py-3.5 flex items-center justify-between"
            style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
            <span className="text-xs font-medium tracking-wider uppercase" style={{ color: "var(--muted)" }}>
              Backend Signal Output
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
              FastAPI - localhost:8000
            </span>
          </div>
          <div className="p-5 font-mono text-xs leading-relaxed"
            style={{ background: "var(--surface)", color: "var(--muted)", whiteSpace: "pre-wrap" }}>
            {JSON.stringify({
              risk_score: session.score,
              timestamp:  session.timestamp,
              readings:   session.readings.map(r => ({
                label:      r.label,
                score:      r.score,
                confidence: r.confidence,
                finding:    r.finding.slice(0, 60) + (r.finding.length > 60 ? "..." : ""),
              })),
              attention_weights: session.attentionWeights,
            }, null, 2)}
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex items-center gap-3 pb-8">
          <button onClick={() => router.push("/")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
            style={{ background: "var(--amber)", color: "#000" }}>
            <ArrowLeft size={13} /> New Session
          </button>
        </div>

      </main>
    </div>
  );
}
