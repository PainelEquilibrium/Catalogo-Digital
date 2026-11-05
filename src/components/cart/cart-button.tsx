"use client";

import { ShoppingBag } from "lucide-react";
import { copyPtBr } from "@/lib/copy/pt-br";
import { useCart } from "@/components/cart/cart-provider";

export function CartButton() {
  const { lines, setOpen } = useCart();
  const count = lines.length;

  return (
    <button
      type="button"
      aria-label={count > 0 ? copyPtBr.cart.openWithLines(count) : copyPtBr.cart.open}
      aria-haspopup="dialog"
      onClick={() => setOpen(true)}
      className="relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--radius)] text-[var(--color-text)] transition-colors hover:text-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
    >
      <ShoppingBag className="size-5" aria-hidden />
      {count > 0 ? (
        <span
          aria-hidden
          className="absolute right-0.5 top-1 flex min-w-4 items-center justify-center rounded-full bg-[var(--color-primary)] px-1 text-[0.65rem] font-medium leading-4 text-[var(--color-on-primary)]"
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
