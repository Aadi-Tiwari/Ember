"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Circle, Clock3, Keyboard, LoaderCircle, MousePointer2, Pause, Play, Radio, ShieldCheck } from "lucide-react";
import Workspace from "../../components/Workspace";
import ConnectionArt from "../../components/ConnectionArt";
import FaceCam from "../../components/FaceCam";
import VoicePanel from "../../components/VoicePanel";
import ChatPanel from "../../components/ChatPanel";
import { useLiveStream } from "../../hooks/useLiveStream";
import { useActivityTracker } from "../../hooks/useActivityTracker";
import { BASE } from "../../lib/api";

function elapsedLabel(seconds: number) {
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
}

export default function Home() {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [activity, setActivity] = useState<number[]>([]);
  const sessionRequest = useRef<AbortController | null>(null);
  const live = useLiveStream();
  const localVitals = useActivityTracker(active);

  useEffect(() => () => sessionRequest.current?.abort(), []);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setElapsed(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (active && localVitals) setActivity(values => [...values.slice(-39), localVitals.mouse_velocity_px_s]);
  }, [active, localVitals]);

  async function startSession() {
    if (starting) return;
    setStarting(true);
    setStartError("");
    const controller = new AbortController();
    sessionRequest.current = controller;
    try {
      const response = await fetch(`${BASE}/api/session`, { method: "POST", signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error();
      setElapsed(0);
      setActivity([]);
      setActive(true);
      live.connect();
    } catch {
      if (!controller.signal.aborted) setStartError("The collection session could not start. Check that the local backend is running.");
    } finally {
      if (!controller.signal.aborted) setStarting(false);
    }
  }

  function endSession() {
    sessionRequest.current?.abort();
    setActive(false);
    live.disconnect();
  }

  const sources = live.state.sources;
  const connectedSources = active ? Object.values(sources).filter(Boolean).length : 0;
  const maximum = Math.max(...activity, 1);
  const points = activity.map((value, index) => `${index / Math.max(activity.length - 1, 1) * 640},${92 - value / maximum * 70}`).join(" ");

  return <Workspace title="Overview">
    <div className="page-heading"><div><p className="page-kicker">A moment for yourself</p><h1>How are you holding up?</h1><p>Connect the everyday signals. Start with what you feel.</p></div><Link className="button button-primary" href="/evaluate">Start a check-in <ArrowRight size={16} /></Link></div>

    <div className="dashboard-intro">
      <section className="welcome-panel">
        <div className="welcome-copy"><span className="tag tag-quiet"><span /> Your burnout assessment</span><h2>Put your experience<br />into perspective.</h2><p>A short check-in brings your experience and chosen signals together. Get an assessment you can understand, with reasons and next steps.</p><Link href="/evaluate" className="welcome-link">Let's check in <ArrowRight size={17} /></Link></div>
        <ConnectionArt />
      </section>
      <section className="session-panel">
        <div className="panel-title"><span className="icon-tile"><Radio size={18} /></span><span className={`tag ${active ? "tag-live" : "tag-neutral"}`}><span />{active ? "Collecting" : "Not collecting"}</span></div>
        <h2>Your session</h2><p>Add context from activity, face, voice, or a conversation.</p>
        <div className="session-clock"><Clock3 size={17} /><span>{elapsedLabel(elapsed)}</span><small>elapsed</small></div>
        <button className={`button ${active ? "button-secondary" : "button-dark"}`} disabled={starting} onClick={active ? endSession : startSession}>
          {starting ? <LoaderCircle className="spin" size={16} /> : active ? <Pause size={15} /> : <Play size={15} />}
          {starting ? "Starting session..." : active ? "End session" : "Start collection"}
        </button>
        <small className="session-footnote">Camera and microphone start separately.</small>
        {startError && <p role="alert" className="notice notice-error">{startError}</p>}
      </section>
    </div>

    <div className="section-heading" id="sources"><div><h2>Session inputs</h2><p>Choose what you want to share.</p></div><span className="source-count"><span className={active && live.state.connected ? "status-dot connected" : "status-dot"} />{active ? `${connectedSources} sources connected` : "Collection is off"}</span></div>

    <div className="dashboard-grid">
      <section className="panel activity-panel">
        <div className="panel-heading"><div className="panel-label"><span className="icon-tile icon-blue"><MousePointer2 size={18} /></span><div><h3>Activity</h3><p>From this browser session</p></div></div><span className={`tag ${active ? "tag-live" : "tag-neutral"}`}>{active ? "Live" : "Off"}</span></div>
        <div className="activity-values">
          <div><span><MousePointer2 size={13} /> Pointer movement</span><strong>{active && localVitals ? localVitals.mouse_velocity_px_s : "--"}<small>px/s</small></strong></div>
          <div><span><Keyboard size={14} /> Key rate</span><strong>{active && localVitals ? localVitals.key_rate_per_min : "--"}<small>/min</small></strong></div>
          <div><span><Pause size={13} /> Idle ratio</span><strong>{active && localVitals ? Math.round(localVitals.idle_ratio * 100) : "--"}<small>%</small></strong></div>
        </div>
        <div className="activity-chart">
          {active && activity.length > 1
            ? <svg viewBox="0 0 640 108" preserveAspectRatio="none" role="img" aria-label="Recent pointer movement measured during this session"><path d="M0 26H640M0 59H640M0 92H640" stroke="var(--border)" strokeDasharray="3 5" fill="none" /><polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>
            : <div className="chart-empty"><span className="chart-empty-line" /><p>{active ? "Collecting the first activity samples..." : "Start collection to see your activity here."}</p></div>}
        </div>
        <div className="panel-footnote"><span>{active ? "Current session only" : "No activity collected"}</span><span>Measurements, not a health score</span></div>
      </section>
      <section className="panel evidence-guide">
        <div className="panel-heading"><h3>You choose the evidence</h3><ShieldCheck size={19} /></div>
        <div className="evidence-guide-row"><span className="guide-check"><Check size={13} /></span><div><strong>Your check-in comes first</strong><p>How you feel is the primary input.</p></div></div>
        <div className="evidence-guide-row"><span className="guide-check"><Check size={13} /></span><div><strong>Signals add context</strong><p>Select them before you submit.</p></div></div>
        <div className="evidence-guide-row"><span className="guide-check"><Check size={13} /></span><div><strong>See the reasoning</strong><p>Every finding links to its evidence.</p></div></div>
        <Link href="/evaluate">Open your check-in <ChevronRight size={15} /></Link>
      </section>
      <FaceCam enabled={active} />
      <VoicePanel active={active} />
      <section className="panel conversation-panel" id="conversation"><ChatPanel active={active} /></section>
    </div>
    {active && live.state.error && <p role="alert" className="notice notice-error">{live.state.error}</p>}
    <div className="workspace-note"><Circle size={12} /><p>Session inputs give the assessment context. You can run a check-in without enabling any of them.</p></div>
  </Workspace>;
}
