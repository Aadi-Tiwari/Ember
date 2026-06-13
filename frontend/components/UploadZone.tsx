"use client";
import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Upload } from "lucide-react";

type Props = {
  onFile: (file: File) => void;
  disabled?: boolean;
};

export default function UploadZone({ onFile, disabled }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile, disabled]
  );

  return (
    <motion.label
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 cursor-pointer transition-colors"
      style={{
        border: `2px dashed ${dragging ? "var(--amber)" : "var(--border)"}`,
        background: dragging ? "rgba(245,158,11,0.05)" : "var(--surface)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <input
        type="file"
        accept=".json"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: "rgba(245,158,11,0.12)" }}
      >
        <Upload size={22} color="var(--amber)" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">Drop your Discord or Slack export</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Content is stripped immediately. Only timing metadata is read.
        </p>
      </div>
      <span
        className="text-xs px-3 py-1 rounded-full"
        style={{ background: "var(--surface-2)", color: "var(--muted)", border: "1px solid var(--border)" }}
      >
        .json files only
      </span>
    </motion.label>
  );
}
