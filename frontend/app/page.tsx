"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, Play } from "lucide-react";

const VIDEO_SRC =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/bg-hero-0BnFGdr81Ifnj3WbBZoNt1KE4D5DMT.mp4";

const WORDS = ["understood", "assessed", "explained"];
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

export default function Home() {
  const router = useRouter();
  const [wordIndex, setWordIndex] = useState(0);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => { setHeroVisible(true); }, []);
  useEffect(() => {
    const id = setInterval(() => setWordIndex(index => (index + 1) % WORDS.length), 2600);
    return () => clearInterval(id);
  }, []);

  function goToEvaluate() { router.push("/evaluate"); }

  const fadeUp = (delay: number): React.CSSProperties => ({
    opacity: heroVisible ? 1 : 0,
    transform: heroVisible ? "none" : "translateY(18px)",
    transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
  });
  const PAD = "clamp(2.5rem, 7vw, 7rem)";

  return (
    <div className="original-page" style={{ background: "#000", minHeight: "100vh" }}>

      {/* ── Persistent cherry blossom video ─────────────────────────── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden" }}>
        <video autoPlay muted loop playsInline aria-hidden="true" style={{
          width: "100%", height: "100%", objectFit: "cover",
          opacity: 0.82,
          transition: "opacity 1.2s ease",
        }}>
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>

        {/* Idle: left vignette to keep text readable */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.55) 50%, transparent 100%)",
          opacity: 1,
          transition: "opacity 1.2s ease",
        }} />
        {/* Active: uniform dark overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.6)",
          opacity: 0,
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
        opacity: 0.14, transition: "opacity 1s ease",
      }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`h${i}`} style={{ position: "absolute", height: 1, left: 0, right: 0, top: `${12.5*(i+1)}%`, background: "rgba(255,255,255,0.12)" }} />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={`v${i}`} style={{ position: "absolute", width: 1, top: 0, bottom: 0, left: `${8.33*(i+1)}%`, background: "rgba(255,255,255,0.12)" }} />
        ))}
      </div>

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
                  <Shield size={10} /> Local workspace
                </span>
                <button onClick={goToEvaluate} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  background: "#fff", color: "#0a0a0a",
                  padding: "0.45rem 1.25rem", borderRadius: 999,
                  fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
                  border: "none", transition: "opacity 0.2s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                  <Play size={11} fill="currentColor" /> Assess burnout risk
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
                  Burnout assessment through AI agents
                  <span style={{ display: "inline-block", width: 24, height: 1, background: "rgba(255,255,255,0.2)" }} />
                </span>
              </div>

              <h1 className="font-garamond" style={{
                fontWeight: 500,
                fontSize: "clamp(3.6rem, 9.5vw, 9.5rem)",
                lineHeight: 1.0, color: "#fff", letterSpacing: "-0.01em",
                ...fadeUp(150),
              }}>
                <span style={{ display: "block", fontStyle: "normal" }}>Burnout risk,</span>
                <span style={{ display: "block" }}>
                  <span style={{ fontStyle: "italic" }}>
                    <BlurWord word={WORDS[wordIndex]} trigger={wordIndex} />
                  </span>
                  <span style={{ fontStyle: "normal", color: "rgba(255,255,255,0.82)" }}>{"."}</span>
                </span>
              </h1>

              <div style={{ maxWidth: 460, marginTop: 26, ...fadeUp(220) }}>
                <p style={{
                  fontSize: "clamp(1rem, 1.8vw, 1.1rem)",
                  color: "rgba(255,255,255,0.45)",
                  lineHeight: 1.75,
                }}>
                  AI agents connect your check-in with activity, face, voice, and chat signals to assess burnout risk, explain the evidence, and help you decide what comes next.
                </p>
                <div style={{ marginTop: 26, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <button onClick={goToEvaluate} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "#fff", color: "#0a0a0a",
                    padding: "0.75rem 2.2rem", borderRadius: 999,
                    fontSize: "0.95rem", fontWeight: 600, cursor: "pointer",
                    border: "none", boxShadow: "0 4px 28px rgba(255,255,255,0.1)",
                    transition: "all 0.2s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}>
                    <Play size={13} fill="currentColor" /> Assess burnout risk
                  </button>
                  <button onClick={() => router.push("/dashboard")} style={{ color: "#d1c5b3", background: "transparent", border: "none", padding: "10px", cursor: "pointer", fontSize: "0.85rem" }}>
                    Collect session signals first
                  </button>
                  <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.05em" }}>
                    Your experience first. Every assessment comes with its reasoning.
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
                    Your check-in · Activity patterns · Voice features · Facial expression · Conversation context ·
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
                    Context agent · Signal agent · Burnout risk assessment · Conditional outlook · Next steps ·
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
                  { value: "Context", label: "your experience first" },
                  { value: "Signals", label: "evidence you choose" },
                  { value: "Agents", label: "connected reasoning" },
                  { value: "Outlook", label: "practical next steps" },
                ].map(s => (
                  <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span className="font-garamond" style={{ fontStyle: "italic", fontWeight: 500, color: "#fff", fontSize: "clamp(1.3rem, 2.6vw, 2.2rem)" }}>{s.value}</span>
                    <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
    </div>
  );
}
