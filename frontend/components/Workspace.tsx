"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { ArrowUpRight, CircleHelp, Flame, LayoutDashboard, ListChecks, MessageCircle, Radio, UserRound } from "lucide-react";

export function EmberMark({ small = false }: { small?: boolean }) {
  return <span className={`ember-mark${small ? " ember-mark-small" : ""}`} aria-hidden="true"><Flame size={small ? 17 : 23} strokeWidth={1.7} /></span>;
}

export default function Workspace({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname();
  const links = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/evaluate", label: "Your check-in", icon: ListChecks },
    { href: "/dashboard#sources", label: "Session inputs", icon: Radio },
    { href: "/dashboard#conversation", label: "Conversation", icon: MessageCircle },
  ];

  return <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: "easeOut" }}>
    <div className="workspace">
      <a className="skip-link" href="#workspace-main">Skip to content</a>
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand" aria-label="Ember home"><EmberMark /><span>ember<span className="brand-period">.</span></span></Link>
        <span className="sidebar-caption">Your workspace</span>
        <nav aria-label="Main navigation" className="workspace-navigation">
          {links.map(({ href, label, icon: Icon }) => {
            const selected = pathname === href;
            return <Link key={href} href={href} aria-label={label} aria-current={selected ? "page" : undefined} className={selected ? "nav-selected" : ""}>
              {selected && <motion.span className="nav-highlight" layoutId="workspace-navigation" />}
              <Icon size={18} /><span>{label}</span>
            </Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><span className="small-orbit" aria-hidden="true" /><strong>A little context helps.</strong><p>Your experience is the starting point. Choose which signals to add.</p><Link href="/evaluate">Start a check-in <ArrowUpRight size={15} /></Link></div>
          <Link className={`account-link${pathname === "/login" ? " account-selected" : ""}`} href="/login" aria-label="Local account" aria-current={pathname === "/login" ? "page" : undefined}><span className="account-icon"><UserRound size={17} /></span><span>Local account<small>Sign in or create one</small></span></Link>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <span className="breadcrumb-label">Workspace <span>/</span> <strong>{title}</strong></span>
          <div className="topbar-actions"><span className="local-label"><span /> Local session</span>
            <details className="workspace-help">
              <summary aria-label="About this workspace"><CircleHelp size={19} /></summary>
              <div><strong>Your data, your choice</strong><p>Collection starts when you choose. Camera and microphone stay off until enabled. Your check-in and selected evidence are sent to the configured provider when you run an assessment.</p></div>
            </details>
          </div>
        </header>
        <main id="workspace-main" className="workspace-main">{children}</main>
        <footer className="workspace-footer"><span>Ember</span><span>Make room for a check-in.</span></footer>
      </div>
    </div>
  </MotionConfig>;
}
