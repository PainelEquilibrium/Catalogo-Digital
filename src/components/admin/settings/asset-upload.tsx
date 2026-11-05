"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { saveStoreAsset } from "@/app/admin/(panel)/configuracoes/actions";
import { Label } from "@/components/ui/label";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

const copy = copyAdminPtBr.settings;

type Kind = Parameters<typeof saveStoreAsset>[0];

// Envia na hora (não depende do botão Salvar da seção); o texto digitado continua intacto.
export function AssetUpload({ kind, label, src, dark }: { kind: Kind; label: string; src: string; dark?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(src);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    setBusy(true);
    let result: Awaited<ReturnType<typeof saveStoreAsset>>;
    try {
      result = await saveStoreAsset(kind, formData);
    } catch {
      result = { ok: false, message: copy.errorGeneric };
    }
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setShown(result.url);
    toast.success(copy.assetSaved);
    router.refresh();
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className={`relative h-24 w-48 overflow-hidden rounded-md border border-border ${dark ? "bg-neutral-800" : "bg-muted"}`}>
        <Image src={shown} alt="" fill unoptimized className="object-contain p-2" sizes="192px" />
      </div>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium"
        onChange={(event) => void onChange(event)}
      />
      <p className="text-sm text-muted-foreground">{busy ? copy.assetUploading : copy.assetHint}</p>
    </div>
  );
}
