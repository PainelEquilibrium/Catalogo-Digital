"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { changeOwnPassword } from "@/app/admin/(public)/atualizar-senha/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

export function AdminPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    let result: Awaited<ReturnType<typeof changeOwnPassword>>;
    try {
      result = await changeOwnPassword({ password, confirmation });
    } catch {
      result = { ok: false, message: copyAdminPtBr.password.errorGeneric };
    }

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    router.push("/admin/produtos");
    router.refresh();
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
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-confirm-password">{copyAdminPtBr.password.confirmation}</Label>
        <Input
          id="admin-confirm-password"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
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
