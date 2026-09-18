-- 0002 — Tabelas principais (PRD §7.3, v1.2)
-- Single-tenant: cada banco pertence a um único cliente.

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  role        user_role not null default 'manager',
  invited_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

-- Overrides de branding: 1 linha por chave de topo (store, theme, hero, ...)
-- Chave ausente = usa o branding.config.json versionado no repo (Equilibrium).
create table public.store_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id)
);

create table public.categories (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  slug            text not null unique,
  description     text,
  cover_image_url text,
  fields_schema   jsonb not null default '[]'::jsonb, -- PRD §7.3 (campos configuráveis)
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- price NULL = "Sob consulta" (PRD v1.2, decisão 2)
create table public.products (
  id           uuid primary key default uuid_generate_v4(),
  category_id  uuid not null references public.categories (id),
  name         text not null,
  slug         text not null unique,
  price        numeric(10,2),
  promo_price  numeric(10,2),
  status       product_status not null default 'draft',
  is_featured  boolean not null default false,
  attributes   jsonb not null default '{}'::jsonb, -- valores conforme fields_schema
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint promo_requires_price check (promo_price is null or price is not null)
);

create table public.product_images (
  id           uuid primary key default uuid_generate_v4(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null,             -- caminho no bucket product-images
  thumb_url    text,                      -- variantes geradas pelo pipeline sharp
  card_url     text,
  detail_url   text,
  og_url       text,
  width        int,
  height       int,
  size_kb      int,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

-- Campanhas de promoção (PRD §4.4, RF-ADM-21)
create table public.promo_campaigns (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  slug            text not null unique,
  banner_image_url text,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  selection_mode  campaign_selection_mode not null,
  campaign_items  jsonb not null default '[]'::jsonb, -- [{type: product|category, id}]
  pinned_on_home  boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint valid_period check (ends_at > starts_at)
);

-- Auditoria completa: snapshot antes/depois (PRD §5.4, RF-ADM-15/17)
create table public.audit_log (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references public.profiles (id),
  entity     text not null,              -- products | categories | promo_campaigns | store_settings
  entity_id  text,
  action     audit_action not null,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

create index idx_products_category on public.products (category_id) where deleted_at is null;
create index idx_products_status on public.products (status) where deleted_at is null;
create index idx_images_product on public.product_images (product_id, sort_order);
create index idx_audit_entity on public.audit_log (entity, entity_id, created_at desc);

-- updated_at automático
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_touch_categories before update on public.categories
  for each row execute function public.touch_updated_at();
create trigger trg_touch_products before update on public.products
  for each row execute function public.touch_updated_at();
create trigger trg_touch_campaigns before update on public.promo_campaigns
  for each row execute function public.touch_updated_at();
create trigger trg_touch_settings before update on public.store_settings
  for each row execute function public.touch_updated_at();
