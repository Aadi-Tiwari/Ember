"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { BASE } from "../lib/api";

export type SensorReading = { label: string; score: number; finding: string; confidence: number; zscore?: number };
export type AttentionWeight = { label: string; pct: number; zscore: number };

type Vitals = { mouse_velocity: number; key_rate: number; idle_ratio: number };
type Sources = { activity: boolean; emotion: boolean; voice: boolean; chat: boolean };

export type LiveState = {
  connected: boolean;
  waiting: boolean;
  error: string | null;
  readings: SensorReading[];
  riskScore: number | null;
  vitals: Vitals | null;
  sources: Sources;
  attentionWeights: AttentionWeight[];
};

const WS_URL = process.env.NEXT_PUBLIC_API_WS_LIVE ?? `${BASE.replace(/^http/, "ws")}/ws/live`;

const EMPTY: LiveState = {
  connected: false,
  waiting: false,
  error: null,
  readings: [],
  riskScore: null,
  vitals: null,
  sources: { activity: false, emotion: false, voice: false, chat: false },
  attentionWeights: [],
};

export function useLiveStream() {
  const [state, setState] = useState<LiveState>(EMPTY);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    wsRef.current?.close();
    setState(EMPTY);
    let ws: WebSocket;
    try { ws = new WebSocket(WS_URL); }
    catch {
      setState({ ...EMPTY, error: "The live connection could not start. Run the local backend and frontend together, or configure a compatible secure backend." });
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => { if (wsRef.current === ws) setState(prev => ({ ...prev, connected: true, waiting: true, error: null })); };

    ws.onmessage = (evt) => {
      if (wsRef.current !== ws) return;
      let msg;
      try { msg = JSON.parse(evt.data); }
      catch { setState(prev => ({ ...prev, error: "The backend sent an unreadable update." })); return; }
      if (msg.type === "waiting") {
        setState({ ...EMPTY, connected: true, waiting: true });
      } else if (msg.type === "update") {
        setState({
          connected: true,
          waiting: false,
          error: null,
          readings: msg.readings ?? [],
          riskScore: msg.risk_score ?? null,
          vitals: msg.vitals ?? null,
          sources: msg.sources ?? EMPTY.sources,
          attentionWeights: msg.attention_weights ?? [],
        });
      }
    };

    ws.onerror = () => { if (wsRef.current === ws) setState(prev => ({ ...prev, error: "Cannot reach the live backend. Start it using the README instructions." })); };
    ws.onclose = () => { if (wsRef.current === ws) setState(prev => ({ ...EMPTY, error: prev.error || "The live backend disconnected. End this session and reconnect." })); };
  }, []);

  useEffect(() => () => { wsRef.current?.close(); wsRef.current = null; }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setState(EMPTY);
  }, []);

  return { state, connect, disconnect };
}
