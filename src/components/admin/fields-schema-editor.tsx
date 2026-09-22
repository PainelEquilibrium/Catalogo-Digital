"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldType } from "@/domain/category-fields";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

const copy = copyAdminPtBr.categories;

export type FieldEditorRow = {
  clientId: string;
  key: string;
  previousKey?: string;
  label: string;
  type: FieldType;
  required: boolean;
  filterable: boolean;
  options: string[];
  placeholder?: string;
};

type FieldsSchemaEditorProps = {
  fields: FieldEditorRow[];
  onChange: (fields: FieldEditorRow[]) => void;
};

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: copy.typeText },
  { value: "textarea", label: copy.typeTextarea },
  { value: "number", label: copy.typeNumber },
  { value: "select", label: copy.typeSelect },
  { value: "multiselect", label: copy.typeMultiselect },
  { value: "boolean", label: copy.typeBoolean },
  { value: "url", label: copy.typeUrl },
];

const SUGGESTIONS: { key: string; label: string; buttonLabel: string }[] = [
  { key: copy.suggestCorKey, label: copy.suggestCorLabel, buttonLabel: copy.suggestCorLabel },
  {
    key: copy.suggestTamanhoKey,
    label: copy.suggestTamanhoLabel,
    buttonLabel: copy.suggestTamanhoLabel,
  },
  {
    key: copy.suggestComposicaoKey,
    label: copy.suggestComposicaoLabel,
    buttonLabel: copy.suggestComposicaoLabel,
  },
  { key: copy.suggestBustoKey, label: copy.suggestBustoLabel, buttonLabel: copy.suggestBustoLabel },
];

function newFieldRow(): FieldEditorRow {
  return {
    clientId: crypto.randomUUID(),
    key: "",
    label: "",
    type: "text",
    required: false,
    filterable: false,
    options: [],
  };
}

function showsFilterable(type: FieldType): boolean {
  return type === "select" || type === "multiselect" || type === "boolean";
}

function showsOptions(type: FieldType): boolean {
  return type === "select" || type === "multiselect";
}

function showsPlaceholder(type: FieldType): boolean {
  return type === "text" || type === "textarea" || type === "number" || type === "url";
}

export function createEmptyFieldRow(): FieldEditorRow {
  return newFieldRow();
}

export function FieldsSchemaEditor({ fields, onChange }: FieldsSchemaEditorProps) {
  const baseId = useId();

  function updateField(index: number, patch: Partial<FieldEditorRow>) {
    onChange(
      fields.map((field, i) => {
        if (i !== index) {
          return field;
        }
        const next = { ...field, ...patch };
        if (patch.type && !showsFilterable(patch.type)) {
          next.filterable = false;
        }
        if (patch.type && !showsOptions(patch.type)) {
          next.options = [];
        }
        return next;
      }),
    );
  }

  function removeField(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  function addFieldFromSuggestion(key: string, label: string) {
    onChange([
      ...fields,
      {
        ...newFieldRow(),
        key,
        label,
      },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{copy.suggestionsLabel}</span>
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion.key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addFieldFromSuggestion(suggestion.key, suggestion.label)}
          >
            {suggestion.buttonLabel}
          </Button>
        ))}
      </div>

      {fields.map((field, index) => {
        const fieldId = `${baseId}-${field.clientId}`;
        const keyLocked = field.previousKey !== undefined;

        return (
          <div
            key={field.clientId}
            className="space-y-3 rounded-xl border border-border p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-key`}>{copy.fieldKey}</Label>
                <Input
                  id={`${fieldId}-key`}
                  value={field.key}
                  disabled={keyLocked}
                  onChange={(event) =>
                    updateField(index, { key: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-label`}>{copy.fieldLabel}</Label>
                <Input
                  id={`${fieldId}-label`}
                  value={field.label}
                  onChange={(event) =>
                    updateField(index, { label: event.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-type`}>{copy.fieldType}</Label>
              <Select
                value={field.type}
                onValueChange={(value) =>
                  updateField(index, { type: value as FieldType })
                }
              >
                <SelectTrigger id={`${fieldId}-type`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showsPlaceholder(field.type) ? (
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-placeholder`}>{copy.fieldPlaceholder}</Label>
                <Input
                  id={`${fieldId}-placeholder`}
                  value={field.placeholder ?? ""}
                  onChange={(event) =>
                    updateField(index, { placeholder: event.target.value })
                  }
                />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-4">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={field.required}
                  onCheckedChange={(checked) =>
                    updateField(index, { required: checked === true })
                  }
                />
                {copy.fieldRequired}
              </label>
              {showsFilterable(field.type) ? (
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.filterable}
                    onCheckedChange={(checked) =>
                      updateField(index, { filterable: checked === true })
                    }
                  />
                  {copy.fieldFilterable}
                </label>
              ) : null}
            </div>

            {showsOptions(field.type) ? (
              <div className="space-y-2">
                <Label>{copy.fieldOptions}</Label>
                <div className="space-y-2">
                  {field.options.map((option, optionIndex) => (
                    <div key={`${field.clientId}-opt-${optionIndex}`} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(event) => {
                          const options = [...field.options];
                          options[optionIndex] = event.target.value;
                          updateField(index, { options });
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const options = field.options.filter(
                            (_, i) => i !== optionIndex,
                          );
                          updateField(index, { options });
                        }}
                      >
                        {copy.removeOption}
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateField(index, { options: [...field.options, ""] })
                  }
                >
                  {copy.addOption}
                </Button>
              </div>
            ) : null}

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => removeField(index)}
            >
              {copy.removeField}
            </Button>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...fields, newFieldRow()])}
      >
        {copy.addField}
      </Button>
    </div>
  );
}
