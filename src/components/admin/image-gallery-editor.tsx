"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addProductImage,
  removeProductImage,
  reorderProductImages,
} from "@/app/admin/(panel)/produtos/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { MAX_UPLOAD_BYTES, messageForUploadError } from "@/lib/images/upload-errors";
import { toast } from "sonner";

const copy = copyAdminPtBr.upload;

export type GalleryImageRow = {
  id: string;
  thumbUrl: string;
  sortOrder: number;
};

type ImageGalleryEditorProps = {
  productId: string | null;
  images: GalleryImageRow[];
};

export function ImageGalleryEditor({
  productId,
  images: initialImages,
}: ImageGalleryEditorProps) {
  const router = useRouter();
  const [images, setImages] = useState(initialImages);
  const [busy, setBusy] = useState(false);

  async function refreshFromServer() {
    router.refresh();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !productId) {
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(messageForUploadError("too_large"));
      return;
    }

    setBusy(true);
    const formData = new FormData();
    formData.set("file", file);
    let result;
    try {
      result = await addProductImage(productId, formData);
    } catch {
      toast.error(copy.errorGeneric);
      return;
    } finally {
      setBusy(false);
    }

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(copy.photoAdded);
    await refreshFromServer();
  }

  async function move(imageId: string, direction: "up" | "down") {
    if (!productId) {
      return;
    }

    const index = images.findIndex((row) => row.id === imageId);
    if (index < 0) {
      return;
    }

    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= images.length) {
      return;
    }

    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    const orderedIds = next.map((row) => row.id);

    setBusy(true);
    let result;
    try {
      result = await reorderProductImages(productId, orderedIds);
    } catch {
      toast.error(copy.errorGeneric);
      return;
    } finally {
      setBusy(false);
    }

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setImages(next.map((row, sortOrder) => ({ ...row, sortOrder })));
    await refreshFromServer();
  }

  async function remove(imageId: string) {
    setBusy(true);
    let result;
    try {
      result = await removeProductImage(imageId);
    } catch {
      toast.error(copy.errorGeneric);
      return;
    } finally {
      setBusy(false);
    }

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setImages((current) => current.filter((row) => row.id !== imageId));
    if (result.cleanupPending) toast.warning(copy.photoCleanupPending);
    await refreshFromServer();
  }

  if (!productId) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-medium">{copy.galleryTitle}</h2>
        <p className="text-sm text-muted-foreground">{copy.saveDraftFirst}</p>
      </div>
    );
  }

  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-medium">{copy.galleryTitle}</h2>
        <Label htmlFor="product-gallery-file" className="sr-only">
          {copy.addPhoto}
        </Label>
        <input
          id="product-gallery-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium"
          disabled={busy}
          onChange={(event) => void handleFileChange(event)}
        />
      </div>

      {sorted.length > 0 ? (
        <ul className="space-y-3">
          {sorted.map((image, index) => (
            <li
              key={image.id}
              className="flex flex-wrap items-center gap-3 rounded-md border p-3"
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
                <Image
                  src={image.thumbUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="64px"
                  unoptimized
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  disabled={busy || index === 0}
                  onClick={() => void move(image.id, "up")}
                >
                  {copy.moveUp}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  disabled={busy || index === sorted.length - 1}
                  onClick={() => void move(image.id, "down")}
                >
                  {copy.moveDown}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="min-h-11"
                  disabled={busy}
                  onClick={() => void remove(image.id)}
                >
                  {copy.removePhoto}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
