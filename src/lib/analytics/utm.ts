export const UTM_STORAGE_KEY = "catalogo-utm";

export const UTM_PARAM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type UtmParams = Partial<
  Record<(typeof UTM_PARAM_KEYS)[number], string>
>;

export function parseUtmFromSearch(search: string): UtmParams {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const result: UtmParams = {};

  for (const key of UTM_PARAM_KEYS) {
    const value = params.get(key)?.trim();
    if (value) {
      result[key] = value;
    }
  }

  return result;
}

export function hasUtmParams(utms: UtmParams): boolean {
  return UTM_PARAM_KEYS.some((key) => Boolean(utms[key]));
}

export function readStoredUtms(
  storage: Pick<Storage, "getItem">,
): UtmParams | null {
  const raw = storage.getItem(UTM_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as UtmParams;
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** First-touch: só grava se ainda não houver UTMs na sessão. */
export function persistUtmsFirstTouch(
  storage: Pick<Storage, "getItem" | "setItem">,
  fromUrl: UtmParams,
): UtmParams {
  const existing = readStoredUtms(storage);
  if (existing && hasUtmParams(existing)) {
    return existing;
  }
  if (!hasUtmParams(fromUrl)) {
    return existing ?? {};
  }
  storage.setItem(UTM_STORAGE_KEY, JSON.stringify(fromUrl));
  return fromUrl;
}

export function clearStoredUtms(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(UTM_STORAGE_KEY);
}
