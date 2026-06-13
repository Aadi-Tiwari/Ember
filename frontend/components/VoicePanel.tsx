"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { useVoiceAnalyzer } from "../hooks/useVoiceAnalyzer";

type Props = { active: boolean };

const BAR_DELAYS = [0, 0.1, 0.05, 0.15, 0.08];
const BAR_BASES = [0.5, 0.8, 1.0, 0.7, 0.45];

function MetricRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-20 shrink-0" style={{ color: "var(--muted)" }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: "0%" }}
          animate={{ width: `${Math.round(value * 100)}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
      <span className="text-xs tabular-nums w-8 text-right" style={{ color: "var(--muted)" }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export default function VoicePanel({ active }: Props) {
  const voice = useVoiceAnalyzer(active);

  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Waveform area */}
      <div
        className="relative flex items-center justify-center gap-1.5 px-4"
        style={{ height: 100, background: "var(--surface-2)" }}
      >
        {active && voice ? (
          <>
            {BAR_BASES.map((base, i) => {
              const height = base * (0.25 + voice.energy * 2.5);
              const isSpeaking = voice.is_speaking;
              return (
                <motion.div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: 6,
                    background: isSpeaking ? "var(--amber)" : "var(--border)",
                  }}
                  animate={{ height: Math.max(8, Math.min(72, height * 72)) }}
                  transition={{ duration: 0.15, delay: BAR_DELAYS[i], ease: "easeOut" }}
                />
              );
            })}
            <span
              className="absolute bottom-2 left-3 text-xs"
              style={{ color: voice.is_speaking ? "var(--amber)" : "var(--muted)" }}
            >
              {voice.is_speaking ? "Speaking..." : "Listening..."}
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Mic size={20} color="var(--muted)" />
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {active ? "Starting mic..." : "Mic inactive"}
            </span>
          </div>
        )}
      </div>

      {/* Metrics */}
      <AnimatePresence>
        {voice && active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 flex flex-col gap-2"
          >
            <MetricRow label="Energy" value={voice.energy * 2} color="#f59e0b" />
            <MetricRow label="Speaking" value={voice.cadence} color="#22c55e" />
            <MetricRow label="Affect" value={voice.pitch_variation} color="#a855f7" />
          </motion.div>
        )}
      </AnimatePresence>

      {!active && (
        <div className="p-3">
          <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
            No audio is recorded or uploaded
          </p>
        </div>
      )}
    </div>
  );
}
