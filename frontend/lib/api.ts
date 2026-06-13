const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pc_token");
}

export function setToken(token: string): void {
  localStorage.setItem("pc_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("pc_token");
  localStorage.removeItem("pc_user");
}

export function getUser(): { id: string; email: string; display_name: string; role: string } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("pc_user") ?? "null");
  } catch {
    return null;
  }
}

export function setUser(u: object): void {
  localStorage.setItem("pc_user", JSON.stringify(u));
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  return res.json();
}

export { BASE };
