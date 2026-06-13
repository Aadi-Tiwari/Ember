"use client";
import { motion } from "framer-motion";

type Weight = { label: string; pct: number; zscore: number };
type Props  = { weights: Weight[]; divergenceDaysAgo: number | null };

function zColor(z: number) {
  if (z >= 2.5) return "var(--red)";
  if (z >= 1.5) return "var(--orange)";
  if (z >= 0.8) return "var(--amber)";
  return "var(--green)";
}

export default function AttentionWeights({ weights, divergenceDaysAgo }: Props) {
  if (!weights?.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium tracking-wider uppercase" style={{ color: "var(--muted)" }}>
          Why this score?
        </p>
        {divergenceDaysAgo !== null && (
          <span className="text-xs" style={{ color: "var(--red)" }}>Diverged ~{divergenceDaysAgo}d ago</span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {weights.map((w, i) => {
          const color = zColor(w.zscore);
          return (
            <motion.div key={w.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: i * 0.06 }} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{w.label}</span>
                  <span className="text-xs tabular font-mono" style={{ color: "var(--muted)" }}>
                    {w.zscore > 0 ? "+" : ""}{w.zscore.toFixed(1)}σ
                  </span>
                </div>
                <span className="text-xs tabular font-semibold" style={{ color }}>{w.pct.toFixed(0)}%</span>
              </div>
              <div className="h-px rounded-full" style={{ background: "var(--border)" }}>
                <motion.div className="h-full rounded-full" style={{ background: color }}
                  initial={{ width: 0 }} animate={{ width: `${w.pct}%` }}
                  transition={{ delay: i * 0.06 + 0.1, duration: 0.45, ease: "easeOut" }} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
