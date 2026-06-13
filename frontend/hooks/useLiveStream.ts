"use client";
import { useState, useCallback, useRef } from "react";
import type { SensorReading } from "./useAnalysis";

type Vitals = {
  mouse_velocity: number;
  key_rate: number;
  idle_ratio: number;
};

type Sources = {
  activity: boolean;
  discord: boolean;
};

export type LiveState = {
  connected: boolean;
  waiting: boolean;
  readings: SensorReading[];
  riskScore: number | null;
  vitals: Vitals | null;
  sources: Sources;
};

const WS_URL = process.env.NEXT_PUBLIC_API_WS_LIVE ?? "ws://localhost:8000/ws/live";

export function useLiveStream() {
  const [state, setState] = useState<LiveState>({
    connected: false,
    waiting: false,
    readings: [],
    riskScore: null,
    vitals: null,
    sources: { activity: false, discord: false },
  });

  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((prev) => ({ ...prev, connected: true, waiting: true }));
    };

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === "waiting") {
        setState((prev) => ({ ...prev, waiting: true }));
      } else if (msg.type === "update") {
        setState({
          connected: true,
          waiting: false,
          readings: msg.readings,
          riskScore: msg.risk_score,
          vitals: msg.vitals,
          sources: msg.sources,
        });
      }
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, connected: false }));
    };
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setState({
      connected: false,
      waiting: false,
      readings: [],
      riskScore: null,
      vitals: null,
      sources: { activity: false, discord: false },
    });
  }, []);

  return { state, connect, disconnect };
}
