"use client";

import { useForm } from "react-hook-form";
import { Field } from "@/components/admin/settings/settings-sections";
import { SectionCard } from "@/components/admin/settings/section-card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Branding } from "@/domain/branding";
import { ITEM_MARKERS, ORDER_MARKERS, validateTemplates } from "@/domain/whatsapp-templates";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { buildOrderMessage, type OrderLine } from "@/lib/whatsapp/build-order-message";

const copy = copyAdminPtBr.settings;
const PREVIEW_LINES: OrderLine[] = copy.previewLines.map((l) => ({ ...l, selections: [...l.selections] }));
const markers = (list: readonly string[]) => list.map((m) => `{${m}}`).join(" ");

export function ContactSection({ branding }: { branding: Branding }) {
  const c = branding.contact;
  const form = useForm({
    defaultValues: {
      contact: {
        whatsapp_number: c.whatsapp_number,
        whatsapp_item_template: c.whatsapp_item_template,
        whatsapp_order_template: c.whatsapp_order_template,
      },
    },
  });
  const [number, itemTemplate, orderTemplate] = form.watch([
    "contact.whatsapp_number",
    "contact.whatsapp_item_template",
    "contact.whatsapp_order_template",
  ]);
  const check = validateTemplates(itemTemplate, orderTemplate);
  // Só conveniência: o servidor valida de novo.
  const digits = number.replace(/\D/g, "");
  const numberError = digits !== "" && (digits.length < 10 || digits.length > 15);

  return (
    <SectionCard section="contact" form={form}>
      <Field label={copy.whatsappNumber} htmlFor="contact-number">
        <Input id="contact-number" inputMode="tel" aria-describedby="contact-number-hint" {...form.register("contact.whatsapp_number")} />
        <p id="contact-number-hint" className="text-xs text-muted-foreground">{copy.whatsappNumberHint}</p>
      </Field>
      <Field label={copy.itemTemplate} htmlFor="contact-item">
        <Textarea id="contact-item" rows={3} {...form.register("contact.whatsapp_item_template")} />
        <p className="text-xs text-muted-foreground">{copy.markersHint} {markers(ITEM_MARKERS)}</p>
      </Field>
      <Field label={copy.orderTemplate} htmlFor="contact-order">
        <Textarea id="contact-order" rows={5} {...form.register("contact.whatsapp_order_template")} />
        <p className="text-xs text-muted-foreground">{copy.markersHint} {markers(ORDER_MARKERS)}</p>
      </Field>
      {!check.ok ? <p role="alert" className="text-sm text-destructive">{check.message}</p> : null}
      {numberError ? <p role="alert" className="text-sm text-destructive">{copy.whatsappNumberHint}</p> : null}
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold">{copy.preview}</h3>
        <p className="text-xs text-muted-foreground">{copy.previewHint}</p>
        <pre data-testid="whatsapp-preview" className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
          {check.ok
            ? buildOrderMessage({
                lines: PREVIEW_LINES,
                itemTemplate,
                orderTemplate,
                showPrices: branding.behavior.show_prices,
                currency: branding.behavior.currency,
              })
            : ""}
        </pre>
      </div>
    </SectionCard>
  );
}
