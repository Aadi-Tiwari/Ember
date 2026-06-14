"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Mic } from "lucide-react";
import { useVoiceAnalyzer } from "../hooks/useVoiceAnalyzer";

type Props = { active: boolean };

const N_BARS = 48;

// Deterministic noise per bar (no Math.random - prevents hydration mismatch)
const NOISE = Array.from({ length: N_BARS }, (_, i) =>
  0.55 + 0.45 * Math.abs(Math.sin(i * 1.9 + 0.7))
);

function jitterColor(j: number) {
  if (j < 10) return "#22c55e";
  if (j < 25) return "#f59e0b";
  return "#ef4444";
}

export default function VoicePanel({ active }: Props) {
  const voice = useVoiceAnalyzer(active);

  const energy     = voice?.energy      ?? 0;
  const speaking   = voice?.is_speaking ?? false;
  const pitchHz    = voice?.pitch_hz    ?? -1;
  const jitterPct  = Math.round((voice?.jitter ?? 0) * 100);
  const cadencePct = Math.round((voice?.cadence ?? 0) * 100);
  const energyPct  = Math.min(100, Math.round(energy * 200));

  return (
    <div className="rounded-2xl flex flex-col overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

      {/* ── Visualizer ── */}
      <div className="relative flex items-center justify-center gap-px px-5 overflow-hidden"
        style={{ height: 220, background: "var(--surface-2)", flexShrink: 0 }}>

        {active && voice ? (
          <>
            {/* Bars - grow from center */}
            {Array.from({ length: N_BARS }).map((_, i) => {
              const envelope = Math.sin((i / N_BARS) * Math.PI); // bell curve
              const height   = speaking
                ? Math.max(6, envelope * energy * 180 * NOISE[i])
                : 4 + envelope * 18 * NOISE[i];

              const alpha = speaking
                ? (0.35 + 0.65 * NOISE[i]).toFixed(2)
                : "0.25";

              return (
                <motion.div
                  key={i}
                  className="rounded-full flex-1"
                  style={{
                    background: speaking
                      ? `rgba(245,158,11,${alpha})`
                      : `rgba(255,255,255,0.1)`,
                    maxWidth: 5,
                    minWidth: 2,
                  }}
                  animate={{ height: Math.max(4, Math.min(200, height)) }}
                  transition={{ duration: 0.11, ease: "easeOut" }}
                />
              );
            })}

            {/* Glow behind bars when speaking */}
            {speaking && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.06, 0.14, 0.06] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ background: "radial-gradient(ellipse at center, rgba(245,158,11,0.3) 0%, transparent 70%)" }}
              />
            )}

            {/* Status pill - bottom left */}
            <div className="absolute bottom-3.5 left-5 flex items-center gap-1.5">
              <motion.div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: speaking ? "var(--amber)" : "var(--muted)" }}
                animate={{ opacity: speaking ? [1, 0.25, 1] : 0.6 }}
                transition={{ duration: 0.75, repeat: speaking ? Infinity : 0 }}
              />
              <span className="text-xs font-medium"
                style={{ color: speaking ? "var(--amber)" : "var(--muted)" }}>
                {speaking ? "Speaking" : "Listening"}
              </span>
            </div>

            {/* Pitch - top right */}
            <AnimatePresence>
              {pitchHz > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="absolute top-3.5 right-5 text-right">
                  <div className="text-xl font-bold tabular leading-none" style={{ color: "var(--amber)" }}>
                    {pitchHz.toFixed(0)}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Hz</div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
              <Mic size={28} color="var(--muted-2)" />
            </motion.div>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {active ? "Starting mic..." : "Mic inactive"}
            </span>
          </div>
        )}
      </div>

      {/* ── Metrics grid ── */}
      {voice && active ? (
        <div className="grid grid-cols-2 gap-px" style={{ background: "var(--border)" }}>
          {[
            {
              label: "Energy",
              value: `${energyPct}%`,
              sub:   energyPct < 10 ? "Low" : energyPct < 40 ? "Moderate" : "High",
              color: energyPct < 10 ? "var(--muted)" : energyPct < 40 ? "#f59e0b" : "#22c55e",
            },
            {
              label: "Speaking",
              value: `${cadencePct}%`,
              sub:   cadencePct < 20 ? "Quiet" : cadencePct < 50 ? "Some" : "Active",
              color: cadencePct < 20 ? "var(--muted)" : "#22c55e",
            },
            {
              label: "Pitch",
              value: pitchHz > 0 ? `${pitchHz.toFixed(0)}` : "--",
              sub:   pitchHz > 0 ? "Hz" : "Not detected",
              color: pitchHz > 0 ? "#60a5fa" : "var(--muted)",
            },
            {
              label: "Jitter",
              value: `${jitterPct}%`,
              sub:   jitterPct < 10 ? "Stable" : jitterPct < 25 ? "Mild" : "Stressed",
              color: jitterColor(jitterPct),
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="flex flex-col gap-0.5 px-5 py-4"
              style={{ background: "var(--surface)" }}>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
              <span className="text-xl font-bold tabular leading-tight" style={{ color }}>{value}</span>
              <span className="text-xs" style={{ color: "var(--muted-2)" }}>{sub}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-5">
          <p className="text-xs text-center" style={{ color: "var(--muted)" }}>No audio recorded</p>
        </div>
      )}
    </div>
  );
}
