"use client";
import { motion } from "framer-motion";
import { Activity, Clock, MessageSquare, Timer, Users, Volume2, Heart } from "lucide-react";

type Props = {
  label: string;
  score: number;
  finding: string;
  confidence: number;
  index: number;
};

const ICONS: Record<string, React.ElementType> = {
  Timing: Clock,
  Frequency: Activity,
  Latency: Timer,
  "Social Graph": Users,
  Volume: Volume2,
  Sentiment: Heart,
};

function getColor(score: number) {
  if (score < 30) return { bar: "#22c55e", glow: "#22c55e33" };
  if (score < 60) return { bar: "#f59e0b", glow: "#f59e0b33" };
  if (score < 80) return { bar: "#f97316", glow: "#f9731633" };
  return { bar: "#ef4444", glow: "#ef444433" };
}

export default function SensorCard({ label, score, finding, confidence, index }: Props) {
  const Icon = ICONS[label] ?? MessageSquare;
  const { bar, glow } = getColor(score);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: glow }}
          >
            <Icon size={16} color={bar} />
          </div>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-xl font-bold tabular-nums" style={{ color: bar }}>
          {Math.round(score)}
        </span>
      </div>

      {/* Score bar */}
      <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: bar }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ delay: index * 0.08 + 0.15, duration: 0.6, ease: "easeOut" }}
        />
      </div>

      <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
        {finding}
      </p>

      <div className="flex items-center gap-1.5">
        <div className="h-px flex-1" style={{ background: "var(--border)" }} />
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {Math.round(confidence * 100)}% confidence
        </span>
      </div>
    </motion.div>
  );
}
