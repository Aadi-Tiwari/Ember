"use client";
import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import { useVoiceAnalyzer } from "../hooks/useVoiceAnalyzer";

type Props = { active: boolean };

const N_BARS = 24;

export default function VoicePanel({ active }: Props) {
  const voice = useVoiceAnalyzer(active);

  const pitchDisplay = voice?.pitch_hz && voice.pitch_hz > 0
    ? `${voice.pitch_hz.toFixed(0)} Hz`
    : "--";

  const jitterPct = voice ? Math.round(voice.jitter * 100) : 0;

  return (
    <div className="rounded-2xl flex flex-col overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

      {/* Waveform */}
      <div className="relative flex items-end justify-center gap-px px-4"
        style={{ height: 96, background: "var(--surface-2)" }}>

        {active && voice ? (
          <>
            {Array.from({ length: N_BARS }).map((_, i) => {
              const phase  = Math.sin((i / N_BARS) * Math.PI);
              const h      = 3 + phase * voice.energy * 76;
              return (
                <motion.div key={i} className="rounded-sm flex-1"
                  style={{ background: voice.is_speaking ? "var(--amber)" : "var(--border)", maxWidth: 3 }}
                  animate={{ height: Math.max(3, Math.min(76, h)) }}
                  transition={{ duration: 0.12, ease: "easeOut" }} />
              );
            })}
            <span className="absolute bottom-2 left-4 text-xs"
              style={{ color: voice.is_speaking ? "var(--amber)" : "var(--muted)" }}>
              {voice.is_speaking ? "Speaking" : "Listening"}
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Mic size={16} color="var(--muted-2)" />
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {active ? "Starting mic..." : "Mic inactive"}
            </span>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="px-5 py-4 flex flex-col gap-2.5">
        {voice && active ? (
          <>
            {[
              { label: "Energy",   value: `${Math.min(100, Math.round(voice.energy * 200))}%` },
              { label: "Speaking", value: `${Math.round(voice.cadence * 100)}%` },
              { label: "Pitch",    value: pitchDisplay },
              { label: "Jitter",   value: `${jitterPct}%`, warn: jitterPct > 15 },
            ].map(({ label, value, warn }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
                <span className="text-xs tabular font-semibold"
                  style={{ color: warn ? "var(--amber)" : "var(--text)" }}>
                  {value}
                </span>
              </div>
            ))}
          </>
        ) : (
          <p className="text-xs text-center" style={{ color: "var(--muted)" }}>No audio recorded</p>
        )}
      </div>
    </div>
  );
}
