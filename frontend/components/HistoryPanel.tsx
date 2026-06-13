"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, Trash2 } from "lucide-react";
import { loadHistory, clearHistory, type HistoryEntry } from "../lib/history";

export default function HistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setEntries(loadHistory());
  }, []);

  if (entries.length === 0) return null;

  function getColor(score: number) {
    if (score < 30) return "#22c55e";
    if (score < 60) return "#f59e0b";
    if (score < 80) return "#f97316";
    return "#ef4444";
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={14} color="var(--muted)" />
          <span className="text-sm font-medium">Recent scans</span>
        </div>
        <button
          onClick={() => { clearHistory(); setEntries([]); }}
          className="p-1 rounded hover:bg-white/5 transition-colors"
        >
          <Trash2 size={13} color="var(--muted)" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <div>
              <span className="text-xs font-medium capitalize">{e.scenario}</span>
              <span className="text-xs ml-2" style={{ color: "var(--muted)" }}>
                {new Date(e.timestamp).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {e.daysToThreshold && (
                <span className="text-xs" style={{ color: "var(--muted)" }}>~{e.daysToThreshold}d</span>
              )}
              <span className="text-sm font-bold tabular-nums" style={{ color: getColor(e.riskScore) }}>
                {Math.round(e.riskScore)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
