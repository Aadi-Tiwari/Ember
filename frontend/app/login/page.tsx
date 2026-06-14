"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Mail, Lock, User, Shield } from "lucide-react";
import { setToken, setUser, BASE } from "../../lib/api";

type Mode = "login" | "register";
type Role = "student" | "counselor";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

      const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Something went wrong");
        return;
      }

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
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--bg)" }}
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2.5 mb-10"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)" }}
        >
          <Activity size={20} color="var(--amber)" />
        </div>
        <span className="text-lg font-bold tracking-tight">PulseCheck</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Mode toggle */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl mb-6 w-full"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize"
              style={{
                background: mode === m ? "var(--surface-2)" : "transparent",
                color: mode === m ? "var(--text)" : "var(--muted)",
              }}
            >
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <AnimatePresence>
            {mode === "register" && (
              <motion.div
                key="name"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-3 pb-1">
                  <Field
                    icon={<User size={14} />}
                    type="text"
                    placeholder="Display name"
                    value={name}
                    onChange={setName}
                    required={mode === "register"}
                  />
                  {/* Role selector */}
                  <div
                    className="flex items-center gap-1 p-1 rounded-xl"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    {(["student", "counselor"] as Role[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize"
                        style={{
                          background: role === r ? "var(--surface-2)" : "transparent",
                          color: role === r ? "var(--text)" : "var(--muted)",
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Field
            icon={<Mail size={14} />}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={setEmail}
            required
          />
          <Field
            icon={<Lock size={14} />}
            type="password"
            placeholder="Password"
            value={password}
            onChange={setPassword}
            required
          />

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-red-400 px-1"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: loading ? "var(--surface-2)" : "rgba(245,158,11,0.18)",
              border: "1px solid rgba(245,158,11,0.35)",
              color: loading ? "var(--muted)" : "var(--amber)",
            }}
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-8 flex items-center gap-2 justify-center" style={{ color: "var(--muted)" }}>
          <Shield size={12} />
          <span className="text-xs">Behavioral data only. No message content is read.</span>
        </div>
      </motion.div>
    </div>
  );
}

function Field({
  icon,
  type,
  placeholder,
  value,
  onChange,
  required,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <span style={{ color: "var(--muted)" }}>{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="flex-1 bg-transparent text-sm outline-none"
        style={{ color: "var(--text)" }}
      />
    </div>
  );
}
