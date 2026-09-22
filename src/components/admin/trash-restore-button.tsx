"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  restoreCategory,
  restoreProduct,
} from "@/app/admin/(panel)/lixeira/actions";
import { Button } from "@/components/ui/button";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { toast } from "sonner";

const copy = copyAdminPtBr.trash;

type TrashRestoreButtonProps = {
  kind: "product" | "category";
  itemId: string;
};

export function TrashRestoreButton({ kind, itemId }: TrashRestoreButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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

  return (
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
  );
}
