import { CART_STORAGE_VERSION, parseStoredCart, type CartState } from "../../domain/cart";

const CART_STORAGE_KEY = "catalogo-cart";

// window ausente (SSR) e localStorage bloqueado ou cheio caem no mesmo caminho: sem exceção.
export function loadCart(now: number): CartState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    raw = null;
  }
  return parseStoredCart(raw, now);
}

export function saveCart(state: CartState): boolean {
  try {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ version: CART_STORAGE_VERSION, updatedAt: state.updatedAt, lines: state.lines }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearStoredCart(): void {
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // Sem armazenamento disponível não há nada salvo para remover.
  }
}
