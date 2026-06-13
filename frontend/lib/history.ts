export type HistoryEntry = {
  id: string;
  timestamp: string;
  scenario: string;
  riskScore: number;
  daysToThreshold: number | null;
};

const KEY = "pulsecheck_history";
const MAX = 5;

export function saveRun(entry: Omit<HistoryEntry, "id">): void {
  const prev = loadHistory();
  const next = [{ ...entry, id: crypto.randomUUID() }, ...prev].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function clearHistory(): void {
  localStorage.removeItem(KEY);
}
