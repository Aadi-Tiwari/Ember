"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Role    = "user" | "assistant";
type Message = { id: string; role: Role; content: string; ts: Date };
type Props   = { active: boolean };

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
          style={{ background: "var(--muted)" }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }} />
      ))}
    </div>
  );
}

function EmberAvatar() {
  return (
    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
      style={{ background: "var(--amber)", color: "#000", fontSize: 10, fontWeight: 700 }}>
      E
    </div>
  );
}

function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
  e.target.style.height = "auto";
  e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
}

export default function ChatPanel({ active }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [started, setStarted]   = useState(false);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const callAI = useCallback(async (history: Message[], lastUserText = "") => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages:          history.map(m => ({ role: m.role, content: m.content })),
          last_user_message: lastUserText,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "assistant",
        content: data.reply ?? "I'm here with you.",
        ts: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "assistant",
        content: "Connection issue - make sure the backend is running.",
        ts: new Date(),
      }]);
    }
    setLoading(false);
  }, []);

  // Auto-start: Ember greets first when tab opens
  useEffect(() => {
    if (active && !started) {
      setStarted(true);
      callAI([]);
    }
  }, [active, started, callAI]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading || !active) return;
    const userMsg: Message = {
      id: crypto.randomUUID(), role: "user", content: trimmed, ts: new Date(),
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await callAI(updated, trimmed);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        <AnimatePresence initial={false}>
          {messages.map(m => (
            <motion.div key={m.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>

              {m.role === "assistant" && <EmberAvatar />}

              <div className="flex flex-col gap-0.5 max-w-[78%]">
                <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.role === "user" ? "rounded-br-sm" : "rounded-bl-sm"
                }`}
                  style={{
                    background: m.role === "user" ? "var(--amber)"    : "var(--surface-2)",
                    color:      m.role === "user" ? "#000"            : "var(--text)",
                    border:     m.role === "assistant" ? "1px solid var(--border)" : "none",
                  }}>
                  {m.content}
                </div>
                <span className={`text-xs ${m.role === "user" ? "text-right" : ""}`}
                  style={{ color: "var(--muted-2)" }}>
                  {m.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-start gap-2.5">
            <EmberAvatar />
            <div className="rounded-2xl rounded-bl-sm"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <TypingDots />
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-3 flex items-end gap-2"
        style={{ borderTop: "1px solid var(--border)" }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => { setInput(e.target.value); autoResize(e); }}
          onKeyDown={onKey}
          placeholder={loading ? "Ember is typing..." : "Type your message..."}
          disabled={loading || !active}
          rows={1}
          className="flex-1 resize-none text-sm leading-relaxed outline-none"
          style={{
            background: "transparent", color: "var(--text)",
            caretColor: "var(--amber)", border: "none",
            maxHeight: 80, overflowY: "auto",
          }}
        />
        <button onClick={send}
          disabled={!input.trim() || loading || !active}
          className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
          style={{
            background:  input.trim() && !loading ? "var(--amber)" : "var(--surface-2)",
            border:      "1px solid var(--border)",
            transition:  "background 0.15s",
            cursor:      input.trim() && !loading ? "pointer" : "default",
          }}>
          <Send size={13} color={input.trim() && !loading ? "#000" : "var(--muted)"} />
        </button>
      </div>
    </div>
  );
}
