"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

const copy = copyAdminPtBr.people;

// A senha vive só no estado do pai; ao fechar vira null e não existe mais no cliente.
export function TempPasswordDialog({
  password,
  onClose,
}: {
  password: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <AlertDialog open={password !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.tempTitle}</AlertDialogTitle>
          <AlertDialogDescription>{copy.tempDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <code
          data-testid="temp-password"
          className="block break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm"
        >
          {password}
        </code>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(password ?? "").then(() => setCopied(true));
            }}
          >
            {copied ? copy.tempCopied : copy.tempCopy}
          </Button>
          <AlertDialogAction onClick={() => setCopied(false)}>{copy.tempClose}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
