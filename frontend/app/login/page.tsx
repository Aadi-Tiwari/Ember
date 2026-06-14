"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Shield } from "lucide-react";
import { setToken, setUser, BASE } from "../../lib/api";

type Mode = "login" | "register";
type Role = "student" | "counselor";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode]         = useState<Mode>("login");
  const [role, setRole]         = useState<Role>("student");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const body: Record<string, string> =
        mode === "login"
          ? { email, password }
          : { email, password, display_name: name, role };
      const res  = await fetch(`${BASE}${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail ?? "Something went wrong"); return; }
      setToken(data.token);
      setUser(data.user);
      router.push("/");
    } catch {
      setError("Could not connect to server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", position: "relative" }}>

      {/* Subtle grid */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`h${i}`} style={{ position: "absolute", height: 1, left: 0, right: 0, top: `${14.28 * (i + 1)}%`, background: "rgba(255,255,255,0.035)" }} />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`v${i}`} style={{ position: "absolute", width: 1, top: 0, bottom: 0, left: `${20 * (i + 1)}%`, background: "rgba(255,255,255,0.035)" }} />
        ))}
      </div>

      {/* Wordmark */}
      <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ marginBottom: 52, display: "flex", alignItems: "baseline", gap: 5 }}>
        <span className="font-sora" style={{ fontWeight: 800, fontSize: "1.15rem", color: "#fff", letterSpacing: "-0.01em" }}>EMBER</span>
        <span style={{ fontSize: "0.48rem", color: "rgba(255,255,255,0.28)", letterSpacing: "0.06em" }}>TM</span>
      </motion.div>

      {/* Card */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.55 }}
        style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 10 }}>

        {/* Heading */}
        <h1 className="font-garamond" style={{
          fontStyle: "italic", fontWeight: 400,
          fontSize: "2.8rem", color: "#fff", lineHeight: 1.08,
          marginBottom: 8, letterSpacing: "-0.01em",
        }}>
          {mode === "login" ? "Welcome back." : "Get started."}
        </h1>
        <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.35)", marginBottom: 36, lineHeight: 1.5 }}>
          {mode === "login"
            ? "Sign in to continue to Ember."
            : "Create your account to start monitoring."}
        </p>

        {/* Mode toggle */}
        <div style={{
          display: "flex", gap: 3, padding: 3,
          borderRadius: 999, marginBottom: 22,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          {(["login", "register"] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
              flex: 1, padding: "8px 0", borderRadius: 999, border: "none",
              fontSize: "0.82rem", fontWeight: 500, cursor: "pointer",
              background: mode === m ? "#fff" : "transparent",
              color: mode === m ? "#000" : "rgba(255,255,255,0.38)",
              transition: "all 0.2s",
            }}>
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <AnimatePresence>
            {mode === "register" && (
              <motion.div key="register-fields"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 2 }}>
                  <Field icon={<User size={13} />} type="text" placeholder="Display name" value={name} onChange={setName} required={mode === "register"} />
                  <div style={{
                    display: "flex", gap: 3, padding: 3, borderRadius: 12,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}>
                    {(["student", "counselor"] as Role[]).map(r => (
                      <button key={r} type="button" onClick={() => setRole(r)} style={{
                        flex: 1, padding: "7px 0", borderRadius: 10, border: "none",
                        fontSize: "0.78rem", fontWeight: 500, cursor: "pointer",
                        background: role === r ? "rgba(255,255,255,0.1)" : "transparent",
                        color: role === r ? "#fff" : "rgba(255,255,255,0.35)",
                        transition: "all 0.2s", textTransform: "capitalize",
                      }}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Field icon={<Mail size={13} />} type="email" placeholder="Email address" value={email} onChange={setEmail} required />
          <Field icon={<Lock size={13} />} type="password" placeholder="Password" value={password} onChange={setPassword} required />

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: "0.78rem", color: "#f87171", paddingLeft: 2 }}>
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button type="submit" disabled={loading} style={{
            marginTop: 6, padding: "14px 0", borderRadius: 999, border: "none",
            background: loading ? "rgba(255,255,255,0.08)" : "#fff",
            color: loading ? "rgba(255,255,255,0.25)" : "#0a0a0a",
            fontSize: "0.9rem", fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            transition: "all 0.2s",
            boxShadow: loading ? "none" : "0 4px 20px rgba(255,255,255,0.1)",
          }}>
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        {/* Privacy */}
        <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 6, justifyContent: "center", color: "rgba(255,255,255,0.22)" }}>
          <Shield size={11} />
          <span style={{ fontSize: "0.7rem", letterSpacing: "0.02em" }}>Behavioral signals only. No message content is read.</span>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ icon, type, placeholder, value, onChange, required }: {
  icon: React.ReactNode; type: string; placeholder: string;
  value: string; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "13px 16px", borderRadius: 14,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.08)",
      transition: "border-color 0.2s",
    }}
      onFocus={() => {}} // handled below
    >
      <span style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{icon}</span>
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)} required={required}
        style={{
          flex: 1, background: "transparent", border: "none", outline: "none",
          fontSize: "0.875rem", color: "#fff",
          fontFamily: "Figtree, system-ui, sans-serif",
        }}
      />
    </div>
  );
}
