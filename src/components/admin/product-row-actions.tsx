"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { trashProduct } from "@/app/admin/(panel)/produtos/actions";
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

const copy = copyAdminPtBr.products;

type ProductRowActionsProps = {
  productId: string;
};

export function ProductRowActions({ productId }: ProductRowActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleTrash() {
    setBusy(true);
    setActionError(null);
    const result = await trashProduct(productId);
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
        <Link href={`/admin/produtos/${productId}`}>{copy.edit}</Link>
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
