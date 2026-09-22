"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabase } from "@/lib/auth/browser";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

export function AdminPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createBrowserSupabase();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setSubmitting(false);

    if (updateError) {
      setError(copyAdminPtBr.password.errorGeneric);
      return;
    }

    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="space-y-4 text-center text-sm text-muted-foreground">
        <p>{copyAdminPtBr.password.success}</p>
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
        <Label htmlFor="admin-new-password">{copyAdminPtBr.password.password}</Label>
        <Input
          id="admin-new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={submitting}>
        {copyAdminPtBr.password.update}
      </Button>
    </form>
  );
}
