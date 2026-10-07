"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const authNotices: Record<string, string> = {
  access_pending: "Your account is awaiting an active HR Nexus profile. Contact the workspace administrator.",
  confirmation_failed: "That confirmation link is invalid or expired. Request a new signup link.",
  email_confirmed: "Email confirmed. Your access request is recorded and awaits administrator approval.",
  signed_out: "You have been signed out.",
  signin_required: "Sign in with an active HR Nexus account to continue.",
  temporarily_unavailable: "Access could not be verified. Try again in a moment.",
};

export function AuthPage({ mode, notice, authConfigured }: { mode: "signin" | "signup" | "update"; notice?: string; authConfigured: boolean }) {
  const signingUp = mode === "signup";
  const updatingPassword = mode === "update";
  const router = useRouter();
  const [message, setMessage] = useState(notice ? authNotices[notice] || "" : authConfigured ? "" : "Authentication is not configured in this deployment. The local fictional demo remains available.");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [submitting, setSubmitting] = useState(false);


  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((signingUp || updatingPassword) && password !== confirmPassword) { setMessage("Passwords do not match."); return; }
    setSubmitting(true);
    setMessage("");
    try {
      const supabase = createClient();
      if (updatingPassword) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword(""); setConfirmPassword(""); setMessage("Password updated. You can continue to HR Nexus.");
        router.replace("/dashboard"); router.refresh();
      } else if (signingUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
          },
        });
        if (error) throw error;
        if (data.session) await supabase.auth.signOut();
        setPassword("");
        setConfirmPassword("");
        setMessage("Check your email to confirm your access request. An administrator will review it before workspace access is granted.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_active")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profileError) {
          await supabase.auth.signOut();
          throw new Error("Access could not be verified. Try again in a moment.");
        }
        if (!profile?.is_active) {
          await supabase.auth.signOut();
          setPassword("");
          setMessage("Your account is awaiting an active HR Nexus profile. Contact the workspace administrator.");
          return;
        }
        router.replace("/dashboard");
        router.refresh();
      }
    } catch {
      setMessage("Could not complete authentication. Check your details and try again, or contact the workspace administrator.");
    } finally {
      setSubmitting(false);
    }
  }
  async function requestPasswordReset() {
    if (!email.trim()) { setMessage("Enter your work email first."); return; }
    setSubmitting(true); setMessage("");
    try { const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/confirm?next=%2Fauth%2Fupdate-password` }); if (error) throw error; setRecovering(true); setMessage("If an account exists for that address, a password reset link has been sent."); }
    catch { setMessage("Unable to request a password reset right now. Try again shortly."); }
    finally { setSubmitting(false); }
  }
  const brandPanel = <aside className="auth-feature"><span className="auth-feature-top">RRF HR NEXUS <i/> TUGUEGARAO</span><div className="auth-feature-message"><span className="auth-index">01 / PEOPLE</span><h2>{signingUp ? <>A stronger<br/>workplace starts<br/><em>with people.</em></> : <>People are at the<br/>heart of every<br/><em>great organization.</em></>}</h2><span className="auth-feature-line"/></div><footer><span>Integrated Human Resource Services</span><span>RRFMG · Tuguegarao Branch</span></footer><span className="auth-feature-glyph" aria-hidden="true">R</span></aside>;

  return <main className={"auth-page " + mode}>
    {signingUp && brandPanel}
    <section className="auth-form-side">
      <div className="auth-brand"><Link href="/dashboard"><span>RRF HR <em>Nexus</em></span><small>Tuguegarao Branch</small></Link></div>
      <div className="auth-form-wrap"><span className="auth-overline">{signingUp ? "WORKSPACE ACCESS" : "RRFMG · TUGUEGARAO"}</span><h1>{updatingPassword?"Choose a new password.":signingUp ? "Create account" : recovering?"Check your email.":"Welcome back."}</h1><p className="auth-support">{updatingPassword?"Set a new password for your HR Nexus account.":signingUp ? "Request access to the HR Nexus workspace." : "Sign in to continue to HR Nexus."}</p>
        <form className="auth-form" onSubmit={submit}>
          {signingUp && <label className="field"><span>Full name</span><input autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required/></label>}
          {!updatingPassword&&<label className="field"><span>Work email</span><input type="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required/></label>}
          <label className="field"><span>{updatingPassword?"New password":"Password"}</span><input type="password" autoComplete={signingUp||updatingPassword ? "new-password" : "current-password"} value={password} onChange={(event)=>setPassword(event.target.value)} required minLength={8}/></label>
          {(signingUp||updatingPassword) && <label className="field"><span>Confirm password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event)=>setConfirmPassword(event.target.value)} required minLength={8}/></label>}
          {!signingUp&&!updatingPassword&&<button className="auth-forgot" type="button" disabled={submitting} onClick={()=>void requestPasswordReset()}>Forgot password?</button>}
          <button className="button primary auth-submit" type="submit" disabled={submitting || !authConfigured}>{submitting ? "Please wait…" : updatingPassword?"Update password":signingUp ? "Request access" : "Sign in"}<ArrowRight size={16}/></button>
          {message && <p className="auth-message" role="status">{message}</p>}
        </form>
        <p className="auth-switch">{signingUp ? "Already have access?" : "Don’t have an account?"} <Link href={signingUp ? "/signin" : "/signup"}>{signingUp ? "Sign in" : "Create account"} <ArrowUpRight size={13}/></Link></p>
        <p className="auth-stage-note">Access requires an active profile provisioned by an administrator.</p>
      </div>
    </section>
    {!signingUp && brandPanel}
  </main>;
}
