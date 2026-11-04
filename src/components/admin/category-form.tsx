"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveCategory, setCategoryCover } from "@/app/admin/(panel)/categorias/actions";
import Image from "next/image";
import {
  FieldsSchemaEditor,
  type FieldEditorRow,
} from "@/components/admin/fields-schema-editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugFromName } from "@/domain/product-write";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { toast } from "sonner";

const copy = copyAdminPtBr.categories;
const uploadCopy = copyAdminPtBr.upload;

export type CategoryFormInitial = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  fields: Omit<FieldEditorRow, "clientId">[];
  coverImageUrl?: string | null;
};

type CategoryFormProps = {
  initial?: CategoryFormInitial | null;
};

function toEditorRows(
  fields: Omit<FieldEditorRow, "clientId">[],
): FieldEditorRow[] {
  return fields.map((field) => ({
    ...field,
    clientId: crypto.randomUUID(),
    options: field.options ?? [],
  }));
}

export function CategoryForm({ initial = null }: CategoryFormProps) {
  const router = useRouter();
  const isNew = initial == null;

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(
    initial?.sortOrder != null ? String(initial.sortOrder) : "0",
  );
  const [fields, setFields] = useState<FieldEditorRow[]>(() =>
    initial?.fields?.length ? toEditorRows(initial.fields) : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [coverUrl, setCoverUrl] = useState(initial?.coverImageUrl ?? null);
  const [confirmedCoverUrl, setConfirmedCoverUrl] = useState(initial?.coverImageUrl ?? null);
  const [coverUploading, setCoverUploading] = useState(false);

  async function handleCoverChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !initial?.id) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setCoverUrl(previewUrl);
    setCoverUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    let result;
    try {
      result = await setCategoryCover(initial.id, formData);
    } catch {
      result = { ok: false as const, message: uploadCopy.errorGeneric };
    }
    setCoverUploading(false);

    if (!result.ok) {
      URL.revokeObjectURL(previewUrl);
      setCoverUrl(confirmedCoverUrl);
      toast.error(result.message);
      return;
    }

    setConfirmedCoverUrl(result.coverImageUrl);
    setCoverUrl(result.coverImageUrl);
    URL.revokeObjectURL(previewUrl);
    if (result.cleanupPending) toast.warning(uploadCopy.coverCleanupPending);
    else toast.success(uploadCopy.coverSaved);
    router.refresh();
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugFromName(value));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const parsedSortOrder = Number.parseInt(sortOrder, 10);
    const sortOrderValue = Number.isFinite(parsedSortOrder) ? parsedSortOrder : 0;

    const payloadFields = fields
      .filter((field) => field.key.trim() && field.label.trim())
      .map(({ clientId: _clientId, ...field }) => ({
        ...field,
        key: field.key.trim(),
        label: field.label.trim(),
        options: field.options.map((option) => option.trim()).filter(Boolean),
        previousKey: field.previousKey,
      }));

    const result = await saveCategory({
      id: initial?.id ?? null,
      name,
      slug,
      description: description.trim() || null,
      isActive,
      sortOrder: sortOrderValue,
      fields: payloadFields,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    toast.success(copy.saved);
    if (isNew) {
      router.push(`/admin/categorias/${result.id}`);
    } else {
      router.refresh();
    }
  }

  const slugPreview = slug.trim()
    ? `${copy.slugPreviewPrefix}${slug.trim()}`
    : copy.slugPreviewPrefix;

  return (
    <form
      className="mx-auto max-w-3xl space-y-8"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category-name">{copy.name}</Label>
          <Input
            id="category-name"
            value={name}
            required
            onChange={(event) => handleNameChange(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category-slug">{copy.slug}</Label>
          <Input
            id="category-slug"
            value={slug}
            required
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
          />
          <p className="text-sm text-muted-foreground">{slugPreview}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category-description">{copy.description}</Label>
          <Textarea
            id="category-description"
            value={description}
            rows={3}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={isActive}
            onCheckedChange={(checked) => setIsActive(checked === true)}
          />
          {copy.isActive}
        </label>

        {initial?.id ? (
          <div className="space-y-2">
            <Label htmlFor="category-cover-file">{uploadCopy.coverTitle}</Label>
            <p className="text-sm text-muted-foreground">{uploadCopy.coverHint}</p>
            {coverUrl ? (
              <div className="relative h-40 w-full max-w-xs overflow-hidden rounded-md bg-muted">
                <Image
                  src={coverUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="320px"
                  unoptimized
                />
              </div>
            ) : null}
            <input
              id="category-cover-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={coverUploading}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium"
              onChange={(event) => void handleCoverChange(event)}
            />
            {coverUploading ? (
              <p className="text-sm text-muted-foreground">
                {uploadCopy.coverUploading}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="category-sort-order">{copy.sortOrder}</Label>
          <Input
            id="category-sort-order"
            type="number"
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">{copy.fieldsTitle}</h2>
        <FieldsSchemaEditor fields={fields} onChange={setFields} />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting} className="min-h-11">
        {copy.save}
      </Button>
    </form>
  );
}
