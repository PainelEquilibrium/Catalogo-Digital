"use client";

import { useForm } from "react-hook-form";
import { AssetUpload } from "@/components/admin/settings/asset-upload";
import { SectionCard } from "@/components/admin/settings/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Branding } from "@/domain/branding";
import { LEGAL_SLUGS } from "@/domain/settings-sections";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

const copy = copyAdminPtBr.settings;

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Check({ label, id, ...rest }: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input id={id} type="checkbox" className="size-4" {...rest} />
      {label}
    </label>
  );
}

export function StoreSection({ branding }: { branding: Branding }) {
  const form = useForm({ defaultValues: { store: { name: branding.store.name, tagline: branding.store.tagline } } });
  return (
    <SectionCard section="store" form={form}>
      <Field label={copy.storeName} htmlFor="store-name">
        <Input id="store-name" {...form.register("store.name")} />
      </Field>
      <Field label={copy.storeTagline} htmlFor="store-tagline">
        <Textarea id="store-tagline" rows={2} {...form.register("store.tagline")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <AssetUpload kind="logo_light" label={copy.logoLight} src={branding.store.logo.light} />
        <AssetUpload kind="logo_dark" label={copy.logoDark} src={branding.store.logo.dark} dark />
        <AssetUpload kind="icon_light" label={copy.iconLight} src={branding.store.icon.light} />
        <AssetUpload kind="icon_dark" label={copy.iconDark} src={branding.store.icon.dark} dark />
      </div>
    </SectionCard>
  );
}

const COLORS = [
  ["primary_color", copy.colorPrimary],
  ["secondary_color", copy.colorSecondary],
  ["background_color", copy.colorBackground],
  ["surface_color", copy.colorSurface],
  ["text_color", copy.colorText],
  ["accent_color", copy.colorAccent],
] as const;

export function ThemeSection({ branding }: { branding: Branding }) {
  const t = branding.theme;
  const form = useForm({
    defaultValues: {
      theme: {
        primary_color: t.primary_color,
        secondary_color: t.secondary_color,
        background_color: t.background_color,
        surface_color: t.surface_color ?? t.background_color,
        text_color: t.text_color,
        accent_color: t.accent_color,
        dark_mode: t.dark_mode,
      },
    },
  });
  return (
    <SectionCard section="theme" form={form}>
      <div className="grid gap-4 sm:grid-cols-3">
        {COLORS.map(([name, label]) => (
          <Field key={name} label={label} htmlFor={`theme-${name}`}>
            <Input id={`theme-${name}`} type="color" className="h-11 p-1" {...form.register(`theme.${name}`)} />
          </Field>
        ))}
      </div>
      <Check id="theme-dark-enabled" label={copy.darkEnabled} {...form.register("theme.dark_mode.enabled")} />
      <Check id="theme-dark-toggle" label={copy.darkShowToggle} {...form.register("theme.dark_mode.show_toggle")} />
      <Field label={copy.darkDefault} htmlFor="theme-dark-default">
        <select
          id="theme-dark-default"
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          {...form.register("theme.dark_mode.default")}
        >
          <option value="light">{copy.darkDefaultLight}</option>
          <option value="dark">{copy.darkDefaultDark}</option>
          <option value="auto">{copy.darkDefaultAuto}</option>
        </select>
      </Field>
    </SectionCard>
  );
}

const LIMITED = ["new_arrivals", "featured", "on_sale"] as const;
const SECTION_KEYS = ["new_arrivals", "featured", "on_sale", "campaigns", "categories"] as const;

export function HomeSection({ branding }: { branding: Branding }) {
  const h = branding.hero;
  const form = useForm({
    defaultValues: {
      hero: { enabled: h.enabled, title: h.title, subtitle: h.subtitle, cta_label: h.cta_label, cta_link: h.cta_link },
      sections: branding.sections,
    },
  });
  return (
    <SectionCard section="home" form={form}>
      <Check id="hero-enabled" label={copy.heroEnabled} {...form.register("hero.enabled")} />
      <Field label={copy.heroTitle} htmlFor="hero-title">
        <Input id="hero-title" {...form.register("hero.title")} />
      </Field>
      <Field label={copy.heroSubtitle} htmlFor="hero-subtitle">
        <Input id="hero-subtitle" {...form.register("hero.subtitle")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.heroCtaLabel} htmlFor="hero-cta-label">
          <Input id="hero-cta-label" {...form.register("hero.cta_label")} />
        </Field>
        <Field label={copy.heroCtaLink} htmlFor="hero-cta-link">
          <Input id="hero-cta-link" {...form.register("hero.cta_link")} />
        </Field>
      </div>
      <AssetUpload kind="hero" label={copy.heroImage} src={h.image_url} />
      <h3 className="pt-2 text-sm font-semibold">{copy.sectionsTitle}</h3>
      {SECTION_KEYS.map((key) => (
        <div key={key} className="grid items-end gap-3 sm:grid-cols-[1fr_8rem_auto]">
          <Field label={`${copy.sectionNames[key]}: ${copy.sectionName}`} htmlFor={`sec-${key}-title`}>
            <Input id={`sec-${key}-title`} {...form.register(`sections.${key}.title`)} />
          </Field>
          {(LIMITED as readonly string[]).includes(key) ? (
            <Field label={`${copy.sectionNames[key]}: ${copy.sectionLimit}`} htmlFor={`sec-${key}-limit`}>
              <Input
                id={`sec-${key}-limit`}
                type="number"
                min={1}
                {...form.register(`sections.${key as (typeof LIMITED)[number]}.limit`, { valueAsNumber: true })}
              />
            </Field>
          ) : (
            <span />
          )}
          <Check id={`sec-${key}-enabled`} label={`${copy.sectionNames[key]}: ${copy.sectionEnabled}`} {...form.register(`sections.${key}.enabled`)} />
        </div>
      ))}
    </SectionCard>
  );
}

export function BehaviorSection({ branding }: { branding: Branding }) {
  const form = useForm({ defaultValues: { behavior: { show_prices: branding.behavior.show_prices } } });
  return (
    <SectionCard
      section="behavior"
      form={form}
      confirm={{
        when: (v) => branding.behavior.show_prices && !v.behavior.show_prices,
        title: copy.showPricesConfirmTitle,
        description: copy.showPricesConfirmDescription,
        action: copy.showPricesConfirmAction,
      }}
    >
      <Check id="show-prices" label={copy.showPrices} {...form.register("behavior.show_prices")} />
    </SectionCard>
  );
}

const LEGAL_LABELS = { privacidade: copy.legalPrivacy, cookies: copy.legalCookies, termos: copy.legalTerms } as const;

export function LegalSection({ saved }: { saved: Partial<Record<(typeof LEGAL_SLUGS)[number], string>> }) {
  const form = useForm({
    defaultValues: { legal: { privacidade: saved.privacidade ?? "", cookies: saved.cookies ?? "", termos: saved.termos ?? "" } },
  });
  return (
    <SectionCard section="legal" form={form}>
      <p className="text-sm text-muted-foreground">{copy.legalHint}</p>
      {LEGAL_SLUGS.map((slug) => (
        <Field key={slug} label={LEGAL_LABELS[slug]} htmlFor={`legal-${slug}`}>
          <Textarea id={`legal-${slug}`} rows={8} {...form.register(`legal.${slug}`)} />
        </Field>
      ))}
    </SectionCard>
  );
}
