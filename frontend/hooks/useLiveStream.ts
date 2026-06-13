"use client";
import { useState, useCallback, useRef } from "react";

export type SensorReading = { label: string; score: number; finding: string; confidence: number; zscore?: number };
export type AttentionWeight = { label: string; pct: number; zscore: number };

type Vitals = { mouse_velocity: number; key_rate: number; idle_ratio: number };
type Sources = { activity: boolean; emotion: boolean; voice: boolean };

export type LiveState = {
  connected: boolean;
  waiting: boolean;
  readings: SensorReading[];
  riskScore: number | null;
  vitals: Vitals | null;
  sources: Sources;
  attentionWeights: AttentionWeight[];
};

const WS_URL = process.env.NEXT_PUBLIC_API_WS_LIVE ?? "ws://localhost:8000/ws/live";

const EMPTY: LiveState = {
  connected: false,
  waiting: false,
  readings: [],
  riskScore: null,
  vitals: null,
  sources: { activity: false, emotion: false, voice: false },
  attentionWeights: [],
};

export function useLiveStream() {
  const [state, setState] = useState<LiveState>(EMPTY);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    wsRef.current?.close();
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setState(prev => ({ ...prev, connected: true, waiting: true }));

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === "waiting") {
        setState(prev => ({ ...prev, waiting: true }));
      } else if (msg.type === "update") {
        setState({
          connected: true,
          waiting: false,
          readings: msg.readings ?? [],
          riskScore: msg.risk_score ?? null,
          vitals: msg.vitals ?? null,
          sources: msg.sources ?? { activity: false, emotion: false, voice: false },
          attentionWeights: msg.attention_weights ?? [],
        });
      }
    };

    ws.onclose = () => setState(prev => ({ ...prev, connected: false }));
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setState(EMPTY);
  }, []);

  return { state, connect, disconnect };
}
