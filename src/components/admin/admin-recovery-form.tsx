"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabase } from "@/lib/auth/browser";
import { getSiteUrl } from "@/config/site";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

export function AdminRecoveryForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createBrowserSupabase();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${getSiteUrl()}/admin/atualizar-senha`,
      },
    );

    setSubmitting(false);

    if (resetError) {
      setError(copyAdminPtBr.recovery.errorGeneric);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center text-sm text-muted-foreground">
        <p>{copyAdminPtBr.recovery.sent}</p>
        <Link
          href="/admin/login"
          className="text-foreground underline-offset-4 hover:underline"
        >
          {copyAdminPtBr.recovery.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      <div className="space-y-2">
        <Label htmlFor="admin-recovery-email">{copyAdminPtBr.recovery.email}</Label>
        <Input
          id="admin-recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={submitting}>
        {copyAdminPtBr.recovery.submit}
      </Button>
      <p className="text-center text-sm">
        <Link
          href="/admin/login"
          className="text-foreground underline-offset-4 hover:underline"
        >
          {copyAdminPtBr.recovery.backToLogin}
        </Link>
      </p>
    </form>
  );
}
