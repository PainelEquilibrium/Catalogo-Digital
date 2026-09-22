import type { ProductDetailAttribute } from "@/domain/product";

export function isPresentAttributeValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string" && value.trim() === "") {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  return true;
}

export function formatProductAttributeValue(
  attribute: ProductDetailAttribute,
): string {
  const { type, value } = attribute;

  if (type === "boolean") {
    return value === true ? "Sim" : "Não";
  }

  if (type === "multiselect" && Array.isArray(value)) {
    return value.map(String).join(", ");
  }

  if (type === "number" && typeof value === "number") {
    return String(value);
  }

  return String(value);
}
