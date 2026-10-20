"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Download, RefreshCw } from "lucide-react";
import { assessmentRequest, type AssessmentContext, type CheckIn, type Finding, type Report } from "../../lib/assessment";
import "./assessment.css";

const FREQUENCIES = [
  ["rarely", "Rarely"], ["sometimes", "Sometimes"], ["often", "Often"],
  ["almost_always", "Almost always"], ["unsure", "Not sure"],
];
const QUESTIONS = [
  { name: "context", label: "Where are these demands coming from?", options: [["work", "Work"], ["study", "Study"], ["other", "Other parts of life"]] },
  { name: "exhaustion", label: "How often do you feel drained by these demands?", options: FREQUENCIES },
  { name: "detachment", label: "How often do you feel distant or cynical about what you do?", options: FREQUENCIES },
  { name: "reduced_effectiveness", label: "How often do you struggle to feel effective at what you do?", options: FREQUENCIES },
  { name: "duration", label: "How long has this pattern been present?", options: [["days", "A few days"], ["weeks", "Several weeks"], ["months", "Months or longer"], ["unsure", "Not sure"]] },
  { name: "recovery", label: "How do you feel after time away from these demands?", options: [["rested", "Rested"], ["partly", "Partly recovered"], ["not_rested", "Still drained"], ["unsure", "Not sure"]] },
];
const CONCERN = { lower: "Lower concern", moderate: "Moderate concern", elevated: "Elevated concern", uncertain: "More context needed" };
const OUTLOOK = { may_ease: "May ease", may_persist: "May persist", may_worsen: "May worsen", uncertain: "Outlook uncertain" };
const SOURCE: Record<string, string> = { vitals: "Activity", emotion: "Face", voice: "Voice", chat: "Chat" };

function Findings({ findings, report }: { findings: Finding[]; report: Report }) {
  return <ul className="assessment-list">{findings.map((finding, index) => (
    <li key={index}>
      <p>{finding.text}</p>
      <div className="evidence-links">{finding.evidence_ids.map(id => (
        <a key={id} href={`#evidence-${id}`}>
          {report.evidence.find(item => item.id === id)?.source}: {id.split(".").at(-1)?.replaceAll("_", " ")}
        </a>
      ))}</div>
    </li>
  ))}</ul>;
}

function TextList({ items }: { items: string[] }) {
  return <ul className="assessment-list">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
}

export default function EvaluatePage() {
  const [context, setContext] = useState<AssessmentContext | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [includeSignals, setIncludeSignals] = useState(false);
  const [includeChat, setIncludeChat] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const contextRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  async function captureContext() {
    contextRef.current?.abort();
    const controller = new AbortController();
    contextRef.current = controller;
    const { signal } = controller;
    setChecking(true);
    setConnectionError("");
    setIncludeSignals(false);
    setIncludeChat(false);
    try {
      const captured = await assessmentRequest<AssessmentContext>("/api/assessment/context", undefined, signal);
      if (!signal.aborted) setContext(captured);
    } catch {
      if (!signal.aborted) {
        setContext(null);
        setConnectionError("The backend is unavailable. Start Ember's local backend, then retry the connection.");
      }
    } finally {
      if (!signal.aborted) setChecking(false);
    }
  }

  useEffect(() => {
    void captureContext();
    return () => { contextRef.current?.abort(); requestRef.current?.abort(); };
  }, []);

  useEffect(() => { if (report) headingRef.current?.focus(); }, [report]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || checking || !context?.available) return;
    const form = new FormData(event.currentTarget);
    const checkIn = Object.fromEntries([...QUESTIONS.map(question => question.name), "notes"]
      .map(name => [name, String(form.get(name) ?? "")])) as CheckIn;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setRequestError("");
    try {
      const assessment = await assessmentRequest<Report>("/api/assess", {
        check_in: checkIn, context_id: context.context_id,
        include_signals: includeSignals, include_chat: includeChat,
      }, controller.signal);
      if (!controller.signal.aborted) setReport(assessment);
    } catch (error) {
      if (!controller.signal.aborted) setRequestError(error instanceof Error ? error.message : "The assessment could not finish. Please retry.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ember-assessment-${report.created_at.slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const sensorSources = context?.sources.filter(source => source !== "chat") ?? [];

  return (
    <main className="assessment-page original-page">
      <nav className="assessment-nav" aria-label="Assessment navigation">
        <Link href="/" className="assessment-brand">EMBER</Link>
        <Link href="/dashboard"><ArrowLeft size={15} /> Back to session</Link>
      </nav>
      <div className="assessment-shell">
        <header className="assessment-heading">
          <p className="assessment-eyebrow">Your context. Connected evidence.</p>
          <h1 ref={headingRef} tabIndex={-1}>{report ? "Your burnout assessment." : "How are you holding up?"}</h1>
          <p>{report
            ? "The agents' assessment, the evidence behind it, and what to do next."
            : "A short check-in helps Ember assess burnout risk and reason about where your current pattern could lead."}</p>
        </header>

        {!report ? (
          <div className="assessment-layout">
            <form onSubmit={submit} className="assessment-card">
              <h2>Start with your experience</h2>
              <p className="assessment-muted">Think about your recent pattern, including days away from work or study. Choose what fits; there are no right answers.</p>
              <fieldset disabled={busy} className="assessment-fields">
                {QUESTIONS.map(question => (
                  <label key={question.name} htmlFor={question.name}>
                    <span>{question.label}</span>
                    <select id={question.name} name={question.name} required defaultValue="">
                      <option value="" disabled>Select an answer</option>
                      {question.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                ))}
                <label htmlFor="notes" className="assessment-wide">
                  <span>What else should Ember understand?</span>
                  <textarea id="notes" name="notes" rows={4} maxLength={3000} placeholder="Changes in workload, sleep, support, or anything these questions missed." />
                </label>
              </fieldset>
              <fieldset className="assessment-sources" disabled={busy || checking}>
                <legend>Session evidence</legend>
                <p className="assessment-muted">{context && context.sources.length
                  ? `Captured at ${new Date(context.captured_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. This snapshot stays fixed while you answer.`
                  : "A check-in is enough to begin. No current session signals are available."}</p>
                <label className="assessment-check">
                  <input type="checkbox" checked={includeSignals} disabled={!sensorSources.length} onChange={event => setIncludeSignals(event.target.checked)} />
                  Include session measurements{sensorSources.length ? ` (${sensorSources.map(source => SOURCE[source]).join(", ")})` : ""}
                </label>
                <label className="assessment-check">
                  <input type="checkbox" checked={includeChat} disabled={!context?.sources.includes("chat")} onChange={event => setIncludeChat(event.target.checked)} />
                  Include my latest chat message
                </label>
              </fieldset>
              <p className="assessment-muted assessment-disclosure">Submitting sends your answers and selected evidence to the configured AI provider. Camera frames and microphone audio stay in your browser. Reports stay on this page unless you download one.</p>
              {requestError && <p role="alert" className="assessment-error">{requestError}</p>}
              {!checking && !context?.available && (
                <p id="assessment-connection-error" role="status" className="assessment-error">
                  {connectionError || "The model connection is not configured. Add your provider key to Ember's local .env file and restart the backend, then retry. Your answers will stay here."}
                </p>
              )}
              <button
                className="assessment-primary"
                disabled={busy || checking}
                type={context?.available ? "submit" : "button"}
                aria-describedby={!checking && !context?.available ? "assessment-connection-error" : undefined}
                onClick={!context?.available ? () => void captureContext() : undefined}
              >
                {busy ? "Reviewing your check-in..." : checking ? "Checking connection..." : context?.available ? "Run burnout assessment" : "Retry connection"} <ArrowRight size={17} />
              </button>
              {busy && <p role="status" className="assessment-muted">Context and signal agents review the evidence, then the assessment agent brings their findings together.</p>}
            </form>
            <aside className="assessment-aside">
              <section className="assessment-card">
                <p className="assessment-eyebrow">The assessment team</p>
                <h2>A clearer picture, with reasons.</h2>
                <ol className="assessment-steps">
                  <li><strong>Context agent</strong><p>Looks at exhaustion, detachment, effectiveness, and recovery in your own words.</p></li>
                  <li><strong>Signal agent</strong><p>Examines available measurements and checks other explanations.</p></li>
                  <li><strong>Assessment agent</strong><p>Reconciles the findings into a risk assessment, a conditional outlook, and follow-up actions.</p></li>
                </ol>
              </section>
              <section className="assessment-card" aria-live="polite">
                <h2>{checking ? "Connecting..." : context?.available ? "Ready for your check-in" : "Assessment unavailable"}</h2>
                <p className="assessment-muted">{connectionError || (context?.available
                  ? "You control which session evidence is included. The check-in works without a camera or microphone."
                  : "Configure the AI provider in your local backend to run the assessment team.")}</p>
                {!context?.available && <a className="assessment-text-link" href="https://github.com/Aadi-Tiwari/Ember#run-locally">Local setup guide</a>}
                <button type="button" className="assessment-secondary" disabled={checking || busy} onClick={() => void captureContext()}>
                  <RefreshCw size={14} /> Refresh connection and evidence
                </button>
              </section>
            </aside>
          </div>
        ) : (
          <div className="assessment-report">
            <section className={`assessment-card assessment-result concern-${report.assessment.concern}`}>
              <p className="assessment-eyebrow">Burnout risk assessment</p>
              <h2>{CONCERN[report.assessment.concern]}</h2>
              <p>{report.assessment.summary}</p>
              <p className="assessment-muted">Assessed {new Date(report.created_at).toLocaleString()} from this check-in and the evidence you selected.</p>
            </section>
            <div className="assessment-report-grid">
              <section className="assessment-card"><h2>What shaped the assessment</h2><Findings findings={report.assessment.rationale} report={report} /></section>
              <section className="assessment-card"><p className="assessment-eyebrow">If current demands and recovery continue</p><h2>{OUTLOOK[report.assessment.outlook]}</h2><p>{report.assessment.outlook_basis}</p><p className="assessment-muted">A conditional outlook from this check-in, not a measured trend.</p></section>
              <section className="assessment-card"><h2>What you can do next</h2><TextList items={report.assessment.next_steps} /></section>
              <section className="assessment-card"><h2>What remains uncertain</h2><TextList items={report.assessment.uncertainties} /></section>
            </div>
            <section className="assessment-card"><h2>Questions worth coming back to</h2><TextList items={report.assessment.follow_up} /></section>
            <section className="assessment-card">
              <h2>Read each agent's review</h2>
              <p className="assessment-muted">Separate review roles use the same configured model. Agreement between them is not a measure of accuracy.</p>
              {Object.entries(report.reviews).map(([name, review]) => (
                <details key={name}><summary>{name === "context" ? "Context agent" : "Signal agent"}</summary>
                  <p>{review.summary}</p><Findings findings={review.findings} report={report} />
                  <h3>Uncertainties</h3><TextList items={review.uncertainties} />
                  {review.follow_up.length > 0 && <><h3>Follow-up</h3><TextList items={review.follow_up} /></>}
                </details>
              ))}
            </section>
            <section className="assessment-card">
              <details><summary>Evidence used in this assessment</summary>
                <ul className="assessment-list">{report.evidence.map(item => (
                  <li id={`evidence-${item.id}`} key={item.id}>
                    <strong>{item.source}</strong>
                    {item.received_at && <p className="assessment-muted">Received {new Date(item.received_at).toLocaleString()}</p>}
                    <p className="assessment-observation">{item.observation}</p>
                  </li>
                ))}</ul>
              </details>
            </section>
            <p className="assessment-muted">{report.limitation}</p>
            <div className="assessment-actions">
              <button type="button" className="assessment-primary" onClick={download}><Download size={16} /> Download report</button>
              <button type="button" className="assessment-secondary" onClick={() => { setReport(null); setRequestError(""); void captureContext(); }}>New check-in</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
