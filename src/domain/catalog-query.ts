import { z } from "zod";

export const PAGE_SIZE = 12;

export const sortKeySchema = z.enum([
  "novidades",
  "preco_asc",
  "preco_desc",
  "destaque",
]);

export type SortKey = z.infer<typeof sortKeySchema>;

export type Cursor = {
  o: SortKey;
  v: string;
  i: string;
};

export type CatalogQuery = {
  q: string | null;
  ordenar: SortKey;
  filters: Record<string, string[]>;
  cursor: Cursor | null;
};

const cursorSchema = z.object({
  o: sortKeySchema,
  v: z.string(),
  i: z.string(),
});

const RESERVED_PARAMS = new Set(["q", "ordenar", "cursor"]);

function parseSort(value: string | null): SortKey {
  const parsed = sortKeySchema.safeParse(value);
  return parsed.success ? parsed.data : "novidades";
}

function parseFilterCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeCursor(s: string): Cursor {
  const json = Buffer.from(s, "base64url").toString("utf8");
  const parsed: unknown = JSON.parse(json);
  return cursorSchema.parse(parsed);
}

export function parseCatalogSearchParams(
  params: URLSearchParams,
  filterableKeys: string[],
): CatalogQuery {
  const qRaw = params.get("q");
  const q =
    qRaw === null || qRaw.trim().length === 0 ? null : qRaw.trim();

  const ordenar = parseSort(params.get("ordenar"));

  const filterable = new Set(filterableKeys);
  const filters: Record<string, string[]> = {};

  for (const [key, value] of params.entries()) {
    if (RESERVED_PARAMS.has(key) || !filterable.has(key)) {
      continue;
    }
    const values = parseFilterCsv(value);
    if (values.length > 0) {
      filters[key] = values;
    }
  }

  let cursor: Cursor | null = null;
  const cursorParam = params.get("cursor");
  if (cursorParam !== null && cursorParam.length > 0) {
    try {
      cursor = decodeCursor(cursorParam);
    } catch {
      cursor = null;
    }
  }

  return { q, ordenar, filters, cursor };
}

export function serializeCatalogSearchParams(
  query: Omit<CatalogQuery, "cursor">,
): string {
  const parts: string[] = [];

  for (const key of Object.keys(query.filters).sort()) {
    const values = query.filters[key];
    if (values.length === 0) {
      continue;
    }
    parts.push(
      `${encodeURIComponent(key)}=${values.map((v) => encodeURIComponent(v)).join(",")}`,
    );
  }

  if (query.ordenar !== "novidades") {
    parts.push(`ordenar=${encodeURIComponent(query.ordenar)}`);
  }

  if (query.q !== null) {
    parts.push(`q=${encodeURIComponent(query.q)}`);
  }

  return parts.join("&");
}
