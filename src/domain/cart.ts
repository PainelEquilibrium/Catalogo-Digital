import { z } from "zod";
import type { Selection } from "./customer-choices";

export const MAX_CART_LINES = 20;
export const MAX_LINE_QTY = 10;
export const CART_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CART_STORAGE_VERSION = 1;

// localStorage e entrada não confiável: dado maior que isto é descartado sem parsear.
const MAX_STORED_CHARS = 64 * 1024;

export type CartLine = { productId: string; selections: Selection[]; qty: number };
export type CartState = { lines: CartLine[]; updatedAt: number };
export type AddResult = "added" | "merged" | "cart_full" | "qty_capped";

/** Pares ordenados em JSON: ordem das escolhas e rótulo não entram; separadores nos valores não colidem. */
export function lineKey(line: Pick<CartLine, "productId" | "selections">): string {
  const pairs = line.selections.map((s) => JSON.stringify([s.key, s.value])).sort();
  return JSON.stringify([line.productId, pairs]);
}

function clampQty(n: number): number {
  return Number.isNaN(n) ? 1 : Math.min(MAX_LINE_QTY, Math.max(1, Math.floor(n)));
}

export function addLine(
  state: CartState,
  line: CartLine,
  now: number,
): { state: CartState; result: AddResult } {
  const requested = Number.isNaN(line.qty) ? 1 : Math.max(1, Math.floor(line.qty));
  const key = lineKey(line);
  const index = state.lines.findIndex((l) => lineKey(l) === key);

  if (index === -1) {
    if (state.lines.length >= MAX_CART_LINES) return { state, result: "cart_full" };
    const next = { ...line, qty: Math.min(requested, MAX_LINE_QTY) };
    return {
      state: { lines: [...state.lines, next], updatedAt: now },
      result: requested > MAX_LINE_QTY ? "qty_capped" : "added",
    };
  }

  const existing = state.lines[index];
  const total = existing.qty + requested;
  const qty = Math.min(total, MAX_LINE_QTY);
  const result = total > MAX_LINE_QTY ? "qty_capped" : "merged";
  if (qty === existing.qty) return { state, result };

  return {
    state: {
      lines: state.lines.map((l, i) => (i === index ? { ...l, qty } : l)),
      updatedAt: now,
    },
    result,
  };
}

/** Sem mudança real (chave inexistente ou mesma quantidade) devolve o mesmo estado e não renova updatedAt. */
export function setLineQty(state: CartState, key: string, qty: number, now: number): CartState {
  const next = clampQty(qty);
  const index = state.lines.findIndex((l) => lineKey(l) === key);
  if (index === -1 || state.lines[index].qty === next) return state;

  return {
    lines: state.lines.map((l, i) => (i === index ? { ...l, qty: next } : l)),
    updatedAt: now,
  };
}

export function removeLine(state: CartState, key: string, now: number): CartState {
  if (!state.lines.some((l) => lineKey(l) === key)) return state;
  return { lines: state.lines.filter((l) => lineKey(l) !== key), updatedAt: now };
}

const selectionSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().max(200),
  value: z.string().max(200),
});
const storedLineSchema = z.object({
  productId: z.uuid(),
  selections: z.array(selectionSchema).max(50),
  qty: z.number(),
});
const storedCartSchema = z.object({
  version: z.literal(CART_STORAGE_VERSION),
  updatedAt: z.number(),
  lines: z.array(z.unknown()),
});

/**
 * Lê o carrinho salvo. Tudo que não bate com o formato vira descarte ou corte,
 * nunca exceção. updatedAt no futuro (relógio alterado ou dado adulterado) descarta
 * o carrinho: senão ele nunca expiraria.
 */
export function parseStoredCart(raw: string | null, now: number): CartState {
  const empty: CartState = { lines: [], updatedAt: now };
  if (raw === null || raw.length > MAX_STORED_CHARS) return empty;

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return empty;
  }

  const envelope = storedCartSchema.safeParse(json);
  if (!envelope.success) return empty;
  const { updatedAt, lines } = envelope.data;
  if (updatedAt > now || now - updatedAt > CART_TTL_MS) return empty;

  const merged: CartLine[] = [];
  for (const item of lines) {
    const parsed = storedLineSchema.safeParse(item);
    if (!parsed.success) continue;
    const line = { ...parsed.data, qty: clampQty(parsed.data.qty) };
    const key = lineKey(line);
    const index = merged.findIndex((l) => lineKey(l) === key);
    if (index === -1) merged.push(line);
    else merged[index] = { ...merged[index], qty: clampQty(merged[index].qty + line.qty) };
  }

  return { lines: merged.slice(0, MAX_CART_LINES), updatedAt };
}
