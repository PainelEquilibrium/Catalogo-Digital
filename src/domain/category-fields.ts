import { z } from "zod";

export const fieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "select",
  "multiselect",
  "boolean",
  "url",
]);

export type FieldType = z.infer<typeof fieldTypeSchema>;

const categoryFieldSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string(),
  type: fieldTypeSchema,
  required: z.boolean().optional(),
  filterable: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
});

export type CategoryField = z.infer<typeof categoryFieldSchema>;

const fieldsSchema = z.array(categoryFieldSchema).superRefine((fields, ctx) => {
  const seen = new Set<string>();

  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];

    if (seen.has(field.key)) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate field key",
        path: [index, "key"],
      });
    }
    seen.add(field.key);

    if (
      (field.type === "select" || field.type === "multiselect") &&
      (!field.options || field.options.length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "select and multiselect require non-empty options",
        path: [index, "options"],
      });
    }
  }
});

/** Campos públicos filterable: select, multiselect ou boolean com filterable true. */
export function getPublicFilterableKeys(fields: CategoryField[]): string[] {
  return fields
    .filter(
      (field) =>
        field.filterable === true &&
        (field.type === "select" ||
          field.type === "multiselect" ||
          field.type === "boolean"),
    )
    .map((field) => field.key);
}

export function parseFieldsSchema(raw: unknown): CategoryField[] {
  return fieldsSchema.parse(raw);
}
