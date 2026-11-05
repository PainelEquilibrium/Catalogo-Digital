"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import {
  restoreSettingsSection,
  saveSettingsSection,
} from "@/app/admin/(panel)/configuracoes/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { SettingsSection } from "@/domain/settings-sections";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

const copy = copyAdminPtBr.settings;

type SectionCardProps<T extends FieldValues> = {
  section: SettingsSection;
  form: UseFormReturn<T>;
  // Pede confirmação antes de salvar quando `when` for verdadeiro.
  confirm?: { when: (values: T) => boolean; title: string; description: string; action: string };
  children: React.ReactNode;
};

export function SectionCard<T extends FieldValues>({ section, form, confirm, children }: SectionCardProps<T>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<T | null>(null);

  async function run(task: () => ReturnType<typeof saveSettingsSection>, success: string) {
    setBusy(true);
    setPending(null);
    let result: Awaited<ReturnType<typeof task>>;
    try {
      result = await task();
    } catch {
      result = { ok: false, message: copy.errorGeneric };
    }
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(success);
    router.refresh();
  }

  const save = (values: T) => run(() => saveSettingsSection(section, values), copy.saved);

  return (
    <section aria-labelledby={`settings-${section}`} className="space-y-4 rounded-lg border border-border p-4">
      <h2 id={`settings-${section}`} className="text-lg font-semibold">
        {copy.sectionLabels[section]}
      </h2>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => (confirm?.when(values) ? setPending(values) : void save(values)))}
      >
        {children}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {copy.save}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void run(() => restoreSettingsSection(section), copy.restored)}
          >
            {copy.restore}
          </Button>
        </div>
      </form>
      {confirm ? (
        <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={(event) => {
                  event.preventDefault();
                  if (pending) void save(pending);
                }}
              >
                {confirm.action}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </section>
  );
}
