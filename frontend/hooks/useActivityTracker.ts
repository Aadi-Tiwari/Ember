"use client";
import { useState, useEffect, useRef, useCallback } from "react";

export type VitalsData = {
  mouse_velocity_px_s: number;
  click_rate_per_min: number;
  key_rate_per_min: number;
  idle_ratio: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SEND_INTERVAL_MS = 6000;
const LOCAL_UPDATE_MS = 1500;

export function useActivityTracker(active: boolean): VitalsData | null {
  const [vitals, setVitals] = useState<VitalsData | null>(null);

  const mousePos = useRef<Array<{ t: number; x: number; y: number }>>([]);
  const clickTs = useRef<number[]>([]);
  const keyTs = useRef<number[]>([]);
  const lastActivity = useRef<number>(Date.now());

  const compute = useCallback((): VitalsData => {
    const now = Date.now();

    // Mouse velocity px/s over last 60 seconds
    const recent = mousePos.current.filter((p) => p.t > now - 60_000);
    let velocity = 0;
    if (recent.length >= 2) {
      let dist = 0;
      for (let i = 1; i < recent.length; i++) {
        dist += Math.hypot(recent[i].x - recent[i - 1].x, recent[i].y - recent[i - 1].y);
      }
      const span = (recent[recent.length - 1].t - recent[0].t) / 1000;
      velocity = span > 0 ? dist / span : 0;
    }

    const clickRate = clickTs.current.filter((t) => t > now - 300_000).length / 5;
    const keyRate = keyTs.current.filter((t) => t > now - 300_000).length / 5;
    const idleSecs = Math.min((now - lastActivity.current) / 1000, 300);

    return {
      mouse_velocity_px_s: Math.round(velocity),
      click_rate_per_min: Math.round(clickRate * 10) / 10,
      key_rate_per_min: Math.round(keyRate * 10) / 10,
      idle_ratio: Math.round((idleSecs / 300) * 1000) / 1000,
    };
  }, []);

  const sendToBackend = useCallback(async () => {
    const v = compute();
    try {
      await fetch(`${API_URL}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "vitals",
          timestamp: new Date().toISOString(),
          ...v,
        }),
      });
    } catch {
      // Backend offline - local tracking still works
    }
  }, [compute]);

  useEffect(() => {
    if (!active) {
      setVitals(null);
      mousePos.current = [];
      clickTs.current = [];
      keyTs.current = [];
      return;
    }

    const onMove = (e: MouseEvent) => {
      const now = Date.now();
      mousePos.current.push({ t: now, x: e.clientX, y: e.clientY });
      lastActivity.current = now;
      // Trim to last 5000 points
      if (mousePos.current.length > 5000) mousePos.current.splice(0, 1000);
    };
    const onClick = () => {
      clickTs.current.push(Date.now());
      lastActivity.current = Date.now();
    };
    const onKey = () => {
      keyTs.current.push(Date.now());
      lastActivity.current = Date.now();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);

    // Update local display every 1.5 seconds
    const localTimer = setInterval(() => setVitals(compute()), LOCAL_UPDATE_MS);
    // Send to backend every 6 seconds, also immediately
    sendToBackend();
    const backendTimer = setInterval(sendToBackend, SEND_INTERVAL_MS);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
      clearInterval(localTimer);
      clearInterval(backendTimer);
    };
  }, [active, compute, sendToBackend]);

  return vitals;
}
