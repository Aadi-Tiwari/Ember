"use client";
import { motion } from "framer-motion";
import { Mouse, Heart, Mic } from "lucide-react";

type Props = {
  label: string;
  score: number;
  finding: string;
  confidence: number;
  index: number;
  zscore?: number;
};

const ICONS: Record<string, React.ElementType> = {
  Activity: Mouse,
  Emotion:  Heart,
  Voice:    Mic,
};

function scoreColor(s: number) {
  if (s < 30) return "var(--green)";
  if (s < 60) return "var(--amber)";
  if (s < 80) return "var(--orange)";
  return "var(--red)";
}

export default function SensorCard({ label, score, finding, confidence, index, zscore }: Props) {
  const Icon  = ICONS[label] ?? Mouse;
  const color = scoreColor(score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Top row: icon + label | score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={14} color="var(--muted)" />
          <span className="text-xs font-medium tracking-wide uppercase" style={{ color: "var(--muted)" }}>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {zscore !== undefined && zscore !== 0 && (
            <span className="text-xs tabular font-mono" style={{ color: "var(--muted-2)" }}>
              {zscore > 0 ? "+" : ""}{zscore.toFixed(1)}σ
            </span>
          )}
          <span className="text-2xl font-bold tabular" style={{ color }}>{Math.round(score)}</span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-px rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <motion.div className="h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ delay: index * 0.06 + 0.1, duration: 0.5, ease: "easeOut" }} />
      </div>

      {/* Finding */}
      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--muted)" }}>{finding}</p>

      {/* Confidence */}
      <span className="text-xs" style={{ color: "var(--muted-2)" }}>
        {Math.round(confidence * 100)}% confidence
      </span>
    </motion.div>
  );
}
