"use client";
import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import { useVoiceAnalyzer } from "../hooks/useVoiceAnalyzer";

type Props = { active: boolean };

const N_BARS = 20;

export default function VoicePanel({ active }: Props) {
  const voice = useVoiceAnalyzer(active);

  return (
    <div className="rounded-2xl flex flex-col overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

      {/* Waveform */}
      <div className="relative flex items-end justify-center gap-0.5 px-5"
        style={{ height: 96, background: "var(--surface-2)" }}>
        {active && voice ? (
          Array.from({ length: N_BARS }).map((_, i) => {
            const phase  = Math.sin((i / N_BARS) * Math.PI);
            const height = 4 + phase * voice.energy * 72 * (0.6 + Math.random() * 0.4);
            return (
              <motion.div key={i} className="rounded-full flex-1"
                style={{ background: voice.is_speaking ? "var(--amber)" : "var(--border)", maxWidth: 4 }}
                animate={{ height: Math.max(4, Math.min(72, height)) }}
                transition={{ duration: 0.15, ease: "easeOut" }} />
            );
          })
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Mic size={18} color="var(--muted-2)" />
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {active ? "Starting mic..." : "Mic inactive"}
            </span>
          </div>
        )}

        {active && voice && (
          <span className="absolute bottom-2.5 left-4 text-xs"
            style={{ color: voice.is_speaking ? "var(--amber)" : "var(--muted)" }}>
            {voice.is_speaking ? "Speaking" : "Listening"}
          </span>
        )}
      </div>

      {/* Metrics */}
      {voice && active && (
        <div className="px-5 py-4 flex flex-col gap-3">
          {[
            { label: "Energy",   value: Math.round(Math.min(voice.energy * 200, 100)), unit: "%" },
            { label: "Speaking", value: Math.round(voice.cadence * 100),                unit: "%" },
            { label: "Affect",   value: Math.round(voice.pitch_variation * 100),        unit: "%" },
          ].map(({ label, value, unit }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
              <span className="text-xs tabular font-semibold" style={{ color: "var(--text)" }}>
                {value}{unit}
              </span>
            </div>
          ))}
        </div>
      )}

      {!active && (
        <div className="px-5 py-4">
          <p className="text-xs text-center" style={{ color: "var(--muted)" }}>No audio recorded</p>
        </div>
      )}
    </div>
  );
}
