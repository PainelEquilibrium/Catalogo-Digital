# Catálogo Digital — Moda Feminina

Catálogo de exibição (tricô, malhas, jeans e plus size) com vitrine pública + área administrativa.
Ver `../PRD-catalogo-moda.md` (PRD v1.2).

## Stack

Next.js 15 (App Router, TypeScript) · Supabase (PostgreSQL + Auth + Storage) · `sharp` (WebP) · Tailwind CSS 4

## Modelo de branches (PRD §7.2)

```
main ──► produto global          (código comum a todos os clientes)
  └─ dev ──► desenvolvimento/homologação global
  └─ cliente-<nome> ──► deploy exclusivo, 1 projeto Supabase por cliente
```

**Regras:**
- Feature global: `dev` → `main` → merge nas branches `cliente-*` (agendado, ≥ 1x/mês).
- Feature exclusiva: branch do cliente, **atrás de flag** em `flags.config.ts`.
- Divergência de código é exceção; divergência de configuração (flags + branding) é regra.

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env.local
# preencher com os dados do projeto Supabase do cliente (ver comentários no arquivo)

# 3. Subir o banco local (CLI do Supabase) ou apontar para o projeto remoto
supabase init        # primeira vez
supabase start       # banco local
supabase db reset    # aplica supabase/migrations/*

# 4. Rodar
npm run dev
```

### Primeiro acesso ao admin
1. Criar o usuário em Authentication → Users (ou via `supabase.auth.admin.createUser`).
2. Promover a dona a `owner`:
   ```sql
   update public.profiles set role = 'owner' where email = 'dona@loja.com';
   ```
3. Acessar `/admin/login`.

## Provisionar novo cliente (checklist)

1. `git checkout main && git pull && git checkout -b cliente-<nome>`
2. Criar projeto Supabase novo → rodar migrations (`supabase link` + `supabase db push`, ou aplicar via SQL Editor).
3. Vercel: novo projeto a partir da branch `cliente-<nome>`; preencher env vars (ver `.env.example`).
4. Domínio: apontar `catalogo<cliente>.<sudominio>` no projeto Vercel.
5. Criar usuário owner (primeiro acesso) e configurar WhatsApp/branding no admin.
6. Registrar o cliente na lista interna de branches ativas.

## Estrutura

```
branding.config.json      # branding padrão Equilibrium (fallback da camada 2)
flags.config.ts           # feature flags por branch
supabase/migrations/      # SQL: tabelas, RLS, auditoria, storage, auth hook
src/
  middleware.ts           # refresh de sessão + guard de /admin
  lib/
    branding.ts           # resolução em camadas: banco → JSON padrão
    flags.ts              # isEnabled() com override via FLAGS_JSON
    supabase/             # client browser / server / middleware (SSR)
  app/
    layout.tsx            # injeta tokens de tema (claro/escuro) via CSS vars
    page.tsx              # home placeholder (F1: vitrines)
    admin/                # login funcional + painel placeholder protegido
```

## Fase 0 — entregue

- [x] Repo com branches `main`/`dev`
- [x] Migrations: 6 tabelas (incl. `promo_campaigns`), RLS por papel (`owner`/`manager`), auditoria por trigger com snapshot antes/depois, bucket `product-images`, auth hook
- [x] Resolução de branding em camadas + tokens de tema claro/escuro
- [x] Feature flags com override por env
- [x] Login funcional + guard de sessão no `/admin`
- [x] `.env.example` / `.env.local` documentados sem valores

## Próximas fases

- **F1** — Home/vitrines, listagem com filtros e ordenação, página de produto, CTA WhatsApp, CRUD produtos, pipeline de imagens WebP
- **F2** — Editor de campos configuráveis por categoria + filtros dinâmicos, campanhas
- **F3** — Auditoria/rollback no admin, OG dinâmico, busca
- **F4** — Tema escuro (toggle), relacionados, playbook final de provisionamento
