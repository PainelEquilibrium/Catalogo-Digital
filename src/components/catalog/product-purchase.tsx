"use client";

import { useId, useState } from "react";
import {
  initialSelections,
  missingChoices,
  toSelections,
  type CustomerChoice,
  type Selection,
} from "@/domain/customer-choices";
import { useCart, type SendOutcome } from "@/components/cart/cart-provider";
import { copyPtBr } from "@/lib/copy/pt-br";

const copy = copyPtBr.cart;
const buttonBase =
  "inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius)] px-6 py-3 text-center text-sm font-medium transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";

const failureText: Record<Exclude<SendOutcome, "sent">, string> = {
  no_number: copy.noNumber,
  revalidation_failed: copy.revalidationFailed,
  nothing_to_send: copy.unavailableHint,
  too_long: copy.tooLong,
  error: copy.sendError,
};

type ProductPurchaseProps = {
  product: { id: string; slug: string };
  choices: CustomerChoice[];
};

export function ProductPurchase({ product, choices }: ProductPurchaseProps) {
  const { add, send, hasNumber, persisted } = useCart();
  const groupId = useId();
  const [selected, setSelected] = useState(() => initialSelections(choices));
  const [status, setStatus] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Confere as escolhas antes de montar as seleções: toSelections descartaria valor ausente em silêncio. */
  function validSelections(): Selection[] | null {
    setStatus(null);
    const missing = missingChoices(choices, selected);
    if (missing.length > 0) {
      setWarning(copy.missingChoices(missing.map((choice) => choice.label)));
      return null;
    }
    setWarning(null);
    return toSelections(choices, selected);
  }

  function handleAdd() {
    const selections = validSelections();
    if (!selections) return;
    const result = add(product.id, selections);
    if (result === "cart_full") setWarning(copy.cartFull);
    else if (result === "qty_capped") setWarning(copy.qtyCapped);
    else setStatus(result === "merged" ? copy.merged : copy.added);
  }

  async function handleBuy() {
    const selections = validSelections();
    if (!selections) return;
    setBusy(true);
    const outcome = await send([{ productId: product.id, selections, qty: 1 }], product.slug);
    setBusy(false);
    if (outcome !== "sent") setWarning(failureText[outcome]);
  }

  return (
    <div className="flex flex-col gap-5">
      {choices.map((choice) => (
        <fieldset key={choice.key} className="flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-sm font-medium text-[color-mix(in_srgb,var(--color-text)_65%,transparent)]">
            {choice.label}
          </legend>
          <div className="flex flex-wrap gap-2">
            {choice.options.map((option) => (
              <label key={option} className="cursor-pointer">
                <input
                  type="radio"
                  name={`${groupId}-${choice.key}`}
                  value={option}
                  checked={selected[choice.key] === option}
                  onChange={() => {
                    setSelected((current) => ({ ...current, [choice.key]: option }));
                    setWarning(null);
                  }}
                  className="peer sr-only"
                />
                <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--color-text)_25%,transparent)] px-4 text-sm text-[var(--color-text)] transition-colors peer-checked:border-[var(--color-primary)] peer-checked:bg-[var(--color-primary)] peer-checked:text-[var(--color-on-primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-accent)]">
                  {option}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={handleAdd}
          className={`${buttonBase} border border-[var(--color-primary)] text-[var(--color-primary)]`}
        >
          {copy.add}
        </button>
        <button
          type="button"
          onClick={() => void handleBuy()}
          disabled={!hasNumber || busy}
          className={`${buttonBase} bg-[var(--color-primary)] text-[var(--color-on-primary)]`}
        >
          {copyPtBr.whatsapp.ctaLabel}
        </button>
      </div>

      <div className="flex flex-col gap-1 text-sm text-[var(--color-text)]">
        <p role="status">{status}</p>
        {warning ? <p role="alert">{warning}</p> : null}
        {!hasNumber ? <p role="status">{copy.noNumber}</p> : null}
        {!persisted ? <p role="status">{copy.storageFailed}</p> : null}
      </div>
    </div>
  );
}
