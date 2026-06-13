"use client";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

type Resource = { name: string; desc: string; url: string; tag: string };

const RESOURCES: Resource[] = [
  { name: "Crisis Text Line", desc: "Text HOME to 741741 for 24/7 crisis support", url: "https://www.crisistextline.org", tag: "Crisis" },
  { name: "988 Lifeline", desc: "Call or text 988 for suicide and crisis lifeline", url: "https://988lifeline.org", tag: "Crisis" },
  { name: "Headspace", desc: "Guided meditation and stress reduction", url: "https://www.headspace.com", tag: "Wellness" },
  { name: "Student Health", desc: "Connect with your institution's counseling center", url: "https://www.nimh.nih.gov/health/find-help", tag: "Counseling" },
];

export default function ResourceCard({ riskScore }: { riskScore: number }) {
  const highlighted = riskScore >= 70;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{
        background: highlighted ? "rgba(239,68,68,0.06)" : "var(--surface)",
        border: `1px solid ${highlighted ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
      }}
    >
      <h3 className="text-sm font-semibold">
        {highlighted ? "Support Resources" : "Wellness Resources"}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {RESOURCES.filter((r) => highlighted || r.tag === "Wellness").map((r) => (
          <a
            key={r.name}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group"
            style={{ border: "1px solid var(--border)" }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium truncate">{r.name}</span>
                <ExternalLink size={10} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
              </div>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--muted)" }}>
                {r.desc}
              </p>
            </div>
            <span
              className="text-xs px-1.5 py-0.5 rounded shrink-0"
              style={{ background: "var(--surface-2)", color: "var(--muted)", border: "1px solid var(--border)" }}
            >
              {r.tag}
            </span>
          </a>
        ))}
      </div>
    </motion.div>
  );
}
