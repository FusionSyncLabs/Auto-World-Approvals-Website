"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) return setErr("Password must be at least 8 characters.");
    if (password !== confirm) return setErr("Passwords do not match.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/admin");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-soft px-4 py-6 sm:py-10">
      <div className="min-w-0 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-elevated sm:p-8">
        <div className="mb-6 flex min-w-0 justify-center [&_a]:max-w-full [&_img]:max-w-full">
          <Logo />
        </div>
        <h1 className="text-center text-2xl font-bold">Set a new password</h1>
        {!ready ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Validating reset link…
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="reset-password">New password</Label>
              <Input
                id="reset-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reset-confirm">Confirm password</Label>
              <Input
                id="reset-confirm"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {err && <p role="alert" className="text-sm text-destructive [overflow-wrap:anywhere]">{err}</p>}
            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="h-auto min-h-12 w-full px-4 py-3"
              disabled={busy}
            >
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/auth" className="inline-flex min-h-11 items-center justify-center hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
