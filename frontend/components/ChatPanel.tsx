"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUp, MessageCircle, RotateCcw } from "lucide-react";
import { BASE } from "../lib/api";
import { EmberMark } from "./Workspace";

type Message = { id: string; role: "user" | "assistant"; content: string };

export default function ChatPanel({ active }: { active: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!active) {
      requestRef.current?.abort();
      setMessages([]);
      setStarted(false);
      setLoading(false);
      setInput("");
      setError("");
    }
    return () => requestRef.current?.abort();
  }, [active]);

  useEffect(() => {
    const container = messagesRef.current;
    container?.scrollTo({ top: container.scrollHeight, behavior: reducedMotion ? "instant" : "smooth" });
  }, [messages, loading, reducedMotion]);

  useEffect(() => {
    if (started && !loading && active) inputRef.current?.focus({ preventScroll: true });
  }, [started, loading, active]);

  async function reply(history: Message[]) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${BASE}/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error(payload.reply || "The conversation could not continue. Please retry.");
      if (!controller.signal.aborted) setMessages(previous => [...previous, {
        id: crypto.randomUUID(), role: "assistant", content: payload.reply,
      }]);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "The backend is unavailable. Please retry.");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  function start() {
    if (!active || loading) return;
    setStarted(true);
    void reply([]);
  }

  function send() {
    const content = input.trim();
    if (!content || !active || loading) return;
    const history = [...messages, { id: crypto.randomUUID(), role: "user" as const, content }];
    setMessages(history);
    setInput("");
    void reply(history);
  }

  return <div className="chat-panel">
    <div className="panel-heading"><div className="panel-label"><span className="icon-tile icon-blue"><MessageCircle size={18} /></span><div><h3>Talk it through</h3><p>A conversation with Ember</p></div></div><span className="chat-orb" aria-hidden="true" /></div>
    {!started ? <div className="chat-empty">
      <div className="chat-preview" aria-hidden="true"><span /><span /><span /></div>
      <h4>What's been on your mind?</h4><p>Workload, sleep, the things that feel different. Start wherever you are.</p>
      <button type="button" className="button button-secondary" disabled={!active} onClick={start}>Start conversation <ArrowRight size={14} /></button>
      {!active && <small>Start a collection session first.</small>}
    </div> : <>
      <div ref={messagesRef} className="chat-messages" role="log" aria-label="Conversation messages" aria-live="polite">
        {messages.map(message => <motion.div key={message.id} className={`chat-message message-${message.role}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
          {message.role === "assistant" && <EmberMark small />}<p>{message.content}</p>
        </motion.div>)}
        {loading && <div className="chat-typing" role="status"><EmberMark small /><span><i /><i /><i /></span><span className="sr-only">Ember is responding.</span></div>}
        {error && <div className="chat-error"><p role="alert">{error}</p><button type="button" onClick={() => void reply(messages)} disabled={loading || !active}><RotateCcw size={12} /> Retry</button></div>}
      </div>
      <form className="chat-composer" onSubmit={event => { event.preventDefault(); send(); }}>
        <textarea ref={inputRef} value={input} onChange={event => setInput(event.target.value)} rows={2} maxLength={6000} aria-label="Message Ember" placeholder="Write what's on your mind..." disabled={!active || loading}
          onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />
        <button type="submit" aria-label="Send message" disabled={!input.trim() || loading || !active}><ArrowUp size={17} /></button>
      </form>
    </>}
    <p className="chat-disclosure">Messages go to your configured AI provider.</p>
  </div>;
}
