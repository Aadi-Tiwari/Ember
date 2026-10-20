"use client";

import { useEffect, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useVoiceAnalyzer } from "../hooks/useVoiceAnalyzer";
import { VoicePoweredOrb } from "./ui/voice-powered-orb";

export default function VoicePanel({ active }: { active: boolean }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { if (!active) setEnabled(false); }, [active]);
  const { data, error, ready } = useVoiceAnalyzer(active && enabled);
  const listening = active && enabled && ready;

  return <section className="panel media-panel">
    <div className="panel-heading"><div className="panel-label"><span className="icon-tile icon-peach"><Mic size={18} /></span><div><h3>Voice</h3><p>Energy, cadence, and pitch</p></div></div><span className={`tag ${listening ? "tag-live" : "tag-neutral"}`}>{listening ? data?.is_speaking ? "Speaking" : "Listening" : enabled && !error ? "Connecting" : "Off"}</span></div>
    <div className="media-viewport voice-viewport"><VoicePoweredOrb active={listening} level={data?.energy ?? 0} /><span className="voice-viewport-label">{listening ? "Responding to your voice" : "A little space to speak"}</span></div>
    <div className="media-controls">
      <p>{listening ? "Only derived measurements leave this browser." : enabled && !error ? "Waiting for microphone permission..." : active ? "Add a voice sample when you are ready." : "Start collection to enable your microphone."}</p>
      <button type="button" className="button button-secondary" disabled={!active} onClick={() => setEnabled(value => !value)}>{enabled ? <MicOff size={14} /> : <Mic size={14} />}{enabled ? error ? "Reset microphone" : "Turn microphone off" : "Enable microphone"}</button>
      {error && <p role="alert" className="notice notice-error">{error}</p>}
    </div>
    {listening && data && <div className="voice-measurements">
      <div><span>Energy</span><strong>{data.energy.toFixed(3)}<small>RMS</small></strong></div>
      <div><span>Speaking</span><strong>{Math.round(data.cadence * 100)}<small>%</small></strong></div>
      <div><span>Pitch</span><strong>{data.pitch_hz > 0 ? Math.round(data.pitch_hz) : "--"}<small>Hz</small></strong></div>
      <div><span>Pitch variation</span><strong>{data.pitch_variation.toFixed(2)}</strong></div>
    </div>}
    <div className="media-privacy">Microphone audio stays in this browser.</div>
  </section>;
}
