"use client";
import { motion } from "framer-motion";
import SensorCard from "./SensorCard";

export type SensorReading = {
  label: string;
  score: number;
  finding: string;
  confidence: number;
  zscore?: number;
};

type Props = {
  readings: SensorReading[];
  isRunning: boolean;
};

const SENSOR_LABELS = ["Activity", "Emotion", "Voice"];

function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.3, 0.7, 0.3] }}
      transition={{ duration: 1.4, repeat: Infinity, delay: index * 0.12 }}
      className="rounded-xl p-4 h-32"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg" style={{ background: "var(--border)" }} />
        <div className="h-3 w-20 rounded" style={{ background: "var(--border)" }} />
      </div>
      <div className="h-1.5 rounded-full mb-3" style={{ background: "var(--border)" }} />
      <div className="h-2.5 w-full rounded mb-1" style={{ background: "var(--border)" }} />
      <div className="h-2.5 w-3/4 rounded" style={{ background: "var(--border)" }} />
    </motion.div>
  );
}

export default function SensorGrid({ readings, isRunning }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {isRunning
        ? SENSOR_LABELS.map((label, i) => {
            const reading = readings.find((r) => r.label === label);
            return reading ? (
              <SensorCard key={label} {...reading} index={i} />
            ) : (
              <SkeletonCard key={label} index={i} />
            );
          })
        : readings.map((r, i) => <SensorCard key={r.label} {...r} index={i} />)}
    </div>
  );
}
