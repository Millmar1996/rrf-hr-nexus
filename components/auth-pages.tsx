"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";

export function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  const signingUp = mode === "signup";
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signingUp && password !== confirmPassword) { setMessage("Passwords do not match."); return; }
    setMessage("Authentication will be configured in Stage 2. This demo workspace remains available without sign-in.");
  }
  const brandPanel = <aside className="auth-feature"><span className="auth-feature-top">RRF HR NEXUS <i/> TUGUEGARAO</span><div className="auth-feature-message"><span className="auth-index">01 / PEOPLE</span><h2>{signingUp ? <>A stronger<br/>workplace starts<br/><em>with people.</em></> : <>People are at the<br/>heart of every<br/><em>great organization.</em></>}</h2><span className="auth-feature-line"/></div><footer><span>Integrated Human Resource Services</span><span>RRFMG · Tuguegarao Branch</span></footer><span className="auth-feature-glyph" aria-hidden="true">R</span></aside>;

  return <main className={"auth-page " + mode}>
    {signingUp && brandPanel}
    <section className="auth-form-side">
      <div className="auth-brand"><Link href="/dashboard"><span>RRF HR <em>Nexus</em></span><small>Tuguegarao Branch</small></Link></div>
      <div className="auth-form-wrap"><span className="auth-overline">{signingUp ? "WORKSPACE ACCESS" : "RRFMG · TUGUEGARAO"}</span><h1>{signingUp ? "Create account" : "Welcome back."}</h1><p className="auth-support">{signingUp ? "Request access to the HR Nexus workspace." : "Sign in to continue to HR Nexus."}</p>
        <form className="auth-form" onSubmit={submit}>
          {signingUp && <div className="auth-name-fields"><label className="field"><span>First name</span><input autoComplete="given-name" required/></label><label className="field"><span>Last name</span><input autoComplete="family-name" required/></label></div>}
          <label className="field"><span>Work email</span><input type="email" autoComplete="email" placeholder="name@company.com" required/></label>
          <label className="field"><span>Password</span><input type="password" autoComplete={signingUp ? "new-password" : "current-password"} value={password} onChange={(event)=>setPassword(event.target.value)} required minLength={8}/></label>
          {signingUp && <label className="field"><span>Confirm password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event)=>setConfirmPassword(event.target.value)} required minLength={8}/></label>}
          {!signingUp && <button className="auth-forgot" type="button" onClick={()=>setMessage("Password recovery will be available when authentication is configured.")}>Forgot password?</button>}
          <button className="button primary auth-submit" type="submit">{signingUp ? "Create account" : "Sign in"}<ArrowRight size={16}/></button>
          {message && <p className="auth-message" role="status">{message}</p>}
        </form>
        <p className="auth-switch">{signingUp ? "Already have access?" : "Don’t have an account?"} <Link href={signingUp ? "/signin" : "/signup"}>{signingUp ? "Sign in" : "Create account"} <ArrowUpRight size={13}/></Link></p>
        <p className="auth-stage-note">Stage 1 preview · Authentication is not enabled</p>
      </div>
    </section>
    {!signingUp && brandPanel}
  </main>;
}
