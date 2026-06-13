"use client";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type Props = {
  riskScore: number;
  daysToThreshold: number | null;
};

function buildProjection(riskScore: number, daysToThreshold: number | null) {
  const today = 0;
  const points = [{ day: "Now", score: Math.round(riskScore) }];

  if (daysToThreshold !== null && daysToThreshold > 0 && daysToThreshold < 90) {
    const step = Math.ceil(daysToThreshold / 4);
    for (let d = step; d <= daysToThreshold; d += step) {
      const progress = d / daysToThreshold;
      points.push({
        day: `+${d}d`,
        score: Math.round(riskScore + (100 - riskScore) * progress * 0.6),
      });
    }
    points.push({ day: `+${daysToThreshold}d`, score: 80 });
  }

  return points;
}

export default function TrendChart({ riskScore, daysToThreshold }: Props) {
  const data = buildProjection(riskScore, daysToThreshold);
  const color = riskScore >= 60 ? "#ef4444" : riskScore >= 30 ? "#f59e0b" : "#22c55e";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold">Trajectory</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {daysToThreshold !== null
              ? `Projected to reach critical threshold in ~${daysToThreshold} days`
              : "No threshold crossing predicted in the next 90 days"}
          </p>
        </div>
        {daysToThreshold !== null && daysToThreshold > 0 && (
          <div
            className="text-center rounded-lg px-3 py-1.5"
            style={{ background: "#ef444422", border: "1px solid #ef444444" }}
          >
            <div className="text-lg font-bold text-red-400">{daysToThreshold}</div>
            <div className="text-xs text-red-400">days</div>
          </div>
        )}
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#666" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#666" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              itemStyle={{ color: color }}
              labelStyle={{ color: "#999" }}
            />
            <Area type="monotone" dataKey="score" stroke={color} strokeWidth={2} fill="url(#scoreGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
