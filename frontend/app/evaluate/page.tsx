"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity, ArrowLeft, CheckCircle, TrendingUp, TrendingDown,
  Minus, Clock, Eye, Mic, MessageSquare, Zap,
} from "lucide-react";

const BG = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Fractal%20Glass%20-%204.jpg-8QPt1A02QgjJIeTqwEYV5thwZXXEGT.jpeg";

type SensorReading   = { label: string; score: number; finding: string; confidence: number; zscore?: number };
type AttentionWeight = { label: string; pct: number; zscore: number };
type SessionData = {
  score: number; readings: SensorReading[]; attentionWeights: AttentionWeight[];
  timestamp: string; duration: number;
};

// ── Glass style helpers ────────────────────────────────────────────────────
const GC: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.14)", borderRadius: 24,
};
const GR: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12,
};
const W  = (o: number): string => `rgba(255,255,255,${o})`;

// ── Helpers ────────────────────────────────────────────────────────────────
function riskColor(s: number) {
  if (s < 30) return "#4ade80"; if (s < 60) return "#facc15";
  if (s < 80) return "#fb923c"; return "#f87171";
}
function riskLabel(s: number) {
  if (s < 30) return "Low Risk"; if (s < 60) return "Moderate";
  if (s < 80) return "High Risk"; return "Critical";
}
function riskGradient(s: number) {
  if (s < 30) return "linear-gradient(90deg,#4ade80,#10b981)";
  if (s < 60) return "linear-gradient(90deg,#facc15,#f59e0b)";
  if (s < 80) return "linear-gradient(90deg,#fb923c,#ef4444)";
  return "linear-gradient(90deg,#ef4444,#dc2626)";
}
function badgeStyle(s: number): React.CSSProperties {
  const c = riskColor(s);
  return { background: c + "22", border: `1px solid ${c}44`, color: c, borderRadius: 999, padding: "3px 10px", fontSize: "0.7rem", fontWeight: 600 };
}
function sensorIcon(label: string) {
  if (label === "Emotion")  return Eye;
  if (label === "Voice")    return Mic;
  if (label === "Activity") return Zap;
  return MessageSquare;
}
function sensorGradient(label: string) {
  if (label === "Emotion")  return "linear-gradient(135deg,#60a5fa,#a78bfa)";
  if (label === "Voice")    return "linear-gradient(135deg,#a78bfa,#ec4899)";
  if (label === "Activity") return "linear-gradient(135deg,#4ade80,#06b6d4)";
  return "linear-gradient(135deg,#f59e0b,#fb923c)";
}

function interpret(score: number, readings: SensorReading[]): string {
  const em = readings.find(r => r.label === "Emotion");
  const vo = readings.find(r => r.label === "Voice");
  const ac = readings.find(r => r.label === "Activity");
  if (score < 30) return "All sensors look healthy. Facial expressions, voice patterns, and movement are within normal range.";
  if (score < 60) {
    const flags = [em?.score && em.score > 40 ? "mild facial stress" : null, vo?.score && vo.score > 40 ? "reduced vocal energy" : null, ac?.score && ac.score > 40 ? "lower activity" : null].filter(Boolean);
    return flags.length ? `Mild signals detected - ${flags.join(" and ")}. Consider a short break.` : "Some mild stress signals present. A short break could help.";
  }
  if (score < 80) return "Multiple burnout signals active. Take a real break - not just a few minutes.";
  return "Critical signals detected. Step away, hydrate, and consider talking to someone you trust.";
}

function getInsights(readings: SensorReading[]): string[] {
  return readings.map(r => {
    if (r.label === "Emotion") {
      if (r.score < 30) return "Facial signals are healthy - expression patterns and eye openness show no stress markers.";
      if (r.score < 60) return "Mild facial stress is present - expression rigidity or reduced eye openness suggests early fatigue.";
      return "Facial signals are elevated - expression patterns and blink rate indicate clear cognitive strain.";
    }
    if (r.label === "Voice") {
      if (r.score < 30) return "Voice analysis is clean - vocal energy and pitch stability are within a healthy range.";
      if (r.score < 60) return "Your voice shows reduced energy with some instability, commonly preceding vocal fatigue.";
      return "Voice signals are significantly elevated - low energy combined with high pitch variation indicates strain.";
    }
    if (r.label === "Activity") {
      if (r.score < 30) return "Activity patterns look normal - keyboard engagement and idle ratio suggest focused presence.";
      if (r.score < 60) return "Activity is below typical engagement levels - reduced typing rate signals mental fatigue.";
      return "Activity patterns show notable disengagement - erratic behavior is a recognized burnout signal.";
    }
    return r.finding;
  });
}

function getRecs(score: number, readings: SensorReading[]): string[] {
  const out: string[] = [];
  const vo = readings.find(r => r.label === "Voice");
  const ac = readings.find(r => r.label === "Activity");
  const em = readings.find(r => r.label === "Emotion");
  if (score >= 60) out.push("Take a 15-20 minute break away from all screens");
  else if (score >= 30) out.push("Take a 5-minute break and step outside if possible");
  if (score >= 30) out.push("Box breathing: 4s inhale - 4s hold - 4s exhale - 4s hold");
  if (vo?.score && vo.score > 35) out.push("Rest your voice - avoid calls or extra talking for a bit");
  if (ac?.score && ac.score > 40) out.push("Move your body - even a 2-minute walk resets your state");
  if (em?.score && em.score > 50) out.push("Ground yourself: name 5 things you can see right now");
  if (score >= 70) out.push("Consider reaching out to a friend, counselor, or the 988 Lifeline");
  return out.slice(0, 4);
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const R = 66, C = 2 * Math.PI * R;
  return (
    <svg width={168} height={168} viewBox="0 0 168 168">
      <circle cx={84} cy={84} r={R} fill="none" stroke={W(0.1)} strokeWidth={10} />
      <motion.circle cx={84} cy={84} r={R} fill="none" stroke={color} strokeWidth={10}
        strokeLinecap="round" strokeDasharray={C}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: C * (1 - score / 100) }}
        transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
        style={{ rotate: -90, transformOrigin: "84px 84px" }} />
      <text x={84} y={78} textAnchor="middle" fill="#fff" fontSize={38} fontWeight={700}
        fontFamily="system-ui" style={{ fontVariantNumeric: "tabular-nums" }}>{score}</text>
      <text x={84} y={101} textAnchor="middle" fill={W(0.5)} fontSize={12}>{riskLabel(score)}</text>
    </svg>
  );
}

export default function EvaluatePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("ember_session");
    if (raw) { try { setSession(JSON.parse(raw)); } catch {} }
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <p style={{ color: W(0.4), fontSize: "0.875rem" }}>No session data found.</p>
        <button onClick={() => router.push("/")} style={{ ...GC, padding: "8px 20px", color: W(0.6), cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem" }}>
          <ArrowLeft size={13} /> Back to Ember
        </button>
      </div>
    );
  }

  const color    = riskColor(session.score);
  const summary  = interpret(session.score, session.readings);
  const insights = getInsights(session.readings);
  const recs     = getRecs(session.score, session.readings);
  const ts       = new Date(session.timestamp);
  const mins     = Math.floor(session.duration / 60);
  const secs     = session.duration % 60;

  return (
    <div style={{ minHeight: "100vh", background: "#000", position: "relative" }}>

      {/* ── Background ── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: `url('${BG}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, background: "rgba(0,0,0,0.48)" }} />

      {/* ── Content ── */}
      <div style={{ position: "relative", zIndex: 10 }}>

        {/* Header */}
        <div style={{ position: "sticky", top: 0, zIndex: 40, padding: "12px 24px", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${W(0.07)}`, background: "rgba(0,0,0,0.3)" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, height: 44 }}>
            <button onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 6, color: W(0.45), background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = W(0.45))}>
              <ArrowLeft size={13} /> Back
            </button>
            <div style={{ width: 1, height: 20, background: W(0.1) }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Activity size={12} color="#f59e0b" />
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#fff" }}>Ember</span>
            </div>
            <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: W(0.4) }}>Session Report</span>
          </div>
        </div>

        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 64px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── Hero: Score + Summary ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            style={{ ...GC, padding: 32, display: "grid", gridTemplateColumns: "auto 1fr", gap: 40, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <ScoreRing score={session.score} color={color} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: W(0.4) }}>
                <Clock size={11} />
                <span style={{ fontSize: "0.7rem" }}>
                  {ts.toLocaleDateString()} at {ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {session.duration > 0 && ` · ${mins > 0 ? `${mins}m ` : ""}${secs}s`}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <p style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: W(0.38), marginBottom: 8 }}>Overall Burnout Risk</p>
                <p style={{ fontSize: "1rem", lineHeight: 1.65, color: W(0.7) }}>{summary}</p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ ...GR, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle size={14} color="#4ade80" />
                  <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#4ade80" }}>Backend analysis complete</span>
                  <span style={{ fontSize: "0.7rem", color: W(0.35), marginLeft: 4 }}>{session.readings.length} sensors fused</span>
                </div>
                <div style={{ ...badgeStyle(session.score) }}>{riskLabel(session.score)}</div>
              </div>
            </div>
          </motion.div>

          {/* ── Risk Spectrum ── */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            style={{ ...GC, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: W(0.45) }}>Burnout Risk Spectrum</span>
              <span style={{ ...badgeStyle(session.score) }}>{session.score} / 100</span>
            </div>
            <div style={{ position: "relative" }}>
              <div style={{ height: 10, borderRadius: 999, overflow: "hidden", display: "flex" }}>
                <div style={{ background: "#4ade80", width: "30%" }} />
                <div style={{ background: "#facc15", width: "30%" }} />
                <div style={{ background: "#fb923c", width: "20%" }} />
                <div style={{ background: "#f87171", width: "20%" }} />
              </div>
              <motion.div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: color, border: "2.5px solid #000", top: "50%", marginTop: -8 }}
                initial={{ left: "0%" }}
                animate={{ left: `calc(${Math.min(96, session.score)}% - 8px)` }}
                transition={{ delay: 0.7, duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[{ l: "Low Risk", r: "0-29", c: "#4ade80" }, { l: "Moderate", r: "30-59", c: "#facc15" }, { l: "High Risk", r: "60-79", c: "#fb923c" }, { l: "Critical", r: "80+", c: "#f87171" }].map(z => (
                <div key={z.l} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ width: 20, height: 4, borderRadius: 999, background: z.c }} />
                  <span style={{ fontSize: "0.72rem", color: z.c === color ? "#fff" : W(0.35), fontWeight: z.c === color ? 600 : 400 }}>{z.l}</span>
                  <span style={{ fontSize: "0.62rem", color: W(0.25), fontFamily: "monospace" }}>{z.r}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Sensor Stat Cards ── */}
          {session.readings.length > 0 && (
            <div>
              <p style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: W(0.38), marginBottom: 14 }}>Sensor Breakdown</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                {session.readings.map((r, i) => {
                  const c    = riskColor(r.score);
                  const Icon = sensorIcon(r.label);
                  const grad = sensorGradient(r.label);
                  const TrendIcon = r.score > 59 ? TrendingUp : r.score < 30 ? TrendingDown : Minus;
                  return (
                    <motion.div key={r.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.08 }}
                      style={{ ...GC, padding: 22, display: "flex", flexDirection: "column", gap: 14, transition: "all 0.3s ease", cursor: "default" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: grad, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={16} color="#fff" />
                        </div>
                        <TrendIcon size={14} color={c} />
                      </div>
                      <div>
                        <p style={{ fontSize: "0.7rem", color: W(0.5), marginBottom: 4 }}>{r.label}</p>
                        <p style={{ fontSize: "2.2rem", fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{r.score}</p>
                        <p style={{ fontSize: "0.7rem", color: W(0.4), marginTop: 2 }}>/ 100</p>
                      </div>
                      <div>
                        <div style={{ height: 4, borderRadius: 999, background: W(0.08), overflow: "hidden", marginBottom: 10 }}>
                          <motion.div style={{ height: "100%", borderRadius: 999, background: riskGradient(r.score) }}
                            initial={{ width: 0 }} animate={{ width: `${r.score}%` }}
                            transition={{ delay: 0.35 + i * 0.08, duration: 0.8, ease: "easeOut" }} />
                        </div>
                        <p style={{ fontSize: "0.7rem", color: W(0.45), lineHeight: 1.5 }}>{r.finding}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${W(0.07)}` }}>
                        <span style={{ fontSize: "0.65rem", color: W(0.35) }}>Confidence</span>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#fff" }}>{Math.round(r.confidence * 100)}%</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Score Drivers + Insights (2-col) ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Score Drivers */}
            {session.attentionWeights.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                style={{ ...GC, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                <p style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: W(0.45) }}>Score Drivers</p>
                {session.attentionWeights.map((w, i) => {
                  const grad = sensorGradient(w.label);
                  return (
                    <div key={w.label} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.8rem", color: "#fff" }}>{w.label}</span>
                        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fff" }}>{w.pct.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: W(0.08), overflow: "hidden" }}>
                        <motion.div style={{ height: "100%", borderRadius: 999, background: grad }}
                          initial={{ width: 0 }} animate={{ width: `${w.pct}%` }}
                          transition={{ delay: 0.5 + i * 0.1, duration: 0.7, ease: "easeOut" }} />
                      </div>
                      <span style={{ fontSize: "0.65rem", color: W(0.3), fontFamily: "monospace" }}>
                        {w.zscore > 0 ? "+" : ""}{w.zscore.toFixed(1)}σ from baseline
                      </span>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {/* What the Data Suggests */}
            {insights.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
                style={{ ...GC, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: W(0.45) }}>What the Data Suggests</p>
                {insights.map((text, i) => {
                  const r     = session.readings[i];
                  const c     = r ? riskColor(r.score) : W(0.4);
                  const label = r?.label ?? "";
                  return (
                    <div key={i} style={{ ...GR, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 72, paddingTop: 1 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: c, flexShrink: 0 }} />
                        <span style={{ fontSize: "0.72rem", fontWeight: 600, color: c }}>{label}</span>
                      </div>
                      <p style={{ fontSize: "0.78rem", lineHeight: 1.5, color: W(0.55), flex: 1 }}>{text}</p>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </div>

          {/* ── Recommendations ── */}
          {recs.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: W(0.38) }}>Recommended Actions</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {recs.map((rec, i) => (
                  <div key={i} style={{ ...GC, padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 14,
                    transition: "all 0.3s ease" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: color + "22", border: `1px solid ${color}33`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <p style={{ fontSize: "0.85rem", lineHeight: 1.55, color: W(0.65) }}>{rec}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Action ── */}
          <div style={{ display: "flex", justifyContent: "flex-start", paddingTop: 8 }}>
            <button onClick={() => router.push("/")} style={{
              ...GC, padding: "11px 22px",
              display: "flex", alignItems: "center", gap: 8,
              color: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500,
              transition: "all 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}>
              <ArrowLeft size={14} /> New Session
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
