"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { lineKey, MAX_LINE_QTY, type CartLine } from "@/domain/cart";
import { ProductPrice } from "@/components/catalog/product-price";
import { useCart } from "@/components/cart/cart-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { copyPtBr } from "@/lib/copy/pt-br";

const copy = copyPtBr.cart;
const iconButton =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius)] text-[var(--color-text)] transition-colors hover:text-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-40";
const actionButton =
  "inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius)] px-6 py-3 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50";

function QuantityInput({ line, name }: { line: CartLine; name: string }) {
  const { setQty } = useCart();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    setQty(lineKey(line), Number(draft));
    setDraft(null);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={MAX_LINE_QTY}
      aria-label={copy.quantity(name)}
      value={draft ?? line.qty}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
      className="min-h-11 w-14 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] bg-transparent text-center text-base text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
    />
  );
}

function CartLineItem({ line }: { line: CartLine }) {
  const { products, revalidation, setQty, remove, setOpen, config } = useCart();
  const product = products.get(line.productId);
  const unavailable = revalidation === "ok" && !product;
  const name = product?.name ?? (unavailable ? copy.unavailableName : copy.loadingProduct);
  const key = lineKey(line);

  return (
    <li className="flex gap-3 border-b border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] py-4">
      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-[var(--radius)] bg-[var(--color-surface)]">
        {product?.thumbUrl ? (
          <Image src={product.thumbUrl} alt="" fill sizes="64px" className="object-cover" />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {product ? (
          <Link
            href={`/produto/${product.slug}`}
            onClick={() => setOpen(false)}
            className="font-heading text-base leading-snug text-[var(--color-text)] hover:text-[var(--color-primary)]"
          >
            {name}
          </Link>
        ) : (
          <span className="font-heading text-base leading-snug text-[var(--color-text)]">{name}</span>
        )}
        {line.selections.length > 0 ? (
          <p className="text-sm text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
            {line.selections.map((s) => `${s.label}: ${s.value}`).join(" · ")}
          </p>
        ) : null}
        {unavailable ? (
          <p className="text-sm text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
            <strong className="font-medium">{copy.unavailable}.</strong> {copy.unavailableHint}
          </p>
        ) : product ? (
          <ProductPrice
            price={product.price}
            promoPrice={product.promoPrice}
            showPrices={config.showPrices}
            currency={config.currency}
          />
        ) : null}
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            className={iconButton}
            aria-label={copy.decrease(name)}
            disabled={line.qty <= 1}
            onClick={() => setQty(key, line.qty - 1)}
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <QuantityInput line={line} name={name} />
          <button
            type="button"
            className={iconButton}
            aria-label={copy.increase(name)}
            disabled={line.qty >= MAX_LINE_QTY}
            onClick={() => setQty(key, line.qty + 1)}
          >
            <Plus className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={`${iconButton} ml-auto`}
            aria-label={copy.remove(name)}
            onClick={() => remove(key)}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

const outcomeMessage = {
  no_number: copy.noNumber,
  revalidation_failed: null, // o aviso de revalidação já aparece com o botão de tentar de novo
  nothing_to_send: copy.nothingToSend,
  too_long: copy.tooLong,
} as const;

export function CartDrawer() {
  const { open, setOpen, lines, revalidation, revalidate, hasNumber, persisted, sent, clear, send } = useCart();
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setNotice(null);
    setSending(true);
    const outcome = await send(null, null);
    setSending(false);
    if (outcome !== "sent") setNotice(outcomeMessage[outcome]);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setNotice(null);
      }}
    >
      <DialogContent className="left-auto right-0 top-0 h-dvh max-h-dvh w-[min(100vw,26rem)] translate-x-0 translate-y-0 rounded-none border-y-0 border-r-0">
        <div className="flex h-dvh flex-col">
          <div className="flex flex-col gap-1 px-4 pb-3 pt-4 pr-16">
            <DialogTitle className="font-heading text-2xl font-medium text-[var(--color-text)]">
              {copy.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
              {copy.description}
            </DialogDescription>
          </div>

          <div className="flex-1 overflow-y-auto px-4">
            {lines.length === 0 ? (
              <p className="py-8 text-sm text-[var(--color-text)]">{copy.empty}</p>
            ) : (
              <ul aria-label={copy.lines} className="list-none p-0">
                {lines.map((line) => (
                  <CartLineItem key={lineKey(line)} line={line} />
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] px-4 py-4 text-sm text-[var(--color-text)]">
            {revalidation === "loading" ? <p role="status">{copy.revalidating}</p> : null}
            {revalidation === "failed" ? (
              <div role="alert" className="flex flex-col gap-2">
                <p>{copy.revalidationFailed}</p>
                <button
                  type="button"
                  onClick={() => void revalidate()}
                  className={`${actionButton} border border-[var(--color-primary)] text-[var(--color-primary)]`}
                >
                  {copy.retry}
                </button>
              </div>
            ) : null}
            {!hasNumber ? <p role="status">{copy.noNumber}</p> : null}
            {!persisted ? <p role="status">{copy.storageFailed}</p> : null}
            {notice ? <p role="alert">{notice}</p> : null}
            {sent ? <p role="status">{copy.afterSend}</p> : null}

            <button
              type="button"
              disabled={lines.length === 0 || !hasNumber || revalidation !== "ok" || sending}
              onClick={() => void handleSend()}
              className={`${actionButton} bg-[var(--color-primary)] text-[var(--color-on-primary)]`}
            >
              {copy.send}
            </button>
            {sent ? (
              <button
                type="button"
                onClick={clear}
                className={`${actionButton} border border-[var(--color-primary)] text-[var(--color-primary)]`}
              >
                {copy.clear}
              </button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
