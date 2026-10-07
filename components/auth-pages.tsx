"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

const authNotices: Record<string, string> = {
  signed_out: "You have been signed out.",
  signin_required: "Sign in to continue to HR Nexus.",
  temporarily_unavailable: "Sign-in is temporarily unavailable. Try again in a moment.",
};

export function AuthPage({ notice, authConfigured }: { notice?: string; authConfigured: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState(notice ? authNotices[notice] || "" : authConfigured ? "" : "Sign-in is not configured for this deployment.");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim()) { setMessage("Enter your username."); return; }
    if (!password) { setMessage("Enter your password."); return; }
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Incorrect username or password.");
      setPassword("");
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Incorrect username or password.");
    } finally {
      setSubmitting(false);
    }
  }

  const brandPanel = <aside className="auth-feature"><span className="auth-feature-top">RRF HR NEXUS <i/> TUGUEGARAO</span><div className="auth-feature-message"><span className="auth-index">01 / PEOPLE</span><h2>People are at the<br/>heart of every<br/><em>great organization.</em></h2><span className="auth-feature-line"/></div><footer><span>Integrated Human Resource Services</span><span>RRFMG · Tuguegarao Branch</span></footer><span className="auth-feature-glyph" aria-hidden="true">R</span></aside>;

  return <main className="auth-page signin">
    <section className="auth-form-side">
      <div className="auth-brand"><Link href="/dashboard"><span>RRF HR <em>Nexus</em></span><small>Tuguegarao Branch</small></Link></div>
      <div className="auth-form-wrap"><span className="auth-overline">RRFMG · TUGUEGARAO</span><h1>Welcome back.</h1><p className="auth-support">Sign in to continue to HR Nexus.</p>
        <form className="auth-form" onSubmit={submit}>
          <label className="field"><span>Username</span><input type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)}/></label>
          <label className="field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}/></label>
          <button className="button primary auth-submit" type="submit" disabled={submitting || !authConfigured}>{submitting ? "Signing in…" : "Sign in"}<ArrowRight size={16}/></button>
          {message && <p className="auth-message" role="status">{message}</p>}
        </form>
        <p className="auth-stage-note">Authorized HR personnel only.</p>
      </div>
    </section>
    {brandPanel}
  </main>;
}
