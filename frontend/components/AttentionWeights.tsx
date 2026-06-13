"use client";
import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp } from "lucide-react";

type Weight = {
  label: string;
  pct: number;
  zscore: number;
};

type Props = {
  weights: Weight[];
  divergenceDaysAgo: number | null;
};

function getZColor(z: number): string {
  if (z >= 2.5) return "#ef4444";
  if (z >= 1.5) return "#f97316";
  if (z >= 0.8) return "#f59e0b";
  return "#22c55e";
}

export default function AttentionWeights({ weights, divergenceDaysAgo }: Props) {
  if (!weights || weights.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold">Why this score?</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            Sensor contribution - comparing you to yourself, not population averages
          </p>
        </div>
        {divergenceDaysAgo !== null && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <AlertTriangle size={12} color="#ef4444" />
            <span className="text-xs font-medium text-red-400">
              Diverged ~{divergenceDaysAgo}d ago
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {weights.map((w, i) => {
          const color = getZColor(w.zscore);
          return (
            <motion.div
              key={w.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className="flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{w.label}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-mono"
                    style={{ background: color + "18", color }}
                  >
                    {w.zscore > 0 ? "+" : ""}{w.zscore.toFixed(1)}σ
                  </span>
                </div>
                <span className="text-xs font-semibold tabular-nums" style={{ color }}>
                  {w.pct.toFixed(0)}%
                </span>
              </div>

              {/* Contribution bar */}
              <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${w.pct}%` }}
                  transition={{ delay: i * 0.07 + 0.1, duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {divergenceDaysAgo !== null && (
        <div
          className="flex items-start gap-2.5 rounded-xl p-3 mt-1"
          style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}
        >
          <TrendingUp size={14} color="#ef4444" className="shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            Behavioral patterns started diverging from your personal baseline approximately{" "}
            <span className="text-red-400 font-medium">{divergenceDaysAgo} days ago</span>.
            The leading sensor was{" "}
            <span className="font-medium" style={{ color: "var(--text)" }}>{weights[0]?.label}</span>.
          </p>
        </div>
      )}
    </motion.div>
  );
}
