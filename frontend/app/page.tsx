"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Shield, Play, MessageSquare, X, ChevronRight, Eye, Mic } from "lucide-react";
import LiveBadge    from "../components/LiveBadge";
import FaceCam      from "../components/FaceCam";
import VoicePanel   from "../components/VoicePanel";
import ChatPanel    from "../components/ChatPanel";
import { useLiveStream }      from "../hooks/useLiveStream";
import { useActivityTracker } from "../hooks/useActivityTracker";

const VIDEO_SRC =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/bg-hero-0BnFGdr81Ifnj3WbBZoNt1KE4D5DMT.mp4";

const WORDS = ["detected", "prevented", "understood", "addressed"];
const BLUR_GRAD = ["#f59e0b", "#fb923c", "#fbbf24", "#f97316", "#f59e0b"];

// ── BlurWord ───────────────────────────────────────────────────────────────
function BlurWord({ word, trigger }: { word: string; trigger: number }) {
  const STAGGER = 50, DUR = 480;
  const letters = word.split("");
  const [states, setStates] = useState<{ o: number; b: number }[]>(letters.map(() => ({ o: 0, b: 18 })));
  const [gradOn, setGradOn] = useState(true);
  const rafs = useRef<number[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const h2r = (hex: string) => [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];

  useEffect(() => {
    rafs.current.forEach(cancelAnimationFrame);
    timers.current.forEach(clearTimeout);
    rafs.current = []; timers.current = [];
    setStates(letters.map(() => ({ o: 0, b: 18 })));
    setGradOn(true);
    letters.forEach((_, i) => {
      const t = setTimeout(() => {
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / DUR, 1);
          const e = 1 - Math.pow(1 - p, 3);
          setStates(prev => { const n = [...prev]; n[i] = { o: e, b: 18*(1-e) }; return n; });
          if (p < 1) rafs.current.push(requestAnimationFrame(tick));
        };
        rafs.current.push(requestAnimationFrame(tick));
      }, i * STAGGER);
      timers.current.push(t);
    });
    const gt = setTimeout(() => setGradOn(false), STAGGER * letters.length + DUR + 300);
    timers.current.push(gt);
    return () => { rafs.current.forEach(cancelAnimationFrame); timers.current.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <>
      {letters.map((char, i) => {
        const ci = (i / Math.max(letters.length - 1, 1)) * (BLUR_GRAD.length - 1);
        const lo = Math.floor(ci), hi = Math.min(lo + 1, BLUR_GRAD.length - 1), ft = ci - lo;
        const [r1,g1,b1] = h2r(BLUR_GRAD[lo]), [r2,g2,b2] = h2r(BLUR_GRAD[hi]);
        const r = Math.round(r1+(r2-r1)*ft), g = Math.round(g1+(g2-g1)*ft), b = Math.round(b1+(b2-b1)*ft);
        return (
          <span key={`${trigger}-${i}`} style={{
            display: "inline-block",
            opacity: states[i]?.o ?? 0,
            filter: `blur(${(states[i]?.b ?? 18).toFixed(1)}px)`,
            color: gradOn ? `rgb(${r},${g},${b})` : "var(--amber)",
            transition: "color 0.4s ease",
          }}>{char}</span>
        );
      })}
    </>
  );
}

// ── Score helpers ──────────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s < 30) return "#22c55e"; if (s < 60) return "#f59e0b";
  if (s < 80) return "#f97316"; return "#ef4444";
}
function scoreLabel(s: number) {
  if (s < 30) return "Low Risk"; if (s < 60) return "Moderate";
  if (s < 80) return "High Risk"; return "Critical";
}

// ── Glass style helpers ────────────────────────────────────────────────────
const glass = (opacity = 0.55, blur = 22): React.CSSProperties => ({
  background: `rgba(4,4,4,${opacity})`,
  backdropFilter: `blur(${blur}px)`,
  WebkitBackdropFilter: `blur(${blur}px)`,
  border: "1px solid rgba(255,255,255,0.07)",
});

// ── Main page ──────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const [sessionActive, setSessionActive] = useState(false);
  const [chatOpen, setChatOpen]           = useState(false);
  const [wordIndex, setWordIndex]         = useState(0);
  const [heroVisible, setHeroVisible]     = useState(false);
  const sessionStartRef = useRef<number>(0);

  const live        = useLiveStream();
  const localVitals = useActivityTracker(sessionActive);

  useEffect(() => { setHeroVisible(true); }, []);
  useEffect(() => {
    const id = setInterval(() => setWordIndex(i => (i + 1) % WORDS.length), 2600);
    return () => clearInterval(id);
  }, []);

  function startSession() { sessionStartRef.current = Date.now(); setSessionActive(true); live.connect(); }
  function stopSession()  { setSessionActive(false); live.disconnect(); setChatOpen(false); }
  function goToEvaluate() {
    localStorage.setItem("ember_session", JSON.stringify({
      score: live.state.riskScore ?? 0, readings: live.state.readings,
      attentionWeights: live.state.attentionWeights,
      timestamp: new Date().toISOString(),
      duration: Math.floor((Date.now() - sessionStartRef.current) / 1000),
    }));
    router.push("/evaluate");
  }

  const vitals = live.state.vitals ?? (localVitals ? {
    mouse_velocity: localVitals.mouse_velocity_px_s,
    key_rate:       localVitals.key_rate_per_min,
    idle_ratio:     localVitals.idle_ratio,
  } : null);

  const hasScore = live.state.riskScore !== null;
  const score    = live.state.riskScore ?? 0;
  const color    = scoreColor(score);

  useEffect(() => {
    document.title = sessionActive && hasScore ? `${score} ${scoreLabel(score)} - Ember` : "Ember";
    return () => { document.title = "Ember"; };
  }, [sessionActive, hasScore, score]);

  const fadeUp = (delay: number): React.CSSProperties => ({
    opacity: heroVisible ? 1 : 0,
    transform: heroVisible ? "none" : "translateY(18px)",
    transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
  });

  const PAD = "clamp(2.5rem, 7vw, 7rem)";

  return (
    <div style={{ background: "#000", minHeight: "100vh" }}>

      {/* ── Persistent cherry blossom video ─────────────────────────── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden" }}>
        <video autoPlay muted loop playsInline aria-hidden="true" style={{
          width: "100%", height: "100%", objectFit: "cover",
          opacity: sessionActive ? 0.22 : 0.82,
          transition: "opacity 1.2s ease",
        }}>
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>

        {/* Idle: left vignette to keep text readable */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.55) 50%, transparent 100%)",
          opacity: sessionActive ? 0 : 1,
          transition: "opacity 1.2s ease",
        }} />
        {/* Active: uniform dark overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.6)",
          opacity: sessionActive ? 1 : 0,
          transition: "opacity 1.2s ease",
        }} />
        {/* Always: bottom vignette */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 40%, rgba(0,0,0,0.75) 100%)",
        }} />
      </div>

      {/* ── Grid lines (idle only) ───────────────────────────────────── */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 1, overflow: "hidden", pointerEvents: "none",
        opacity: sessionActive ? 0 : 0.14, transition: "opacity 1s ease",
      }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`h${i}`} style={{ position: "absolute", height: 1, left: 0, right: 0, top: `${12.5*(i+1)}%`, background: "rgba(255,255,255,0.12)" }} />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={`v${i}`} style={{ position: "absolute", width: 1, top: 0, bottom: 0, left: `${8.33*(i+1)}%`, background: "rgba(255,255,255,0.12)" }} />
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ══ IDLE HERO ═══════════════════════════════════════════════════ */}
        {!sessionActive && (
          <motion.div key="idle"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ position: "relative", zIndex: 10, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

            {/* Navbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 72, padding: `0 ${PAD}`, ...fadeUp(0) }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span className="font-sora" style={{ fontWeight: 800, fontSize: "1.2rem", color: "#fff", letterSpacing: "-0.01em" }}>EMBER</span>
                <span style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>TM</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8rem", color: "rgba(255,255,255,0.35)" }}>
                  <Shield size={10} /> On-device only
                </span>
                <button onClick={startSession} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  background: "#fff", color: "#0a0a0a",
                  padding: "0.45rem 1.25rem", borderRadius: 999,
                  fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
                  border: "none", transition: "opacity 0.2s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                  <Play size={11} fill="currentColor" /> Start Session
                </button>
              </div>
            </div>

            {/* Hero headline - centered, EB Garamond */}
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              justifyContent: "center", alignItems: "center",
              textAlign: "center", padding: `0 ${PAD}`, paddingBottom: "1rem",
            }}>
              <div style={{ marginBottom: 22, ...fadeUp(80) }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 12,
                  fontSize: "0.72rem", fontFamily: "ui-monospace, monospace",
                  color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase",
                }}>
                  <span style={{ display: "inline-block", width: 24, height: 1, background: "rgba(255,255,255,0.2)" }} />
                  Real-time burnout detection
                  <span style={{ display: "inline-block", width: 24, height: 1, background: "rgba(255,255,255,0.2)" }} />
                </span>
              </div>

              <h1 className="font-garamond" style={{
                fontWeight: 500,
                fontSize: "clamp(3.6rem, 9.5vw, 9.5rem)",
                lineHeight: 1.0, color: "#fff", letterSpacing: "-0.01em",
                ...fadeUp(150),
              }}>
                <span style={{ display: "block", fontStyle: "normal" }}>Burnout,</span>
                <span style={{ display: "block" }}>
                  <span style={{ fontStyle: "italic" }}>
                    <BlurWord word={WORDS[wordIndex]} trigger={wordIndex} />
                  </span>
                  <span style={{ fontStyle: "normal", color: "rgba(255,255,255,0.82)" }}>{" early."}</span>
                </span>
              </h1>

              <div style={{ maxWidth: 460, marginTop: 26, ...fadeUp(220) }}>
                <p style={{
                  fontSize: "clamp(1rem, 1.8vw, 1.1rem)",
                  color: "rgba(255,255,255,0.45)",
                  lineHeight: 1.75,
                }}>
                  A check engine light for your mental state. Ember watches how you work, never what you say.
                </p>
                <div style={{ marginTop: 26, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <button onClick={startSession} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "#fff", color: "#0a0a0a",
                    padding: "0.75rem 2.2rem", borderRadius: 999,
                    fontSize: "0.95rem", fontWeight: 600, cursor: "pointer",
                    border: "none", boxShadow: "0 4px 28px rgba(255,255,255,0.1)",
                    transition: "all 0.2s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}>
                    <Play size={13} fill="currentColor" /> Start Session
                  </button>
                  <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.05em" }}>
                    On-device · Zero data sent · Works passively
                  </span>
                </div>
              </div>
            </div>

            {/* SVG Marquee - Wispr Flow style, two curves side by side */}
            <div style={{
              width: "100%", overflow: "hidden",
              display: "grid", gridTemplateColumns: "1fr 1fr",
              opacity: heroVisible ? 1 : 0,
              transition: "opacity 1s ease 600ms",
            }}>
              {/* Left: raw behavioral signals (faded, waving curve) */}
              <svg width="100%" height="auto" viewBox="0 0 1048 594">
                <path id="ember-curve-signals"
                  d="M0.597656 50.924805C17.4612 143.2965 97.8522 293.141 284.508 353.548C440.828 399.056 583.839 294.067 500.618 184.7492C417.397 75.4309 238.217 282.098 499.258 441.668C551.913 477.802 817.468 561.26 1046.43 565.235"
                  fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1"
                />
                <text x={-3300} style={{ fontSize: "14px", fill: "rgba(255,255,255,0.2)", fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace" } as React.CSSProperties}>
                  <textPath href="#ember-curve-signals">
                    3:47am message · 89% idle time · reply latency +340% · social graph -4 contacts · typing rate 14wpm · missed standup day 3 · mouse velocity 12px/s · key rate below baseline · 3:47am message · 89% idle time · reply latency +340% · social graph shrinking · typing 14wpm ·
                  </textPath>
                  <animate attributeName="x" dur="38s" values="-3300; 0" repeatCount="indefinite" />
                </text>
              </svg>

              {/* Right: Ember insight (amber, near-bottom horizontal curve) */}
              <svg width="100%" height="auto" viewBox="0 0 1024 620">
                <path id="ember-curve-insight"
                  d="M2.04309 563.872C111.592 558.268 316.491 554.016 517.963 490.064C703.017 431.323 875.319 444.531 1021.88 453.216"
                  fill="none" stroke="rgba(245,158,11,0.06)" strokeWidth="28"
                />
                <text x={-4500} style={{ fontSize: "14px", fill: "rgba(245,158,11,0.72)", fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontWeight: 600 } as React.CSSProperties}>
                  <textPath href="#ember-curve-insight">
                    Sleep drift: 4.2 nights detected · Social withdrawal: significant · Cognitive fatigue: elevated · Burnout risk score: 78 — High Risk · Early intervention recommended · Sleep drift: 4.2 nights · Social withdrawal: significant · Cognitive fatigue: elevated ·
                  </textPath>
                  <animate attributeName="x" dur="60s" values="-4500; 0" repeatCount="indefinite" />
                </text>
              </svg>
            </div>

            {/* Stats bar - centered */}
            <div style={{
              padding: `0 ${PAD} 2.5rem`,
              opacity: heroVisible ? 1 : 0, transition: "opacity 0.7s ease 700ms",
            }}>
              <div style={{
                display: "flex", alignItems: "flex-start", justifyContent: "center",
                gap: "clamp(2rem, 5vw, 5.5rem)",
                borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 20,
              }}>
                {[
                  { value: "3",      label: "active sensors"     },
                  { value: "0 data", label: "sent to servers"    },
                  { value: "<50ms",  label: "detection speed"    },
                  { value: "5+",     label: "biometric signals"  },
                ].map(s => (
                  <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span className="font-garamond" style={{ fontStyle: "italic", fontWeight: 500, color: "#fff", fontSize: "clamp(1.3rem, 2.6vw, 2.2rem)" }}>{s.value}</span>
                    <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ══ ACTIVE SESSION ══════════════════════════════════════════════ */}
        {sessionActive && (
          <motion.div key="active"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{ position: "relative", zIndex: 10, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

            {/* Sticky glass pill header */}
            <div style={{ padding: "12px 16px", position: "sticky", top: 0, zIndex: 40 }}>
              <div style={{
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 18, maxWidth: 960, margin: "0 auto",
                padding: "0 20px", height: 56,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
              }}>
                {/* Left: logo + badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,rgba(245,158,11,0.3),rgba(249,115,22,0.3))", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Activity size={14} color="#f59e0b" />
                  </div>
                  <span className="font-sora" style={{ fontWeight: 800, fontSize: "0.9rem", color: "#fff", letterSpacing: "-0.01em" }}>EMBER</span>
                  <LiveBadge connected={live.state.connected} waiting={live.state.waiting} />
                </div>

                {/* Center: live score ring */}
                {hasScore && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Mini circular indicator */}
                    <svg width={36} height={36} viewBox="0 0 36 36">
                      <circle cx={18} cy={18} r={14} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
                      <circle cx={18} cy={18} r={14} fill="none" stroke={color} strokeWidth={3}
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 14}`}
                        strokeDashoffset={`${2 * Math.PI * 14 * (1 - score / 100)}`}
                        style={{ rotate: "-90deg", transformOrigin: "18px 18px" }} />
                      <text x={18} y={22} textAnchor="middle" fill={color} fontSize={9} fontWeight={700}>{score}</text>
                    </svg>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>{scoreLabel(score)}</span>
                      <span className="wf-label" style={{ marginBottom: 0, fontSize: "0.58rem" }}>risk score</span>
                    </div>
                  </div>
                )}

                {/* Right: evaluate button */}
                <button onClick={() => hasScore && goToEvaluate()} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "7px 16px", borderRadius: 12, fontSize: "0.78rem", fontWeight: 600,
                  background: hasScore ? color + "20" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${hasScore ? color + "40" : "rgba(255,255,255,0.08)"}`,
                  color: hasScore ? color : "rgba(255,255,255,0.25)",
                  cursor: hasScore ? "pointer" : "default", opacity: hasScore ? 1 : 0.4,
                  transition: "all 0.2s",
                }}>
                  Evaluate {hasScore && <ChevronRight size={12} />}
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, maxWidth: 960, margin: "0 auto", width: "100%", padding: "12px 20px 28px", display: "flex", flexDirection: "column", gap: 12 }}>

              {/* System stats strip */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {[
                  { value: "3", label: "sensors active", color: "#4ade80" },
                  { value: "<50ms", label: "detection speed", color: "#60a5fa" },
                  { value: "Groq AI", label: "chat model", color: "#a78bfa" },
                  { value: "100%", label: "on-device", color: "#f59e0b" },
                ].map(s => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 14px", display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: s.color }}>{s.value}</span>
                    <span className="wf-label" style={{ marginBottom: 0, fontSize: "0.6rem" }}>{s.label}</span>
                  </div>
                ))}
                {/* Vitals inline */}
                {vitals && (
                  <>
                    <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)", margin: "0 2px" }} />
                    {[
                      { v: vitals.mouse_velocity.toFixed(0),              l: "px/s", warn: false },
                      { v: vitals.key_rate.toFixed(0),                    l: "kpm",  warn: vitals.key_rate < 60 },
                      { v: `${(vitals.idle_ratio * 100).toFixed(0)}%`,   l: "idle", warn: vitals.idle_ratio > 0.55 },
                    ].map(x => (
                      <div key={x.l} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: x.warn ? "#f59e0b" : "#fff", fontVariantNumeric: "tabular-nums" }}>{x.v}</span>
                        <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.3)" }}>{x.l}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Camera + Voice glass panels with panel headers */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
                ["--surface" as string]:   "transparent",
                ["--surface-2" as string]: "rgba(255,255,255,0.03)",
                ["--border" as string]:    "rgba(255,255,255,0.1)",
                ["--muted" as string]:     "rgba(255,255,255,0.48)",
                ["--muted-2" as string]:   "rgba(255,255,255,0.25)",
                ["--text" as string]:      "#ffffff",
                ["--amber" as string]:     "#f59e0b",
              } as React.CSSProperties}>

                {/* Camera glass card */}
                <div style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 22, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.3)" }}>
                  {/* Panel header */}
                  <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.04)" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#60a5fa,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Eye size={13} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#fff" }}>Face Analysis</div>
                      <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.38)" }}>Emotion · PERCLOS · Pose</div>
                    </div>
                  </div>
                  <FaceCam />
                </div>

                {/* Voice glass card */}
                <div style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 22, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.3)" }}>
                  {/* Panel header */}
                  <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.04)" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#a78bfa,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Mic size={13} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#fff" }}>Voice Analysis</div>
                      <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.38)" }}>Energy · Pitch · Jitter</div>
                    </div>
                  </div>
                  <VoicePanel active={sessionActive} />
                </div>
              </div>

              {/* End session */}
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
                <button onClick={stopSession} style={{
                  background: "rgba(255,255,255,0.07)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
                  padding: "9px 24px", fontSize: "0.8rem", color: "rgba(255,255,255,0.45)",
                  cursor: "pointer", transition: "all 0.2s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}>
                  End session
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating chat button */}
      {sessionActive && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 20 }}
          onClick={() => setChatOpen(v => !v)}
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 50,
            width: 56, height: 56, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", border: "none",
            background: chatOpen ? "rgba(10,10,10,0.75)" : "var(--amber)",
            boxShadow: chatOpen ? "none" : "0 8px 32px rgba(245,158,11,0.4)",
            backdropFilter: chatOpen ? "blur(16px)" : "none",
            transition: "background 0.2s, box-shadow 0.2s",
          }}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}>
          {chatOpen
            ? <X size={20} color="rgba(255,255,255,0.6)" />
            : <MessageSquare size={20} color="#000" />}
        </motion.button>
      )}

      {/* Chat side panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 40,
              width: 380, display: "flex", flexDirection: "column",
              ...glass(0.72, 28),
              borderLeft: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "-12px 0 50px rgba(0,0,0,0.5)",
            }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "16px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(0,0,0,0.25)",
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#000",
              }}>E</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#fff" }}>Ember AI</span>
                <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)" }}>Wellness companion</span>
              </div>
              <button onClick={() => setChatOpen(false)} style={{
                marginLeft: "auto", background: "none", border: "none",
                color: "rgba(255,255,255,0.35)", cursor: "pointer", padding: 6, borderRadius: 8,
                transition: "color 0.2s",
              }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}>
                <X size={15} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <ChatPanel active={chatOpen} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
