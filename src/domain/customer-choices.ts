import type { CategoryField } from "./category-fields";

export type CustomerChoice = { key: string; label: string; options: string[] };
export type Selection = { key: string; label: string; value: string };

/** Atributos vêm de JSON no banco: valor fora do formato esperado é ignorado. */
export function customerChoices(
  fields: CategoryField[],
  attributes: Record<string, unknown>,
): CustomerChoice[] {
  const choices: CustomerChoice[] = [];

  for (const field of fields) {
    if (
      field.customer_selects !== true ||
      (field.type !== "select" && field.type !== "multiselect")
    ) {
      continue;
    }

    const raw = attributes[field.key];
    const values = typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : [];
    const options = [
      ...new Set(
        values
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];

    if (options.length > 0) {
      choices.push({ key: field.key, label: field.label, options });
    }
  }

  return choices;
}

export function initialSelections(choices: CustomerChoice[]): Record<string, string> {
  const selected: Record<string, string> = {};
  for (const choice of choices) {
    if (choice.options.length === 1) {
      selected[choice.key] = choice.options[0];
    }
  }
  return selected;
}

export function missingChoices(
  choices: CustomerChoice[],
  selected: Record<string, string>,
): CustomerChoice[] {
  return choices.filter((choice) => !choice.options.includes(selected[choice.key]));
}

export function toSelections(
  choices: CustomerChoice[],
  selected: Record<string, string>,
): Selection[] {
  return choices.flatMap((choice) => {
    const value = selected[choice.key];
    return choice.options.includes(value)
      ? [{ key: choice.key, label: choice.label, value }]
      : [];
  });
}
