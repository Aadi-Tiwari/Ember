import { BASE } from "./api";

export type CheckIn = {
  context: string;
  exhaustion: string;
  detachment: string;
  reduced_effectiveness: string;
  duration: string;
  recovery: string;
  notes: string;
};
export type Finding = { text: string; evidence_ids: string[] };
export type Review = { summary: string; findings: Finding[]; uncertainties: string[]; follow_up: string[] };
export type Report = {
  id: string;
  created_at: string;
  model: string;
  check_in: CheckIn;
  evidence: { id: string; source: string; observation: string; received_at: string | null }[];
  reviews: Record<string, Review>;
  assessment: {
    concern: "lower" | "moderate" | "elevated" | "uncertain";
    outlook: "may_ease" | "may_persist" | "may_worsen" | "uncertain";
    summary: string;
    rationale: Finding[];
    outlook_basis: string;
    next_steps: string[];
    uncertainties: string[];
    follow_up: string[];
  };
  limitation: string;
};
export type AssessmentContext = {
  available: boolean;
  model: string | null;
  sources: string[];
  context_id: string;
  captured_at: string;
};

export async function assessmentRequest<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(typeof payload.detail === "string" ? payload.detail : "Check your answers and try again.");
  }
  return payload;
}
