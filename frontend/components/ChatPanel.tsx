"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Entry = {
  id: string;
  text: string;
  ts: Date;
};

type Props = { active: boolean };

export default function ChatPanel({ active }: Props) {
  const [text, setText]       = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || sending || !active) return;
    setSending(true);

    const entry: Entry = { id: crypto.randomUUID(), text: trimmed, ts: new Date() };
    setEntries(prev => [...prev, entry]);
    setText("");

    try {
      await fetch(`${API_URL}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "chat",
          timestamp: entry.ts.toISOString(),
          text: trimmed,
        }),
      });
    } catch {
      // Backend offline - entry still logged locally
    }

    setSending(false);
    textareaRef.current?.focus();
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  const placeholder = entries.length === 0
    ? "How are you feeling right now? Be honest - this goes directly into your evaluation."
    : "Add another note...";

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", height: 420 }}>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {entries.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-8">
            <p className="text-sm font-medium">Check in with yourself</p>
            <p className="text-xs max-w-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              Write how you're feeling. Your words are analyzed for emotional tone and added to your overall evaluation.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {entries.map((e, i) => (
            <motion.div key={e.id}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-end gap-1">
              <div className="max-w-xs px-3.5 py-2.5 rounded-2xl rounded-br-sm text-sm"
                style={{ background: "var(--amber)", color: "#000" }}>
                {e.text}
              </div>
              <span className="text-xs" style={{ color: "var(--muted-2)" }}>
                {e.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {" - logged"}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 flex gap-2 items-end"
        style={{ borderTop: "1px solid var(--border)" }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          rows={2}
          disabled={!active}
          className="flex-1 resize-none text-sm leading-relaxed outline-none"
          style={{
            background: "transparent",
            color: "var(--text)",
            caretColor: "var(--amber)",
            border: "none",
          }}
        />
        <button onClick={submit} disabled={!text.trim() || sending || !active}
          className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer"
          style={{
            background: text.trim() && active ? "var(--amber)" : "var(--surface-2)",
            border: "1px solid var(--border)",
            transition: "background 0.15s",
          }}>
          <Send size={13} color={text.trim() && active ? "#000" : "var(--muted)"} />
        </button>
      </div>
    </div>
  );
}
