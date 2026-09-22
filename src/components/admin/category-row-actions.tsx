"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  duplicateCategory,
  trashCategory,
} from "@/app/admin/(panel)/categorias/actions";
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

const copy = copyAdminPtBr.categories;

type CategoryRowActionsProps = {
  categoryId: string;
};

export function CategoryRowActions({ categoryId }: CategoryRowActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDuplicate() {
    setBusy(true);
    setActionError(null);
    const result = await duplicateCategory(categoryId);
    setBusy(false);

    if (!result.ok) {
      setActionError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success(copy.duplicated);
    router.push(`/admin/categorias/${result.id}`);
    router.refresh();
  }

  async function handleTrash() {
    setBusy(true);
    setActionError(null);
    const result = await trashCategory(categoryId);
    setBusy(false);
    setTrashOpen(false);

    if (!result.ok) {
      setActionError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success(copy.trashed);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/admin/categorias/${categoryId}`}>{copy.edit}</Link>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void handleDuplicate()}
      >
        {copy.duplicate}
      </Button>
      <AlertDialog open={trashOpen} onOpenChange={setTrashOpen}>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" size="sm" disabled={busy}>
            {copy.trash}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.trashConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.trashConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError ? (
            <p className="text-sm text-destructive" role="alert">
              {actionError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void handleTrash();
              }}
            >
              {copy.trashConfirmAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
