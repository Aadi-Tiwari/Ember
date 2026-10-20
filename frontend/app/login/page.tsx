"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, LoaderCircle, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import Workspace, { EmberMark } from "../../components/Workspace";
import ConnectionArt from "../../components/ConnectionArt";
import { setToken, setUser, BASE } from "../../lib/api";
import "./account.css";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${BASE}/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email, password } : { email, password, display_name: name, role }),
      });
      const account = await response.json();
      if (!response.ok) {
        setError(typeof account.detail === "string" ? account.detail : "Check your details and try again.");
        return;
      }
      setToken(account.token);
      setUser(account.user);
      router.push("/dashboard");
    } catch {
      setError("Could not connect. Check that the local backend is running, then try again.");
    } finally {
      setLoading(false);
    }
  }

  return <Workspace title="Local account">
    <div className="page-heading"><div><span className="eyebrow">A space for you</span><h1>Your local account</h1><p>Sign in to this workspace, or make yourself at home.</p></div></div>
    <div className="account-layout panel">
      <section className="account-story">
        <EmberMark />
        <div><span className="eyebrow">Start with how you feel</span><h2>A little space.<br /> A clearer picture.</h2><p>Connect your experience with the context around it. Take a check-in at your own pace.</p></div>
        <ConnectionArt />
        <Link href="/evaluate">Take a check-in without an account <ArrowUpRight size={16} /></Link>
      </section>
      <section className="account-form-panel">
        <div className="account-switch" role="group" aria-label="Account action">
          {(["login", "register"] as Mode[]).map((option) => <button key={option} type="button" disabled={loading} aria-pressed={mode === option} onClick={() => { setMode(option); setError(""); }}>
            {mode === option && <motion.span layoutId="account-mode" className="account-switch-active" />}
            <span>{option === "login" ? "Sign in" : "Create account"}</span>
          </button>)}
        </div>
        <motion.div key={mode} initial={{ opacity: 0, x: mode === "login" ? -8 : 8 }} animate={{ opacity: 1, x: 0 }}>
          <h2>{mode === "login" ? "Welcome back." : "Let's get you settled."}</h2>
          <p className="account-intro">{mode === "login" ? "Enter your details to open your workspace." : "Create an account on this local backend."}</p>
          <form onSubmit={submit} className="account-form">
            <fieldset disabled={loading}>
              {mode === "register" && <>
                <label htmlFor="account-name">Display name</label>
                <div className="account-field"><UserRound size={16} /><input id="account-name" name="name" type="text" autoComplete="name" placeholder="Your name" value={name} onChange={event => setName(event.target.value)} required /></div>
                <label htmlFor="account-role">I am a</label>
                <div className="account-field"><UserRound size={16} /><select id="account-role" name="role" value={role} onChange={event => setRole(event.target.value)}><option value="student">Student</option><option value="counselor">Counselor</option></select></div>
              </>}
              <label htmlFor="account-email">Email address</label>
              <div className="account-field"><Mail size={16} /><input id="account-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} required /></div>
              <label htmlFor="account-password">Password</label>
              <div className="account-field"><LockKeyhole size={16} /><input id="account-password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} required /></div>
            </fieldset>
            {error && <p className="inline-error" role="alert">{error}</p>}
            <motion.button whileTap={{ scale: 0.99 }} className="button button-primary" type="submit" disabled={loading}>{loading ? <><LoaderCircle size={16} className="spin" /> Please wait</> : <>{mode === "login" ? "Sign in" : "Create account"}<ArrowRight size={16} /></>}</motion.button>
          </form>
        </motion.div>
        <p className="account-notice"><ShieldCheck size={16} /><span>Account records stay in the local backend. This is a shared local workspace; accounts do not separate collected observations.</span></p>
      </section>
    </div>
  </Workspace>;
}
