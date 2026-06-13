"use client";
import { useState, useCallback, useRef } from "react";

export type SensorReading = {
  label: string;
  score: number;
  finding: string;
  confidence: number;
};

export type AnalysisState = {
  status: "idle" | "running" | "done" | "error";
  readings: SensorReading[];
  riskScore: number | null;
  daysToThreshold: number | null;
  error: string | null;
};

const WS_URL = process.env.NEXT_PUBLIC_API_WS ?? "ws://localhost:8000/ws/analyze";
const REST_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    status: "idle",
    readings: [],
    riskScore: null,
    daysToThreshold: null,
    error: null,
  });
  const wsRef = useRef<WebSocket | null>(null);

  const reset = useCallback(() => {
    wsRef.current?.close();
    setState({ status: "idle", readings: [], riskScore: null, daysToThreshold: null, error: null });
  }, []);

  const runWithMetadata = useCallback((metadata: object, sentimentText = "") => {
    setState({ status: "running", readings: [], riskScore: null, daysToThreshold: null, error: null });

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ metadata, sentiment_text: sentimentText }));
    };

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === "sensor") {
        setState((prev) => ({
          ...prev,
          readings: [...prev.readings, { label: msg.label, score: msg.score, finding: msg.finding, confidence: msg.confidence }],
        }));
      } else if (msg.type === "final") {
        setState((prev) => ({
          ...prev,
          status: "done",
          riskScore: msg.risk_score,
          daysToThreshold: msg.days_to_threshold,
        }));
      }
    };

    ws.onerror = () => {
      setState((prev) => ({ ...prev, status: "error", error: "Connection failed. Is the backend running?" }));
    };
  }, []);

  const runDemo = useCallback(async (scenario: "healthy" | "crisis") => {
    setState({ status: "running", readings: [], riskScore: null, daysToThreshold: null, error: null });
    try {
      const res = await fetch(`${REST_URL}/demo/${scenario}`);
      const data = await res.json();
      runWithMetadata(data.metadata);
    } catch {
      setState((prev) => ({ ...prev, status: "error", error: "Could not load demo data." }));
    }
  }, [runWithMetadata]);

  const runFile = useCallback(async (file: File, sentimentText = "") => {
    setState({ status: "running", readings: [], riskScore: null, daysToThreshold: null, error: null });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${REST_URL}/parse`, { method: "POST", body: form });
      const data = await res.json();
      runWithMetadata(data.metadata, sentimentText);
    } catch {
      setState((prev) => ({ ...prev, status: "error", error: "Failed to parse file." }));
    }
  }, [runWithMetadata]);

  return { state, runDemo, runFile, reset };
}
