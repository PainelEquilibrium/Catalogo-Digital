import {
  decodeCursor,
  parseCatalogSearchParams,
  type CatalogQuery,
} from "@/domain/catalog-query";
import {
  getPublicFilterableKeys,
  parseFieldsSchema,
  type CategoryField,
} from "@/domain/category-fields";
import { isValidCollectionSlug } from "@/lib/catalog/collection-slug";

export type ParseVitrineRequestResult =
  | { ok: true; slug: string; query: CatalogQuery; filterableKeys: string[] }
  | { ok: false; status: 400; message: string };

export type ParseVitrineSearchResult =
  | { ok: true; query: CatalogQuery }
  | { ok: false; status: 400; message: string };

export function parseVitrineProductsRequest(
  searchParams: URLSearchParams,
  fieldsSchema: CategoryField[],
): ParseVitrineRequestResult {
  const slug = searchParams.get("slug");
  if (slug === null || slug.trim().length === 0) {
    return { ok: false, status: 400, message: "slug é obrigatório" };
  }

  const trimmedSlug = slug.trim();
  if (!isValidCollectionSlug(trimmedSlug)) {
    return { ok: false, status: 400, message: "slug inválido" };
  }

  const filterableKeys = getPublicFilterableKeys(fieldsSchema);
  const parsed = parseQueryWithCursor(searchParams, filterableKeys);
  if (!parsed.ok) {
    return parsed;
  }

  return { ok: true, slug: trimmedSlug, query: parsed.query, filterableKeys };
}

export function parseVitrineSearchRequest(
  searchParams: URLSearchParams,
): ParseVitrineSearchResult {
  return parseQueryWithCursor(searchParams, []);
}

function parseQueryWithCursor(
  searchParams: URLSearchParams,
  filterableKeys: string[],
): ParseVitrineSearchResult {
  const cursorParam = searchParams.get("cursor");
  if (cursorParam !== null && cursorParam.length > 0) {
    try {
      decodeCursor(cursorParam);
    } catch {
      return { ok: false, status: 400, message: "cursor inválido" };
    }
  }

  const query = parseCatalogSearchParams(searchParams, filterableKeys);
  if (cursorParam !== null && cursorParam.length > 0 && query.cursor === null) {
    return { ok: false, status: 400, message: "cursor inválido" };
  }

  return { ok: true, query };
}

export function parseVitrineFieldsSchema(raw: unknown): CategoryField[] | null {
  try {
    return parseFieldsSchema(raw);
  } catch {
    return null;
  }
}
