"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const routeByRole = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const roles = (data ?? []).map((r) => (r as { role: string }).role);
    if (roles.includes("superadmin") || roles.includes("admin")) router.push("/admin");
    else if (roles.includes("agent")) router.push("/crm");
    else router.push("/");
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void routeByRole();
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (resetMode) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setResetSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await routeByRole();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-soft px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elevated">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-center text-2xl font-bold">
          {resetMode ? "Reset password" : "Admin sign in"}
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {resetMode
            ? "We'll email you a reset link."
            : "Access restricted to invited administrators."}
        </p>
        {resetSent ? (
          <div className="mt-6 rounded-md bg-secondary p-4 text-center text-sm">
            Check <strong>{email}</strong> for a password reset link.
            <button
              onClick={() => {
                setResetMode(false);
                setResetSent(false);
              }}
              className="mt-3 block w-full font-semibold text-[var(--electric)] hover:underline"
            >
              ← Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label>{resetMode ? "Email" : "Email or username"}</Label>
              <Input
                type={resetMode ? "email" : "text"}
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {!resetMode && (
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={busy}
            >
              {busy
                ? "Please wait..."
                : resetMode
                ? "Send reset link"
                : "Sign in"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setResetMode(!resetMode);
                setErr(null);
              }}
              className="block w-full text-center text-sm font-semibold text-[var(--electric)] hover:underline"
            >
              {resetMode ? "← Back to sign in" : "Forgot password?"}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:underline">
            ← Back to site
          </Link>
        </p>
      </div>
    </div>
  );
}
