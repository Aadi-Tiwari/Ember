"use client";
import { motion } from "framer-motion";
import { Mouse, Keyboard, Clock } from "lucide-react";

type Vitals = {
  mouse_velocity: number;
  key_rate: number;
  idle_ratio: number;
};

type Props = { vitals: Vitals };

function VitalChip({
  icon: Icon,
  label,
  value,
  unit,
  warn,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit: string;
  warn: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1"
      style={{
        background: warn ? "rgba(239,68,68,0.08)" : "var(--surface-2)",
        border: `1px solid ${warn ? "rgba(239,68,68,0.25)" : "var(--border)"}`,
      }}
    >
      <Icon size={13} color={warn ? "#ef4444" : "var(--muted)"} />
      <div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
        <div className="text-sm font-bold tabular-nums" style={{ color: warn ? "#ef4444" : "var(--text)" }}>
          {value} <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>{unit}</span>
        </div>
      </div>
    </div>
  );
}

export default function VitalsRow({ vitals }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2"
    >
      <VitalChip
        icon={Mouse}
        label="Mouse speed"
        value={vitals.mouse_velocity.toFixed(0)}
        unit="px/s"
        warn={vitals.mouse_velocity < 120}
      />
      <VitalChip
        icon={Keyboard}
        label="Typing rate"
        value={vitals.key_rate.toFixed(0)}
        unit="kpm"
        warn={vitals.key_rate < 60}
      />
      <VitalChip
        icon={Clock}
        label="Idle"
        value={(vitals.idle_ratio * 100).toFixed(0)}
        unit="%"
        warn={vitals.idle_ratio > 0.55}
      />
    </motion.div>
  );
}
