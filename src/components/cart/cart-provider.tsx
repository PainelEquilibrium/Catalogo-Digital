"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";
import {
  addLine,
  removeLine,
  setLineQty,
  type AddResult,
  type CartLine,
  type CartState,
} from "@/domain/cart";
import type { Selection } from "@/domain/customer-choices";
import { trackWhatsappClick } from "@/lib/analytics/events";
import { loadCart, saveCart } from "@/lib/cart/storage";
import { buildOrderMessage, buildOrderWhatsappUrl } from "@/lib/whatsapp/build-order-message";

export type CartConfig = {
  whatsappNumber: string | null;
  itemTemplate: string;
  orderTemplate: string;
  showPrices: boolean;
  currency: string;
  siteUrl: string;
};

export type CartProduct = {
  id: string;
  name: string;
  slug: string;
  price: number | null;
  promoPrice: number | null;
  thumbUrl: string | null;
};

export type Revalidation = "idle" | "loading" | "failed" | "ok";
export type SendOutcome =
  | "sent"
  | "no_number"
  | "revalidation_failed"
  | "nothing_to_send"
  | "too_long";

type CartContextValue = {
  config: CartConfig;
  lines: CartLine[];
  add: (productId: string, selections: Selection[], qty?: number) => AddResult;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  revalidation: Revalidation;
  products: Map<string, CartProduct>;
  revalidate: () => Promise<Map<string, CartProduct> | null>;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** false quando o navegador recusou gravar: o carrinho segue só na memória. */
  persisted: boolean;
  /** true depois de abrir o WhatsApp com o carrinho; some ao limpar. */
  sent: boolean;
  hasNumber: boolean;
  /** Abre o WhatsApp revalidando antes. `lines: null` = o carrinho inteiro. Só chamar de um clique. */
  send: (lines: CartLine[] | null, slug: string | null) => Promise<SendOutcome>;
};

const CartContext = createContext<CartContextValue | null>(null);

const responseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      price: z.number().nullable(),
      promoPrice: z.number().nullable(),
      thumbUrl: z.string().nullable(),
    }),
  ),
});

async function fetchProducts(ids: string[]): Promise<Map<string, CartProduct> | null> {
  try {
    const response = await fetch("/api/vitrine/carrinho", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const parsed = responseSchema.safeParse(await response.json());
    return parsed.success ? new Map(parsed.data.items.map((item) => [item.id, item])) : null;
  } catch {
    return null;
  }
}

const uniqueIds = (lines: CartLine[]) => [...new Set(lines.map((line) => line.productId))];

export function CartProvider({ config, children }: { config: CartConfig; children: ReactNode }) {
  const [state, setState] = useState<CartState>({ lines: [], updatedAt: 0 });
  const stateRef = useRef(state);
  const [persisted, setPersisted] = useState(true);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [revalidation, setRevalidation] = useState<Revalidation>("idle");
  const [products, setProducts] = useState<Map<string, CartProduct>>(new Map());
  const requestSeq = useRef(0);
  const hasNumber = (config.whatsappNumber ?? "").replace(/\D/g, "").length > 0;

  // localStorage só existe no navegador: o primeiro render é igual ao do servidor, depois carrega.
  useEffect(() => {
    const loaded = loadCart(Date.now());
    stateRef.current = loaded;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ler no render quebraria a hidratação
    setState(loaded);
  }, []);

  const commit = useCallback((next: CartState) => {
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
    setPersisted(saveCart(next));
  }, []);

  const add = useCallback<CartContextValue["add"]>(
    (productId, selections, qty = 1) => {
      const { state: next, result } = addLine(stateRef.current, { productId, selections, qty }, Date.now());
      commit(next);
      return result;
    },
    [commit],
  );
  const setQty = useCallback((key: string, qty: number) => commit(setLineQty(stateRef.current, key, qty, Date.now())), [commit]);
  const remove = useCallback((key: string) => commit(removeLine(stateRef.current, key, Date.now())), [commit]);
  const clear = useCallback(() => {
    commit({ lines: [], updatedAt: Date.now() });
    setSent(false);
  }, [commit]);

  const revalidate = useCallback(async () => {
    const ids = uniqueIds(stateRef.current.lines);
    const mine = ++requestSeq.current;
    if (ids.length === 0) {
      setRevalidation("ok");
      return new Map<string, CartProduct>();
    }
    setRevalidation("loading");
    const fresh = await fetchProducts(ids);
    // Resposta de uma chamada antiga não pode sobrescrever a mais nova.
    if (mine === requestSeq.current) {
      if (fresh) setProducts(fresh);
      setRevalidation(fresh ? "ok" : "failed");
    }
    return fresh;
  }, []);

  useEffect(() => {
    if (open) void revalidate();
  }, [open, revalidate]);

  const send = useCallback<CartContextValue["send"]>(
    async (given, slug) => {
      const number = config.whatsappNumber;
      if (!hasNumber || !number) return "no_number";

      // O bloqueador de pop-up só aceita abrir aba dentro do clique: abre já e preenche depois.
      const tab = window.open("", "_blank");
      if (tab) tab.opener = null;
      const fail = (outcome: SendOutcome) => {
        tab?.close();
        return outcome;
      };

      const lines = given ?? stateRef.current.lines;
      const fresh = given === null ? await revalidate() : await fetchProducts(uniqueIds(lines));
      if (!fresh) return fail("revalidation_failed");

      const orderLines = lines.flatMap((line) => {
        const product = fresh.get(line.productId);
        return product
          ? [{
              name: product.name,
              selections: line.selections,
              qty: line.qty,
              price: product.price,
              promoPrice: product.promoPrice,
              url: `${config.siteUrl}/produto/${product.slug}`,
            }]
          : [];
      });
      if (orderLines.length === 0) return fail("nothing_to_send");

      const message = buildOrderMessage({
        lines: orderLines,
        itemTemplate: config.itemTemplate,
        orderTemplate: config.orderTemplate,
        showPrices: config.showPrices,
        currency: config.currency,
      });
      const built = buildOrderWhatsappUrl(number, message);
      if (!built.ok) return fail("too_long");

      if (tab) tab.location.href = built.url;
      else window.location.assign(built.url);
      trackWhatsappClick(window.location.pathname, slug, orderLines.length);
      if (given === null) setSent(true);
      return "sent";
    },
    [config, hasNumber, revalidate],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      config,
      lines: state.lines,
      add,
      setQty,
      remove,
      clear,
      revalidation,
      products,
      revalidate,
      open,
      setOpen,
      persisted,
      sent,
      hasNumber,
      send,
    }),
    [config, state.lines, add, setQty, remove, clear, revalidation, products, revalidate, open, persisted, sent, hasNumber, send],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart fora do CartProvider");
  return value;
}
