"use client";

import { useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowDownToLine, ArrowUpRight, Check, ChevronDown, CircleHelp, FileText, GitBranch, ListChecks, MessageCircle } from "lucide-react";
import type { Finding, Report } from "../lib/assessment";

const CONCERN = { lower: "Lower concern", moderate: "Moderate concern", elevated: "Elevated concern", uncertain: "More context needed" };
const OUTLOOK = { may_ease: "May ease", may_persist: "May persist", may_worsen: "May worsen", uncertain: "Outlook uncertain" };

export default function AssessmentReport({ report, onNew }: { report: Report; onNew: () => void }) {
  const evidenceRef = useRef<HTMLDetailsElement>(null);
  const reducedMotion = useReducedMotion();

  function revealEvidence(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    if (evidenceRef.current) evidenceRef.current.open = true;
    const target = document.getElementById(`evidence-${id}`);
    target?.scrollIntoView({ block: "center", behavior: reducedMotion ? "instant" : "smooth" });
    target?.focus({ preventScroll: true });
    window.history.replaceState(null, "", `#evidence-${id}`);
  }

  function findings(items: Finding[]) {
    return <ul className="finding-list">{items.map((finding, index) => <li key={index}>
      <p>{finding.text}</p><div className="evidence-links">{finding.evidence_ids.map(id => <a key={id} href={`#evidence-${id}`} onClick={event => revealEvidence(event, id)}><FileText size={11} />{report.evidence.find(item => item.id === id)?.source}: {id.split(".").at(-1)?.replaceAll("_", " ")}<ArrowUpRight size={10} /></a>)}</div>
    </li>)}</ul>;
  }

  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ember-assessment-${report.created_at.slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="report-layout">
    <section className={`report-summary concern-${report.assessment.concern}`}>
      <div className="report-summary-top"><span className="tag tag-quiet"><Check size={12} /> Assessment complete</span><span>{new Date(report.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span></div>
      <h2>{CONCERN[report.assessment.concern]}</h2><p>{report.assessment.summary}</p>
      <div className="report-summary-bottom"><span><FileText size={14} /> {report.evidence.length} evidence items reviewed</span><button type="button" className="button button-secondary" onClick={download}><ArrowDownToLine size={15} /> Download report</button></div>
    </section>
    <div className="report-grid">
      <section className="report-panel"><div className="report-panel-title"><span className="icon-tile icon-blue"><GitBranch size={18} /></span><h2>What shaped the assessment</h2></div>{findings(report.assessment.rationale)}</section>
      <section className="report-panel report-outlook"><div className="report-panel-title"><span className="icon-tile icon-peach"><ArrowUpRight size={19} /></span><h2>Your conditional outlook</h2></div><span className="outlook-label">{OUTLOOK[report.assessment.outlook]}</span><p>{report.assessment.outlook_basis}</p><small>If current demands and recovery continue. This is not a measured trend.</small></section>
      <section className="report-panel"><div className="report-panel-title"><span className="icon-tile icon-mint"><ListChecks size={18} /></span><h2>What you can do next</h2></div><ul className="action-list">{report.assessment.next_steps.map((step, index) => <li key={index}><span><Check size={12} /></span><p>{step}</p></li>)}</ul></section>
      <section className="report-panel"><div className="report-panel-title"><span className="icon-tile"><CircleHelp size={18} /></span><h2>What remains uncertain</h2></div><ul className="report-text-list">{report.assessment.uncertainties.map((item, index) => <li key={index}>{item}</li>)}</ul></section>
    </div>
    <section className="report-follow-up"><MessageCircle size={20} /><div><h2>Questions worth coming back to</h2><ul>{report.assessment.follow_up.map((item, index) => <li key={index}>{item}</li>)}</ul></div></section>
    <section className="report-panel report-reviews">
      <div className="report-section-heading"><div><h2>Look inside the assessment</h2><p>The review roles use the same model. Their agreement is not a measure of accuracy.</p></div><span className="tag tag-neutral">Evidence trail</span></div>
      {Object.entries(report.reviews).map(([name, review]) => <details className="report-disclosure" key={name}>
        <summary><span className="disclosure-icon"><GitBranch size={16} /></span><span>{name === "context" ? "Context agent" : "Signal agent"}<small>{name === "context" ? "Your reported experience" : "Measurements and other explanations"}</small></span><ChevronDown size={16} /></summary>
        <div className="disclosure-body"><p>{review.summary}</p>{findings(review.findings)}<h3>Uncertainties</h3><ul className="report-text-list">{review.uncertainties.map((item, index) => <li key={index}>{item}</li>)}</ul>{review.follow_up.length > 0 && <><h3>Follow-up</h3><ul className="report-text-list">{review.follow_up.map((item, index) => <li key={index}>{item}</li>)}</ul></>}</div>
      </details>)}
      <details ref={evidenceRef} className="report-disclosure">
        <summary><span className="disclosure-icon"><FileText size={16} /></span><span>Evidence used<small>Your answers and selected session inputs</small></span><ChevronDown size={16} /></summary>
        <div className="disclosure-body"><ul className="evidence-records">{report.evidence.map(item => <li id={`evidence-${item.id}`} key={item.id} tabIndex={-1}><div><span className="evidence-record-dot" /><strong>{item.source}</strong>{item.received_at && <small>Received {new Date(item.received_at).toLocaleTimeString()}</small>}</div><p>{item.observation}</p></li>)}</ul></div>
      </details>
    </section>
    <div className="report-bottom"><p>{report.limitation}</p><button type="button" className="button button-secondary" onClick={onNew}>New check-in <ArrowUpRight size={15} /></button></div>
  </div>;
}
