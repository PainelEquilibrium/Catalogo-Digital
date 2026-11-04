"use client";

import { useState } from "react";
import Image from "next/image";
import { ZoomIn } from "lucide-react";
import { Title as DialogTitle } from "@radix-ui/react-dialog";
import type { ProductGalleryImage } from "@/domain/product";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import PolaroidLineCarousel from "@/components/ui/polaroid-line-carousel";
import { copyPtBr } from "@/lib/copy/pt-br";

const FALLBACK_DETAIL_SRC = "https://placehold.co/1200x1600/png?text=Produto";

type ProductGalleryProps = {
  images: ProductGalleryImage[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const current = images[index] ?? images[0];
  const src = current?.detailUrl || FALLBACK_DETAIL_SRC;
  const slides = images.length ? images.map((image, i) => ({
    image: image.detailUrl || FALLBACK_DETAIL_SRC,
    alt: `${productName} — ${copyPtBr.gallery.photo(i + 1)}`,
    width: image.width ?? 1200,
    height: image.height ?? 1600,
  })) : [{ image: FALLBACK_DETAIL_SRC, alt: productName }];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <PolaroidLineCarousel slides={slides} onChange={setIndex} suspended={open} ariaLabel={copyPtBr.gallery.label}>
        <DialogTrigger asChild>
          <button type="button" aria-label={copyPtBr.gallery.enlarge}>
            <ZoomIn aria-hidden="true" />
          </button>
        </DialogTrigger>
      </PolaroidLineCarousel>
      <DialogContent aria-describedby={undefined} className="border-0 bg-[var(--color-background)] p-0 shadow-none">
        <DialogTitle className="sr-only">{productName}</DialogTitle>
        <div className="relative h-[min(80svh,56rem)] w-full">
          <Image src={src} alt={productName} fill className="object-contain" sizes="(max-width: 672px) calc(100vw - 32px), 672px" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
