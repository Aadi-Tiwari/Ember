"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle, TrendingUp, TrendingDown,
  Minus, Clock, Eye, Mic, MessageSquare, Zap,
} from "lucide-react";

const BG = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Fractal%20Glass%20-%204.jpg-8QPt1A02QgjJIeTqwEYV5thwZXXEGT.jpeg";

type SensorReading   = { label: string; score: number; finding: string; confidence: number; zscore?: number };
type AttentionWeight = { label: string; pct: number; zscore: number };
type SessionData = {
  score: number; readings: SensorReading[]; attentionWeights: AttentionWeight[];
  timestamp: string; duration: number;
};

const W  = (o: number): string => `rgba(255,255,255,${o})`;
const GC: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20,
};

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
    return flags.length ? `Mild signals detected: ${flags.join(" and ")}. Consider a short break.` : "Some mild stress signals present. A short break could help.";
  }
  if (score < 80) return "Multiple burnout signals active. Take a real break, not just a few minutes.";
  return "Critical signals detected. Step away, hydrate, and consider talking to someone you trust.";
}

function getInsights(readings: SensorReading[]): string[] {
  return readings.map(r => {
    if (r.label === "Emotion") {
      if (r.score < 30) return "Facial signals are healthy. Expression patterns and eye openness show no stress markers.";
      if (r.score < 60) return "Mild facial stress present. Expression rigidity or reduced eye openness suggests early fatigue.";
      return "Facial signals are elevated. Expression patterns and blink rate indicate clear cognitive strain.";
    }
    if (r.label === "Voice") {
      if (r.score < 30) return "Voice analysis is clean. Vocal energy and pitch stability are within a healthy range.";
      if (r.score < 60) return "Voice shows reduced energy with some instability, commonly preceding vocal fatigue.";
      return "Voice signals are significantly elevated. Low energy combined with high pitch variation indicates strain.";
    }
    if (r.label === "Activity") {
      if (r.score < 30) return "Activity patterns look normal. Keyboard engagement and idle ratio suggest focused presence.";
      if (r.score < 60) return "Activity is below typical engagement. Reduced typing rate signals mental fatigue.";
      return "Activity patterns show notable disengagement. Erratic behavior is a recognized burnout signal.";
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
  if (score >= 30) out.push("Box breathing: 4s inhale, 4s hold, 4s exhale, 4s hold");
  if (vo?.score && vo.score > 35) out.push("Rest your voice. Avoid calls or extra talking for a bit");
  if (ac?.score && ac.score > 40) out.push("Move your body. Even a 2-minute walk resets your state");
  if (em?.score && em.score > 50) out.push("Ground yourself: name 5 things you can see right now");
  if (score >= 70) out.push("Consider reaching out to a friend, counselor, or the 988 Lifeline");
  return out.slice(0, 4);
}

// Section label - Wispr Flow style
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="wf-label" style={{ marginBottom: 16 }}>{children}</p>
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
      <div style={{ minHeight: "100vh", background: "#080808", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <p className="font-garamond" style={{ color: W(0.35), fontSize: "1.5rem", fontStyle: "italic" }}>No session data found.</p>
        <button onClick={() => router.push("/")} style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "#fff", color: "#000", padding: "10px 22px",
          borderRadius: 999, border: "none", cursor: "pointer",
          fontSize: "0.85rem", fontWeight: 600,
        }}>
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
    <div style={{ minHeight: "100vh", background: "#080808", position: "relative" }}>

      {/* Background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: `url('${BG}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, background: "rgba(0,0,0,0.55)" }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 10 }}>

        {/* Sticky pill header - matches Wispr Flow / Ember nav style */}
        <div style={{ padding: "12px 20px", position: "sticky", top: 0, zIndex: 40 }}>
          <div style={{
            maxWidth: 900, margin: "0 auto",
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
            border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16,
            padding: "0 20px", height: 52,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
          }}>
            <button onClick={() => router.push("/")} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer",
              color: W(0.4), fontSize: "0.82rem", fontWeight: 500,
              transition: "color 0.2s", padding: 0,
            }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = W(0.4))}>
              <ArrowLeft size={13} /> Back
            </button>

            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span className="font-sora" style={{ fontWeight: 800, fontSize: "0.9rem", color: "#fff", letterSpacing: "-0.01em" }}>EMBER</span>
              <span style={{ fontSize: "0.45rem", color: W(0.25), letterSpacing: "0.06em" }}>TM</span>
            </div>

            <span className="wf-label" style={{ marginBottom: 0 }}>Session Report</span>
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 24px 80px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── Hero: Editorial score display ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            style={{ ...GC, padding: "36px 40px", display: "grid", gridTemplateColumns: "auto 1fr", gap: 48, alignItems: "center" }}>

            {/* Large editorial score */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span className="font-garamond" style={{
                fontSize: "7rem", fontStyle: "italic", fontWeight: 400,
                color, lineHeight: 1, letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
              }}>
                {session.score}
              </span>
              <span style={{
                fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.12em",
                textTransform: "uppercase", color, opacity: 0.85,
              }}>
                {riskLabel(session.score)}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 5, color: W(0.3), marginTop: 4 }}>
                <Clock size={10} />
                <span style={{ fontSize: "0.65rem" }}>
                  {ts.toLocaleDateString()} · {ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {session.duration > 0 && ` · ${mins > 0 ? `${mins}m ` : ""}${secs}s`}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <Label>Overall Burnout Risk</Label>
                <p className="font-garamond" style={{ fontSize: "1.25rem", lineHeight: 1.6, color: W(0.75), fontStyle: "italic" }}>
                  {summary}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <CheckCircle size={13} color="#4ade80" />
                  <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#4ade80" }}>Analysis complete</span>
                  <span style={{ fontSize: "0.7rem", color: W(0.3) }}>{session.readings.length} sensors fused</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Risk Spectrum ── */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}
            style={{ ...GC, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Label>Burnout Risk Spectrum</Label>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, color, letterSpacing: "0.04em" }}>{session.score} / 100</span>
            </div>
            <div style={{ position: "relative" }}>
              <div style={{ height: 8, borderRadius: 999, overflow: "hidden", display: "flex" }}>
                <div style={{ background: "#4ade80", width: "30%" }} />
                <div style={{ background: "#facc15", width: "30%" }} />
                <div style={{ background: "#fb923c", width: "20%" }} />
                <div style={{ background: "#f87171", width: "20%" }} />
              </div>
              <motion.div style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", background: color, border: "2px solid #000", top: "50%", marginTop: -7 }}
                initial={{ left: "0%" }}
                animate={{ left: `calc(${Math.min(96, session.score)}% - 7px)` }}
                transition={{ delay: 0.6, duration: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 4 }}>
              {[
                { l: "Low Risk", r: "0-29", c: "#4ade80" },
                { l: "Moderate", r: "30-59", c: "#facc15" },
                { l: "High Risk", r: "60-79", c: "#fb923c" },
                { l: "Critical",  r: "80+",   c: "#f87171" },
              ].map(z => (
                <div key={z.l} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ width: 18, height: 3, borderRadius: 999, background: z.c }} />
                  <span style={{ fontSize: "0.72rem", color: z.c === color ? "#fff" : W(0.3), fontWeight: z.c === color ? 600 : 400 }}>{z.l}</span>
                  <span style={{ fontSize: "0.6rem", color: W(0.22), fontFamily: "ui-monospace, monospace" }}>{z.r}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Sensor Breakdown ── */}
          {session.readings.length > 0 && (
            <div>
              <Label>Sensor Breakdown</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {session.readings.map((r, i) => {
                  const c    = riskColor(r.score);
                  const Icon = sensorIcon(r.label);
                  const grad = sensorGradient(r.label);
                  const TrendIcon = r.score > 59 ? TrendingUp : r.score < 30 ? TrendingDown : Minus;
                  return (
                    <motion.div key={r.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.18 + i * 0.07 }}
                      style={{ ...GC, padding: 22, display: "flex", flexDirection: "column", gap: 14, transition: "background 0.25s", cursor: "default" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.11)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: grad, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={15} color="#fff" />
                        </div>
                        <TrendIcon size={14} color={c} />
                      </div>
                      <div>
                        <p className="wf-label" style={{ marginBottom: 4 }}>{r.label}</p>
                        <p className="font-garamond" style={{ fontSize: "2.8rem", fontStyle: "italic", fontWeight: 400, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{r.score}</p>
                      </div>
                      <div>
                        <div style={{ height: 3, borderRadius: 999, background: W(0.07), overflow: "hidden", marginBottom: 10 }}>
                          <motion.div style={{ height: "100%", borderRadius: 999, background: riskGradient(r.score) }}
                            initial={{ width: 0 }} animate={{ width: `${r.score}%` }}
                            transition={{ delay: 0.3 + i * 0.07, duration: 0.8, ease: "easeOut" }} />
                        </div>
                        <p style={{ fontSize: "0.72rem", color: W(0.42), lineHeight: 1.55 }}>{r.finding}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${W(0.06)}` }}>
                        <span className="wf-label" style={{ marginBottom: 0 }}>Confidence</span>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#fff" }}>{Math.round(r.confidence * 100)}%</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Score Drivers + Insights ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

            {session.attentionWeights.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                style={{ ...GC, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                <Label>Score Drivers</Label>
                {session.attentionWeights.map((w, i) => (
                  <div key={w.label} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 500 }}>{w.label}</span>
                      <span className="font-garamond" style={{ fontSize: "1.1rem", fontStyle: "italic", color: "#fff" }}>{w.pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: W(0.07), overflow: "hidden" }}>
                      <motion.div style={{ height: "100%", borderRadius: 999, background: sensorGradient(w.label) }}
                        initial={{ width: 0 }} animate={{ width: `${w.pct}%` }}
                        transition={{ delay: 0.45 + i * 0.08, duration: 0.7, ease: "easeOut" }} />
                    </div>
                    <span style={{ fontSize: "0.64rem", color: W(0.28), fontFamily: "ui-monospace, monospace" }}>
                      {w.zscore > 0 ? "+" : ""}{w.zscore.toFixed(1)}σ from baseline
                    </span>
                  </div>
                ))}
              </motion.div>
            )}

            {insights.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                style={{ ...GC, padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                <Label>What the Data Suggests</Label>
                {insights.map((text, i) => {
                  const r     = session.readings[i];
                  const c     = r ? riskColor(r.score) : W(0.4);
                  const label = r?.label ?? "";
                  return (
                    <div key={i} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 70, paddingTop: 2 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: c, flexShrink: 0 }} />
                        <span style={{ fontSize: "0.7rem", fontWeight: 600, color: c }}>{label}</span>
                      </div>
                      <p style={{ fontSize: "0.78rem", lineHeight: 1.55, color: W(0.5), flex: 1 }}>{text}</p>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </div>

          {/* ── Recommendations ── */}
          {recs.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Label>Recommended Actions</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {recs.map((rec, i) => (
                  <div key={i} style={{ ...GC, padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 14, transition: "background 0.25s", cursor: "default" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.11)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}>
                    <span className="font-garamond" style={{ fontSize: "1.4rem", fontStyle: "italic", fontWeight: 400, color, lineHeight: 1, flexShrink: 0, opacity: 0.9 }}>
                      {i + 1}.
                    </span>
                    <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: W(0.62) }}>{rec}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Back ── */}
          <div style={{ paddingTop: 8 }}>
            <button onClick={() => router.push("/")} style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "#fff", color: "#000", padding: "11px 22px",
              borderRadius: 999, border: "none", cursor: "pointer",
              fontSize: "0.875rem", fontWeight: 600, transition: "opacity 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
              <ArrowLeft size={13} /> New Session
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
