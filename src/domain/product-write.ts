import type { CategoryField } from "./category-fields";

export type PublishBlocker =
  | { code: "min_photos"; have: number }
  | { code: "required_field"; key: string }
  | { code: "slug_invalid" }
  | { code: "slug_taken" }
  | { code: "promo_without_price" }
  | { code: "promo_not_lower" };

export type PublishInput = {
  imageCount: number;
  fields: CategoryField[];
  attributes: Record<string, unknown>;
  slug: string;
  slugTaken: boolean;
  price: number | null;
  promoPrice: number | null;
};

const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isAttributeEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === "") {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
}

export function publishBlockers(input: PublishInput): PublishBlocker[] {
  const blockers: PublishBlocker[] = [];

  if (input.imageCount < 2) {
    blockers.push({ code: "min_photos", have: input.imageCount });
  }

  for (const field of input.fields) {
    if (field.required && isAttributeEmpty(input.attributes[field.key])) {
      blockers.push({ code: "required_field", key: field.key });
    }
  }

  if (!VALID_SLUG.test(input.slug)) {
    blockers.push({ code: "slug_invalid" });
  }

  if (input.slugTaken) {
    blockers.push({ code: "slug_taken" });
  }

  if (input.promoPrice != null && input.price == null) {
    blockers.push({ code: "promo_without_price" });
  }

  if (
    input.promoPrice != null &&
    input.price != null &&
    input.promoPrice >= input.price
  ) {
    blockers.push({ code: "promo_not_lower" });
  }

  return blockers;
}

export function slugFromName(name: string): string {
  return name
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function keepOrphanAttributes(
  previous: Record<string, unknown>,
  _nextFieldKeys: readonly string[],
): Record<string, unknown> {
  return { ...previous };
}
