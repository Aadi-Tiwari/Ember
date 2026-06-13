"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, Trash2 } from "lucide-react";
import { loadHistory, clearHistory, type HistoryEntry } from "../lib/history";
import { getToken, apiFetch } from "../lib/api";

type DbScan = {
  id: number;
  timestamp: string;
  risk_score: number;
  days_to_threshold: number | null;
  source: string;
};

export default function HistoryPanel() {
  const [dbScans, setDbScans] = useState<DbScan[]>([]);
  const [localEntries, setLocalEntries] = useState<HistoryEntry[]>([]);
  const [useDb, setUseDb] = useState(false);

  useEffect(() => {
    if (getToken()) {
      apiFetch("/scans")
        .then((d) => {
          if (d.scans?.length > 0) {
            setDbScans(d.scans);
            setUseDb(true);
          } else {
            setLocalEntries(loadHistory());
          }
        })
        .catch(() => setLocalEntries(loadHistory()));
    } else {
      setLocalEntries(loadHistory());
    }
  }, []);

  function getColor(score: number) {
    if (score < 30) return "#22c55e";
    if (score < 60) return "#f59e0b";
    if (score < 80) return "#f97316";
    return "#ef4444";
  }

  if (!useDb && localEntries.length === 0) return null;
  if (useDb && dbScans.length === 0) return null;

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
          <span className="text-sm font-medium">
            {useDb ? "Your scan history" : "Recent scans"}
          </span>
          {useDb && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
              saved
            </span>
          )}
        </div>
        {!useDb && (
          <button
            onClick={() => { clearHistory(); setLocalEntries([]); }}
            className="p-1 rounded hover:bg-white/5"
          >
            <Trash2 size={13} color="var(--muted)" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {useDb
          ? dbScans.slice(0, 8).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <div>
                  <span className="text-xs font-medium capitalize">{s.source}</span>
                  <span className="text-xs ml-2" style={{ color: "var(--muted)" }}>
                    {new Date(s.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {s.days_to_threshold && (
                    <span className="text-xs" style={{ color: "var(--muted)" }}>~{s.days_to_threshold}d</span>
                  )}
                  <span className="text-sm font-bold tabular-nums" style={{ color: getColor(s.risk_score) }}>
                    {Math.round(s.risk_score)}
                  </span>
                </div>
              </div>
            ))
          : localEntries.map((e) => (
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
