"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  purgeTrashedCategory,
  purgeTrashedProduct,
  restoreCategory,
  restoreProduct,
} from "@/app/admin/(panel)/lixeira/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { toast } from "sonner";

const copy = copyAdminPtBr.trash;

type TrashRestoreButtonProps = {
  kind: "product" | "category";
  itemId: string;
  canPurge?: boolean;
};

export function TrashRestoreButton({ kind, itemId, canPurge = false }: TrashRestoreButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);

  async function handleRestore() {
    setBusy(true);
    const result =
      kind === "product"
        ? await restoreProduct(itemId)
        : await restoreCategory(itemId);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(
      kind === "product" ? copy.restoredProduct : copy.restoredCategory,
    );
    router.refresh();
  }

  async function handlePurge() {
    setBusy(true);
    let result: { ok: true } | { ok: false; message: string };
    try {
      result =
        kind === "product"
          ? await purgeTrashedProduct(itemId)
          : await purgeTrashedCategory(itemId);
    } catch {
      result = { ok: false, message: copy.errorGeneric };
    }
    setBusy(false);
    setPurgeOpen(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(
      kind === "product" ? copy.purgedProduct : copy.purgedCategory,
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        disabled={busy}
        onClick={() => {
          void handleRestore();
        }}
      >
        {copy.restore}
      </Button>
      {canPurge ? (
        <AlertDialog open={purgeOpen} onOpenChange={setPurgeOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" size="sm" className="min-h-11" disabled={busy}>
              {copy.purge}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{copy.purgeConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{copy.purgeConfirmDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={(event) => {
                  event.preventDefault();
                  void handlePurge();
                }}
              >
                {copy.purge}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
