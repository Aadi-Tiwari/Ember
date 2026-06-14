"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { useVoiceAnalyzer } from "../hooks/useVoiceAnalyzer";
import { VoicePoweredOrb } from "./ui/voice-powered-orb";

type Props = { active: boolean };

function jitterColor(j: number) {
  if (j < 10) return "#22c55e";
  if (j < 25) return "#f59e0b";
  return "#ef4444";
}

export default function VoicePanel({ active }: Props) {
  const [micEnabled, setMicEnabled] = useState(false);

  useEffect(() => { if (!active) setMicEnabled(false); }, [active]);

  const voice = useVoiceAnalyzer(active && micEnabled);

  const energy     = voice?.energy      ?? 0;
  const speaking   = voice?.is_speaking ?? false;
  const pitchHz    = voice?.pitch_hz    ?? -1;
  const jitterPct  = Math.round((voice?.jitter ?? 0) * 100);
  const cadencePct = Math.round((voice?.cadence ?? 0) * 100);
  const energyPct  = Math.min(100, Math.round(energy * 200));

  const stressScore = Math.min(100, Math.round(jitterPct * 0.7 + Math.max(0, 25 - energyPct) * 0.8));
  const stressColor = stressScore < 30 ? "#22c55e" : stressScore < 60 ? "#f59e0b" : "#ef4444";
  const stressLabel = stressScore < 30 ? "Normal" : stressScore < 60 ? "Elevated" : "High";
  const stressDesc  = stressScore < 30
    ? "Voice patterns are steady and consistent."
    : stressScore < 60
    ? "Some vocal instability - common during focused work."
    : "High vocal stress detected, possibly from fatigue or tension.";

  return (
    <div className="rounded-2xl flex flex-col overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>

      {/* ── Orb visualizer ── */}
      <div className="relative overflow-hidden" style={{ height: 240, background: "var(--surface-2)", flexShrink: 0 }}>

        {/* Orb always renders; enableVoiceControl activates voice reactivity */}
        <div style={{ position: "absolute", inset: 0 }}>
          <VoicePoweredOrb
            enableVoiceControl={micEnabled && active}
            hue={30}
            voiceSensitivity={2}
            maxRotationSpeed={1.4}
            maxHoverIntensity={0.9}
          />
        </div>

        {/* Overlay when mic not enabled */}
        {!micEnabled && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Mic size={20} color="var(--amber)" />
            </div>
            <button onClick={() => setMicEnabled(true)} style={{
              background: "rgba(245,158,11,0.14)",
              border: "1px solid rgba(245,158,11,0.3)",
              color: "var(--amber)",
              borderRadius: 10, padding: "6px 16px",
              fontSize: "0.75rem", fontWeight: 500, cursor: "pointer",
            }}>
              Enable Mic
            </button>
          </div>
        )}

        {/* Status pill when active */}
        {micEnabled && (
          <div style={{ position: "absolute", bottom: 14, left: 16, display: "flex", alignItems: "center", gap: 7 }}>
            <motion.div
              style={{ width: 6, height: 6, borderRadius: "50%", background: speaking ? "var(--amber)" : "rgba(255,255,255,0.4)" }}
              animate={{ opacity: speaking ? [1, 0.2, 1] : 0.5 }}
              transition={{ duration: 0.7, repeat: speaking ? Infinity : 0 }}
            />
            <span style={{ fontSize: "0.72rem", fontWeight: 500, color: speaking ? "var(--amber)" : "rgba(255,255,255,0.45)" }}>
              {speaking ? "Speaking" : "Listening"}
            </span>
          </div>
        )}

        {/* Pitch display */}
        {micEnabled && pitchHz > 0 && (
          <div style={{ position: "absolute", top: 14, right: 14, textAlign: "right" }}>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--amber)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {pitchHz.toFixed(0)}
            </div>
            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Hz</div>
          </div>
        )}

        {/* Mic off button */}
        {micEnabled && (
          <button onClick={() => setMicEnabled(false)} style={{
            position: "absolute", top: 10, right: pitchHz > 0 ? 54 : 10,
            background: "rgba(0,0,0,0.55)", border: "none",
            padding: 6, borderRadius: 8, cursor: "pointer",
          }} title="Disable mic">
            <MicOff size={11} color="rgba(255,255,255,0.6)" />
          </button>
        )}
      </div>

      {/* ── Metrics grid ── */}
      {voice && micEnabled ? (
        <div className="grid grid-cols-2 gap-px" style={{ background: "var(--border)" }}>
          {[
            {
              label: "Energy",
              value: `${energyPct}%`,
              sub:   energyPct < 10 ? "Low" : energyPct < 40 ? "Moderate" : "High",
              color: energyPct < 10 ? "var(--muted)" : energyPct < 40 ? "#f59e0b" : "#22c55e",
            },
            {
              label: "Speaking",
              value: `${cadencePct}%`,
              sub:   cadencePct < 20 ? "Quiet" : cadencePct < 50 ? "Some" : "Active",
              color: cadencePct < 20 ? "var(--muted)" : "#22c55e",
            },
            {
              label: "Pitch",
              value: pitchHz > 0 ? `${pitchHz.toFixed(0)}` : "--",
              sub:   pitchHz > 0 ? "Hz" : "Not detected",
              color: pitchHz > 0 ? "#60a5fa" : "var(--muted)",
            },
            {
              label: "Jitter",
              value: `${jitterPct}%`,
              sub:   jitterPct < 10 ? "Stable" : jitterPct < 25 ? "Mild" : "Stressed",
              color: jitterColor(jitterPct),
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="flex flex-col gap-0.5 px-5 py-4"
              style={{ background: "var(--surface)" }}>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
              <span className="text-xl font-bold tabular leading-tight" style={{ color }}>{value}</span>
              <span className="text-xs" style={{ color: "var(--muted-2)" }}>{sub}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-5 text-center">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {micEnabled ? "Waiting for audio..." : "Mic not enabled"}
          </p>
        </div>
      )}

      {/* ── Vocal stress ── */}
      {voice && micEnabled ? (
        <div className="px-5 py-4 flex flex-col gap-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--muted)" }}>Vocal stress</span>
            <span className="text-xs font-semibold" style={{ color: stressColor }}>{stressLabel}</span>
          </div>
          <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <motion.div className="absolute left-0 top-0 h-full rounded-full"
              style={{ background: `linear-gradient(90deg, #22c55e 0%, ${stressColor} 100%)` }}
              animate={{ width: `${stressScore}%` }}
              transition={{ type: "spring", stiffness: 60, damping: 16 }}
            />
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--muted-2)" }}>{stressDesc}</p>
        </div>
      ) : micEnabled ? (
        <div className="px-5 py-4">
          <p className="text-xs" style={{ color: "var(--muted-2)" }}>Waiting for audio input...</p>
        </div>
      ) : null}
    </div>
  );
}
