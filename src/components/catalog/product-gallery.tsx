"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import type { ProductGalleryImage } from "@/domain/product";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

const FALLBACK_DETAIL_SRC =
  "https://placehold.co/1200x1600/png?text=Produto";

type ProductGalleryProps = {
  images: ProductGalleryImage[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);
  const hasMultiple = images.length > 1;
  const current = images[index] ?? images[0];

  const goPrev = useCallback(() => {
    if (!hasMultiple) return;
    setIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [hasMultiple, images.length]);

  const goNext = useCallback(() => {
    if (!hasMultiple) return;
    setIndex((prev) => (prev + 1) % images.length);
  }, [hasMultiple, images.length]);

  if (!current) {
    return (
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[var(--radius)] bg-[var(--color-surface)]">
        <Image
          src={FALLBACK_DETAIL_SRC}
          alt={productName}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
          priority
        />
      </div>
    );
  }

  const width = current.width ?? 1200;
  const height = current.height ?? 1600;
  const src = current.detailUrl || FALLBACK_DETAIL_SRC;

  return (
    <div className="flex flex-col gap-3">
      <Dialog>
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[var(--radius)] bg-[var(--color-surface)]">
          <Image
            src={src}
            alt={productName}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
          <DialogTrigger asChild>
            <button
              type="button"
              className="absolute bottom-3 right-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--color-background)_88%,transparent)] text-[var(--color-text)] shadow-sm backdrop-blur-sm transition-colors hover:bg-[var(--color-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              aria-label="Ampliar imagem"
            >
              <ZoomIn className="size-5" aria-hidden />
            </button>
          </DialogTrigger>
          {hasMultiple ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--color-background)_88%,transparent)] text-[var(--color-text)] shadow-sm backdrop-blur-sm transition-colors hover:bg-[var(--color-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--color-background)_88%,transparent)] text-[var(--color-text)] shadow-sm backdrop-blur-sm transition-colors hover:bg-[var(--color-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                aria-label="Próxima imagem"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </>
          ) : null}
        </div>
        <DialogContent className="border-0 bg-transparent p-0 shadow-none">
          <div className="relative aspect-[3/4] w-full max-h-[85vh] overflow-hidden rounded-[var(--radius)] bg-[var(--color-surface)]">
            <Image
              src={src}
              alt={productName}
              width={width}
              height={height}
              className="h-full w-full object-contain"
              sizes="90vw"
            />
          </div>
        </DialogContent>
      </Dialog>
      {hasMultiple ? (
        <p className="text-center text-sm text-[color-mix(in_srgb,var(--color-text)_65%,transparent)]">
          {index + 1} / {images.length}
        </p>
      ) : null}
    </div>
  );
}
