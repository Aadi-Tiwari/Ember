"use client";
import { motion } from "framer-motion";

type Props = {
  connected: boolean;
  waiting?: boolean;
};

export default function LiveBadge({ connected, waiting }: Props) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{
        background: connected ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
        border: `1px solid ${connected ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
        color: connected ? "#22c55e" : "var(--amber)",
      }}
    >
      <motion.div
        className="w-2 h-2 rounded-full"
        style={{ background: connected ? "#22c55e" : "var(--amber)" }}
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      />
      {waiting ? "Waiting..." : connected ? "LIVE" : "Connecting..."}
    </div>
  );
}
