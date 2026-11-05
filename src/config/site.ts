const FALLBACK = "http://localhost:3000";

function isHttpUrl(value: string): boolean {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

// Nunca lança: uma variável malformada não pode derrubar metadata, sitemap nem robots.
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[site] NEXT_PUBLIC_SITE_URL ausente em produção; usando localhost.");
    }
    return FALLBACK;
  }
  if (!isHttpUrl(raw)) {
    console.warn("[site] NEXT_PUBLIC_SITE_URL inválida (use http:// ou https://); usando localhost.");
    return FALLBACK;
  }
  return raw.replace(/\/+$/, "");
}
