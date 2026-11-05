"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { saveProduct } from "@/app/admin/(panel)/produtos/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import type { CategoryField } from "@/domain/category-fields";
import { slugFromName } from "@/domain/product-write";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import {
  ImageGalleryEditor,
  type GalleryImageRow,
} from "@/components/admin/image-gallery-editor";
import { toast } from "sonner";

const copy = copyAdminPtBr.products;

export type ProductCategoryOption = {
  id: string;
  name: string;
  fields: CategoryField[];
};

export type ProductFormInitial = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  price: number | null;
  promoPrice: number | null;
  description: string | null;
  isFeatured: boolean;
  status: string;
  attributes: Record<string, unknown>;
  images?: GalleryImageRow[];
};

type ProductFormProps = {
  categories: ProductCategoryOption[];
  initial?: ProductFormInitial | null;
};

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const value = Number.parseFloat(trimmed.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function attributeValueToString(value: unknown): string {
  if (value == null) {
    return "";
  }
  return String(value);
}

export function ProductForm({ categories, initial = null }: ProductFormProps) {
  const router = useRouter();
  const isNew = initial == null;

  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? categories[0]?.id ?? "",
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [price, setPrice] = useState(
    initial?.price != null ? String(initial.price) : "",
  );
  const [promoPrice, setPromoPrice] = useState(
    initial?.promoPrice != null ? String(initial.promoPrice) : "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [attributes, setAttributes] = useState<Record<string, unknown>>(
    initial?.attributes ?? {},
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [categoryConfirmOpen, setCategoryConfirmOpen] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<"draft" | "publish">(
    "draft",
  );

  const isPublished = initial?.status === "published";

  const activeFields = useMemo(() => {
    const category = categories.find((item) => item.id === categoryId);
    return category?.fields ?? [];
  }, [categories, categoryId]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugFromName(value));
    }
  }

  function setAttribute(key: string, value: unknown) {
    setAttributes((current) => ({ ...current, [key]: value }));
  }

  function toggleMultiselectOption(key: string, option: string, checked: boolean) {
    const current = Array.isArray(attributes[key])
      ? (attributes[key] as string[])
      : [];
    const next = checked
      ? [...current, option]
      : current.filter((item) => item !== option);
    setAttribute(key, next);
  }

  async function submit(
    intent: "draft" | "publish",
    confirmCategoryChange: boolean,
  ) {
    setError(null);
    setSubmitting(true);

    const visibleAttributes: Record<string, unknown> = {};
    for (const field of activeFields) {
      visibleAttributes[field.key] = attributes[field.key];
    }

    const result = await saveProduct({
      id: initial?.id ?? null,
      categoryId,
      name,
      slug,
      price: parseOptionalNumber(price),
      promoPrice: parseOptionalNumber(promoPrice),
      description,
      isFeatured,
      attributes: visibleAttributes,
      intent,
      confirmCategoryChange,
    });

    setSubmitting(false);

    if (!result.ok) {
      if (result.needsCategoryConfirm) {
        setPendingIntent(intent);
        setCategoryConfirmOpen(true);
        return;
      }
      setError(result.message);
      return;
    }

    toast.success(intent === "publish" ? copy.published : copy.savedDraft);

    if (isNew) {
      router.push(`/admin/produtos/${result.id}`);
    } else {
      router.refresh();
    }
  }

  const slugPreview = slug.trim()
    ? `${copy.slugPreviewPrefix}${slug.trim()}`
    : copy.slugPreviewPrefix;

  const showSlugWarning =
    isPublished && initial != null && slug.trim() !== initial.slug;

  return (
    <>
      <form
        className="mx-auto max-w-3xl space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          void submit("draft", false);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="product-category">{copy.category}</Label>
          <Select
            value={categoryId || undefined}
            onValueChange={(value) => {
              setCategoryId(value);
            }}
          >
            <SelectTrigger id="product-category" className="min-h-11 w-full">
              <SelectValue placeholder={copy.categoryPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-name">{copy.name}</Label>
          <Input
            id="product-name"
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            className="min-h-11"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-slug">{copy.slug}</Label>
          <Input
            id="product-slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            className="min-h-11"
          />
          <p className="text-sm text-muted-foreground">{slugPreview}</p>
          {showSlugWarning ? (
            <p className="text-sm text-amber-700" role="status">
              {copy.slugPublishedWarning}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="product-price">{copy.price}</Label>
            <Input
              id="product-price"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="min-h-11"
            />
            <p className="text-sm text-muted-foreground">{copy.priceOptional}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-promo">{copy.promoPrice}</Label>
            <Input
              id="product-promo"
              inputMode="decimal"
              value={promoPrice}
              onChange={(event) => setPromoPrice(event.target.value)}
              className="min-h-11"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="product-description">{copy.description}</Label>
          <Textarea
            id="product-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
          />
          <p className="text-sm text-muted-foreground">{copy.descriptionHint}</p>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="product-featured"
            checked={isFeatured}
            onCheckedChange={(checked) => setIsFeatured(checked === true)}
          />
          <Label htmlFor="product-featured">{copy.isFeatured}</Label>
        </div>

        {activeFields.length > 0 ? (
          <div className="space-y-6">
            <h2 className="text-lg font-medium">{copy.attributesTitle}</h2>
            {activeFields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`attr-${field.key}`}>
                  {field.label}
                  {field.required ? " *" : ""}
                </Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={`attr-${field.key}`}
                    value={attributeValueToString(attributes[field.key])}
                    onChange={(event) =>
                      setAttribute(field.key, event.target.value)
                    }
                    placeholder={field.placeholder}
                  />
                ) : null}
                {field.type === "text" || field.type === "url" ? (
                  <Input
                    id={`attr-${field.key}`}
                    type={field.type === "url" ? "url" : "text"}
                    value={attributeValueToString(attributes[field.key])}
                    onChange={(event) =>
                      setAttribute(field.key, event.target.value)
                    }
                    placeholder={field.placeholder}
                    className="min-h-11"
                  />
                ) : null}
                {field.type === "number" ? (
                  <Input
                    id={`attr-${field.key}`}
                    inputMode="decimal"
                    value={attributeValueToString(attributes[field.key])}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (!raw.trim()) {
                        setAttribute(field.key, null);
                        return;
                      }
                      const parsed = Number.parseFloat(raw.replace(",", "."));
                      setAttribute(
                        field.key,
                        Number.isFinite(parsed) ? parsed : raw,
                      );
                    }}
                    placeholder={field.placeholder}
                    className="min-h-11"
                  />
                ) : null}
                {field.type === "select" ? (
                  <Select
                    value={attributeValueToString(attributes[field.key]) || undefined}
                    onValueChange={(value) => setAttribute(field.key, value)}
                  >
                    <SelectTrigger
                      id={`attr-${field.key}`}
                      className="min-h-11 w-full"
                    >
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options ?? []).map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {field.type === "multiselect" ? (
                  <div className="space-y-2 rounded-md border p-3">
                    {(field.options ?? []).map((option) => {
                      const selected = Array.isArray(attributes[field.key])
                        ? (attributes[field.key] as string[]).includes(option)
                        : false;
                      return (
                        <div key={option} className="flex items-center gap-2">
                          <Checkbox
                            id={`${field.key}-${option}`}
                            checked={selected}
                            onCheckedChange={(checked) =>
                              toggleMultiselectOption(
                                field.key,
                                option,
                                checked === true,
                              )
                            }
                          />
                          <Label htmlFor={`${field.key}-${option}`}>
                            {option}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {field.type === "boolean" ? (
                  <Select
                    value={
                      attributes[field.key] === true
                        ? "true"
                        : attributes[field.key] === false
                          ? "false"
                          : ""
                    }
                    onValueChange={(value) =>
                      setAttribute(field.key, value === "true")
                    }
                  >
                    <SelectTrigger
                      id={`attr-${field.key}`}
                      className="min-h-11 w-full"
                    >
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">{copy.booleanYes}</SelectItem>
                      <SelectItem value="false">{copy.booleanNo}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <ImageGalleryEditor
          key={initial?.images?.map((image) => image.id).join(",") ?? "no-images"}
          productId={initial?.id ?? null}
          images={initial?.images ?? []}
        />

        {error ? (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" className="min-h-11" disabled={submitting}>
            {copy.saveDraft}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={submitting}
            onClick={() => void submit("publish", false)}
          >
            {copy.publish}
          </Button>
        </div>
      </form>

      <AlertDialog open={categoryConfirmOpen} onOpenChange={setCategoryConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirmCategoryChangeTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.confirmCategoryChangeDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                setCategoryConfirmOpen(false);
                void submit(pendingIntent, true);
              }}
            >
              {copy.confirmCategoryChangeAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
