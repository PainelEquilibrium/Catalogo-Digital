# Fundação + vitrine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir o catálogo público (seed, sem admin) na raiz deste repo, em Next.js 16 + Supabase, conforme `docs/superpowers/specs/2026-09-18-fundacao-e-vitrine-design.md`.

**Architecture:** Server Components leem Postgres via cliente Supabase anon; `queryProducts` é a única função de listagem (page + `GET /api/vitrine/produtos`). Branding = merge profundo banco → `branding.config.json` → fallback. Pipeline `sharp` existe e é testado; o seed usa placeholders.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind, pnpm, shadcn pontual, Zod, `@supabase/supabase-js` + `@supabase/ssr`, sharp, Vitest, Playwright, Supabase (Postgres + Storage).

## Global Constraints

- Trabalhar na branch **`local`** (derivada de `main`). `main` = produto; `dev` = homologação global. Nunca implementar em `main` sem pedido.
- Pasta atual **é** a raiz do Next. Se `create-next-app` nascer em subpasta, mover o conteúdo para cima. Preservar `README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/`.
- **Jamais** `supabase db reset` (nem `db push` destrutivo) em banco de **cliente**. O projeto Supabase de **desenvolvimento** pode resetar quando preciso.
- Sem `/admin`, sem `proxy.ts`/`middleware.ts`, sem `promo_campaigns`/`audit_log`, sem lead/`/obrigado`.
- pnpm único. Sem `NEXT_PUBLIC_` em segredo. Vitrine não usa `service_role`.
- IDs `uuid` + `gen_random_uuid()`. URLs: `/colecao/[slug]`, `/produto/[slug]`.
- Copy pt-BR em `src/lib/copy/pt-br.ts`. Arquivos kebab-case.
- `params` e `searchParams` são `Promise` (Next 16): sempre `await`.
- TDD nos módulos de domínio (Tasks 3–7) antes da UI.
- Context7 para APIs de Next/Supabase/shadcn no momento da implementação.
- Commits só quando o humano pedir, **exceto** o commit inicial em `main` necessário para existir `dev`/`local`.

**Spec:** `docs/superpowers/specs/2026-09-18-fundacao-e-vitrine-design.md`

---

### Task 1: Git — `main` / `dev` / `local`

**Files:**
- Modify: `.gitignore` (ampliar antes do commit inicial)
- Create: este plano (já criado)

- [ ] **Step 1:** Renomear a branch órfã

```powershell
git branch -m master main
```

Expected: `HEAD` aponta para `main` (ainda sem commit).

- [ ] **Step 2:** Garantir `.gitignore` mínimo

```
node_modules
.next
.env
.env.local
.env*.local
.DS_Store
*.pem
dist
coverage
playwright-report
test-results
```

Manter `docs/misc` **versionado** (é histórico, não segredo). Não ignorar a pasta inteira.

- [ ] **Step 3:** Commit inicial em `main` (único jeito de criar `dev`/`local`)

```powershell
git add .gitignore AGENTS.md CLAUDE.md README.md .cursor docs
git status
git commit -m "chore: base documental do catálogo digital"
```

Não adicionar `.env` nem chaves.

- [ ] **Step 4:** Criar branches e ir para `local`

```powershell
git branch dev
git branch local
git checkout local
git branch --show-current
```

Expected: `local`

**Done when:** `git branch` lista `main`, `dev`, `local`; working branch = `local`.

---

### Task 2: Scaffold Next.js na raiz

**Files:**
- Create (via CLI, depois mover): `package.json`, `src/app/`, `tsconfig.json`, `next.config.ts`, `pnpm-lock.yaml`
- Preserve: `README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/`, `.cursor/`

- [ ] **Step 1:** Criar o app numa pasta temporária (a raiz já tem arquivos)

```powershell
pnpm create next-app@latest _next_tmp --yes --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --disable-git --no-agents-md
```

Se `--no-agents-md` ou `--disable-git` não existirem nesta versão, omitir e **não** sobrescrever `CLAUDE.md`/`AGENTS.md` na hora de mover.

Expected: `_next_tmp/package.json` existe; `next` 16.x.

- [ ] **Step 2:** Mover o conteúdo para a raiz

Mover: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `postcss.config.*`, `eslint.config.*`, `src/`, `public/` (se houver).

Mesclar `.gitignore` (união, não replace).

**Não** mover por cima: `README.md`, `CLAUDE.md`, `AGENTS.md`.

Apagar `_next_tmp` depois.

- [ ] **Step 3:** Conferir que a raiz é o app

```powershell
Test-Path package.json; Test-Path src/app/layout.tsx; Test-Path CLAUDE.md; Test-Path docs/superpowers
```

Expected: todos `True`. Sem pasta `_next_tmp`.

- [ ] **Step 4:** `pnpm install` (se o create ainda não instalou na raiz) e `pnpm exec tsc --noEmit`

Expected: exit 0.

**Done when:** `pnpm dev` sobe o template Next na raiz sem apagar a documentação.

---

### Task 3: Tooling — Vitest, Playwright, scripts, shadcn

**Files:**
- Modify: `package.json` scripts
- Create: `vitest.config.ts`, `playwright.config.ts`, `e2e/.gitkeep`
- Create: `components.json` via shadcn

- [ ] **Step 1:** Dependências

```powershell
pnpm add zod sharp @supabase/supabase-js @supabase/ssr
pnpm add -D vitest @vitejs/plugin-react jsdom @playwright/test
```

- [ ] **Step 2:** Scripts em `package.json`

```json
"dev": "next dev",
"build": "next build",
"start": "next start",
"lint": "eslint",
"typecheck": "tsc --noEmit",
"test": "vitest run",
"test:e2e": "playwright test",
"check": "pnpm lint && pnpm typecheck && pnpm test"
```

- [ ] **Step 3:** `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

- [ ] **Step 4:** Init shadcn (Context7 / skill shadcn no dia). Base: Tailwind já no projeto. Instalar só depois, quando a UI precisar: `dialog`, `sonner`. Não tematizar a vitrine com paleta default shadcn.

- [ ] **Step 5:** `pnpm check` no estado vazio de testes (vitest 0 files ou pass).

**Done when:** `pnpm check` passa no scaffold.

---

### Task 4: Domínio — branding (TDD)

**Files:**
- Create: `src/domain/branding.ts`
- Test: `src/domain/branding.test.ts`
- Create: `branding.config.json` (raiz)

**Interfaces:**
- Produces: `Branding` (Zod), `FALLBACK_BRANDING`, `parseBranding(raw: unknown): Branding`, `deepMergeBranding(base: Branding, override: Partial<Record<string, unknown>>): Branding`, `resolveBrandingLayers(args: { fromDb: Record<string, unknown>; fromFile: unknown; fallback?: Branding }): Branding`, `deriveDarkTheme(light: Branding["theme"]): NonNullable<Branding["theme"]["dark"]>`, `brandingToCssVars(b: Branding, mode: "light" | "dark"): Record<string, string>`

- [ ] **Step 1:** Testes que falham — merge parcial do banco, arquivo inválido → fallback, DB vazio → JSON, `theme.dark` ausente deriva do claro.

- [ ] **Step 2:** `pnpm exec vitest run src/domain/branding.test.ts` — FAIL

- [ ] **Step 3:** Implementar Zod + merge profundo só em objetos plain (array substitui). `branding.config.json`: Equilibrium, tagline de **roupas**, paleta `#2D3A4A` / `#C9A66B` / `#F7F5F2`, `sections.campaigns.enabled: false`, `contact.whatsapp_number` vazio.

- [ ] **Step 4:** Testes PASS.

**Done when:** os casos da spec §8 passam no Vitest.

---

### Task 5: Domínio — preço (TDD)

**Files:**
- Create: `src/domain/price.ts`
- Test: `src/domain/price.test.ts`

**Interfaces:**
- Produces:

```ts
export type FormattedPrice =
  | { kind: "consulta" }
  | { kind: "regular"; label: string }
  | { kind: "promo"; from: string; to: string };

export function formatProductPrice(input: {
  price: number | null;
  promoPrice: number | null;
  showPrices: boolean;
  currency?: string;
}): FormattedPrice;
```

BRL `pt-BR`. `showPrices === false` ou `price == null` → `{ kind: "consulta" }`.

- [ ] Testes das 4 linhas da spec §11 → FAIL → implementa → PASS.

---

### Task 6: Domínio — fields_schema + catalog-query (TDD)

**Files:**
- Create: `src/domain/category-fields.ts`
- Create: `src/domain/catalog-query.ts`
- Test: `src/domain/category-fields.test.ts`, `src/domain/catalog-query.test.ts`

**Interfaces:**
- `FieldType = "text" | "textarea" | "number" | "select" | "multiselect" | "boolean" | "url"`
- `parseFieldsSchema(raw: unknown): CategoryField[]` — rejeita `group`, key duplicada, select/multiselect sem `options`
- `CatalogQuery = { q: string | null; ordenar: SortKey; filters: Record<string, string[]>; cursor: Cursor | null }`
- `parseCatalogSearchParams(params: URLSearchParams, filterableKeys: string[]): CatalogQuery`
- `serializeCatalogSearchParams(query: Omit<CatalogQuery, "cursor">): string`
- `encodeCursor(c: { o: SortKey; v: string; i: string }): string` / `decodeCursor(s: string): { o: SortKey; v: string; i: string }`
- `PAGE_SIZE = 12`
- `SortKey = "novidades" | "preco_asc" | "preco_desc" | "destaque"`

Filtro: AND entre chaves, OR dentro da chave (CSV).

- [ ] Testes: parse `cor=Preto,Bege`, cursor round-trip, rejeita `group` → FAIL → implementa → PASS.

---

### Task 7: Domínio — imagens, flags, WhatsApp (TDD)

**Files:**
- Create: `src/lib/images/variants.ts`, `src/lib/images/process-image-buffer.ts`
- Test: `src/lib/images/process-image-buffer.test.ts`
- Create: `src/lib/images/fixtures/ok-800.png`, `src/lib/images/fixtures/small-100.png` (gerados no teste via `sharp` se não quiser binários no git)
- Create: `flags.config.ts`, `src/lib/flags/is-enabled.ts`, `src/lib/flags/is-enabled.test.ts`
- Create: `src/lib/whatsapp/build-whatsapp-url.ts`, `src/lib/whatsapp/build-whatsapp-url.test.ts`

**Interfaces:**

```ts
export const IMAGE_VARIANTS = {
  thumb: { maxSide: 400 },
  card: { maxSide: 800 },
  detail: { maxSide: 1600 },
  og: { width: 1200, height: 630 },
} as const;

export function processImageBuffer(input: Buffer): Promise<{
  thumb: Buffer; card: Buffer; detail: Buffer; og: Buffer;
  width: number; height: number;
}>;

export function isEnabled(name: string, envJson?: string | undefined): boolean;

export function buildWhatsappUrl(input: {
  number: string | null;
  template: string;
  productName: string;
  productUrl: string;
  priceLabel: string | null;
}): string | null;
```

Regras: JPEG/PNG/WebP; lado menor < 800 → throw; HEIC → throw. `buildWhatsappUrl`: número vazio → `null`; sem preço → some `{price}` e espaços duplos. `isEnabled`: `FLAGS_JSON` sobrescreve `flags.config.ts` (objeto vazio / tudo `false`).

- [ ] Testes FAIL → implementa (fixture PNG via `sharp({ create: { width: 800, height: 800, channels: 3, background: "#ccc" } }).png()`) → PASS.

---

### Task 8: Supabase — migrations, seed, RLS, env

**Files:**
- Create: `supabase/config.toml` (via `supabase init` se necessário)
- Create: `supabase/migrations/20260918120000_extensions.sql`
- Create: `supabase/migrations/20260918120100_catalog.sql`
- Create: `supabase/migrations/20260918120200_rls.sql`
- Create: `supabase/migrations/20260918120300_storage.sql`
- Create: `supabase/migrations/20260918120400_profile_trigger.sql`
- Create: `supabase/seed.sql`
- Create: `.env.example`

**Constraints:** `enable_signup = false`. Reset **somente** no projeto de desenvolvimento (local ou o remoto DEV). Comentário no README: nunca apontar `supabase link` de cliente e dar reset.

- [ ] **Step 1:** `supabase init` na raiz se `supabase/config.toml` não existir. Não commitar secrets.

- [ ] **Step 2:** SQL conforme spec §7. Extensões `pgcrypto` + `unaccent`. Checks de status/role/promo. Índices parciais + GIN `attributes`. Trigger `touch_updated_at`. Trigger em `auth.users` → `profiles` role `manager`.

RLS: policies SELECT `anon, authenticated` exatamente como a tabela da spec §7.3. Sem INSERT/UPDATE/DELETE.

Storage: bucket `product-images`; leitura pública `variants/**`.

- [ ] **Step 3:** `seed.sql` — 2 categorias `trico`/`jeans` + 1 inativa; ≥ 16 publicados; 1 draft slug `rascunho-oculto`; 1 sem preço; 1 promo; 1 featured; 2 imagens `placehold.co` por publicado; `store_settings` vazio.

- [ ] **Step 4:** Aplicar **só** no alvo DEV:

```powershell
# local:
supabase start
supabase db reset
# remoto DEV (se for o caso), NUNCA projeto cliente:
# supabase db reset --linked   # somente se o link for o projeto de desenvolvimento
```

Expected: reset ok; `select count(*) from products` ≥ 16 publicados via SQL.

- [ ] **Step 5:** `.env.example` com as chaves da spec §16, sem valores.

**Done when:** `db reset` no DEV aplica migrations + seed.

---

### Task 9: Cliente Supabase + resolveBranding + legais + copy

**Files:**
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/branding/resolve-branding.ts`
- Create: `src/lib/legal/resolve-legal.ts`
- Create: `src/content/legal/privacidade.md`, `cookies.md`, `termos.md`
- Create: `src/lib/copy/pt-br.ts`
- Create: `src/config/site.ts`
- Test: `src/lib/branding/resolve-branding.test.ts` (mock do client: throw → arquivo)

**Interfaces:**

```ts
export function createSupabaseServerClient(): SupabaseClient; // anon only
export async function resolveBranding(): Promise<Branding>; // catch → file/fallback
export async function resolveLegalPage(slug: "privacidade" | "cookies" | "termos"): Promise<string>;
export function getSiteUrl(): string; // NEXT_PUBLIC_SITE_URL
```

Sem `browser.ts`. Sem `SERVICE_ROLE`.

**Done when:** teste de branding com client que throw devolve JSON Equilibrium.

---

### Task 10: Queries do catálogo

**Files:**
- Create: `src/domain/product.ts` (tipos `ProductCard`, `ProductDetail`)
- Create: `src/lib/catalog/query-products.ts`
- Create: `src/lib/catalog/query-categories.ts`
- Create: `src/lib/catalog/query-product-by-slug.ts`

**Interfaces:**

```ts
export async function queryProducts(input: {
  categorySlug: string;
  query: CatalogQuery;
}): Promise<{ items: ProductCard[]; nextCursor: string | null }>;

export async function queryHomeRails(limits: {
  newArrivals: number;
  featured: number;
  onSale: number;
}): Promise<{ newArrivals: ProductCard[]; featured: ProductCard[]; onSale: ProductCard[] }>;

export async function queryActiveCategories(): Promise<CategoryCard[]>;
export async function queryCategoryBySlug(slug: string): Promise<Category | null>;
export async function queryProductBySlug(slug: string): Promise<ProductDetail | null>;
export async function queryRelated(categoryId: string, excludeId: string, limit?: number): Promise<ProductCard[]>;
```

Keyset, sem `OFFSET`. Draft some via RLS. Ordenação por preço: `price is null` no fim.

Filtros JSONB: `@>` para um valor; vários valores da mesma chave = OR (`or(...)` no supabase-js).

Busca: `unaccent(name) ilike` + `unaccent(attributes::text) ilike` via `.filter`/rpc se o client não expuser `unaccent`. Se PostgREST não permitir `unaccent` direto, criar SQL function `public.search_products(...)` `security invoker` + `stable` na mesma task (não `security definer`).

**Done when:** com seed, query da coleção `trico` pageSize 12 devolve `nextCursor` não nulo.

---

### Task 11: Layout, tema, tokens, header/footer

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/globals.css`
- Create: `src/components/layout/site-header.tsx`, `site-footer.tsx`, `theme-toggle.tsx`, `theme-script.tsx`
- Create: `src/app/error.tsx`, `src/app/not-found.tsx`
- Modify: `next.config.ts` — `images.remotePatterns` para `placehold.co` e `*.supabase.co`

- [ ] `lang="pt-BR"`, skip-link, CSS vars de `brandingToCssVars`, script FOUC (`catalogo-theme`), toggle se `dark_mode.show_toggle`.
- [ ] Header: logo/nome, nav categorias ativas, busca (form GET `/colecao/trico` ou primeira categoria — **usar a primeira categoria ativa** como destino da busca global; na home a busca vai para `/colecao/{primeiroSlug}?q=`).
- [ ] Footer: só links `/privacidade` `/cookies` `/termos`. Sem WhatsApp.
- [ ] Sem `proxy.ts`.

**Done when:** layout renderiza com nome Equilibrium sem banco.

---

### Task 12: Home

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/catalog/product-card.tsx`, `product-price.tsx`
- Create: `src/app/page.tsx` `_components` só se forem exclusivos da home (hero)

Hero se `hero.enabled`. Seções sem itens não renderizam. Empty: `empty_states.no_products`. `generateMetadata` com `share.og_home_image`.

**Done when:** home mostra cards do seed (precisa env + DB DEV).

---

### Task 13: Coleção + API carregar mais

**Files:**
- Create: `src/app/colecao/[slug]/page.tsx`
- Create: `src/app/colecao/[slug]/_components/filter-bar.tsx`, `load-more.tsx`
- Create: `src/app/api/vitrine/produtos/route.ts`

API: `slug` + params da spec §10. 400 inválido, 404 categoria. Mesmo `queryProducts`.

Load-more: botão, `fetch` na API, concatena. Sem infinite scroll.

**Done when:** `/colecao/trico?cor=Preto` filtra; carregar mais aumenta cards.

---

### Task 14: Produto + WhatsApp + share

**Files:**
- Create: `src/app/produto/[slug]/page.tsx`
- Create: `src/components/catalog/product-gallery.tsx`, `whatsapp-cta.tsx`, `share-button.tsx`
- Create: `src/lib/analytics/events.ts` (`trackWhatsappClick`)

Draft → `notFound()`. CTA some se URL WhatsApp `null`. Share: `navigator.share` ou clipboard + sonner.

**Done when:** produto publicado tem CTA `wa.me` com dígitos se `WHATSAPP_NUMBER` no env; `rascunho-oculto` é 404.

---

### Task 15: GTM, consent, páginas legais

**Files:**
- Create: `src/lib/consent/consent.ts` (default denied, chave `catalogo-consent`)
- Create: `src/components/analytics/consent-banner.tsx`, `gtm.tsx`
- Create: `src/lib/analytics/utm.ts`
- Create: `src/app/privacidade/page.tsx`, `cookies/page.tsx`, `termos/page.tsx`
- Create: `src/components/legal/legal-article.tsx`

GTM só depois do consent e só se `NEXT_PUBLIC_GTM_ID`. Banner Aceitar/Recusar. Sem `generate_lead`.

**Done when:** `/privacidade` tem texto; banner visível.

---

### Task 16: sitemap, robots, metadata restante

**Files:**
- Create: `src/app/sitemap.ts`, `src/app/robots.ts`
- `generateMetadata` em coleção e produto (spec §9.5)

**Done when:** `/sitemap.xml` lista home, coleções ativas, produtos publicados, 3 legais.

---

### Task 17: Playwright

**Files:**
- Create: `e2e/vitrine.spec.ts`
- Modify: `playwright.config.ts` — `webServer: pnpm dev`, baseURL localhost:3000

Cobrir os 7 casos da spec §19. `WHATSAPP_NUMBER=5511999998888`, GTM vazio.

**Done when:** `pnpm test:e2e` passa contra o DEV/seed.

---

### Task 18: README de setup + guarda-corpo Supabase

**Files:**
- Modify: `README.md` — setup local + aviso em negrito: reset só no projeto DEV; nunca no banco de cliente
- Modify: spec status → aprovada (se ainda não)
- Modify: `CLAUDE.md` — branch `local`; regra de reset

**Done when:** alguém segue o README e sobe a vitrine no DEV.

---

## Coverage vs spec

| Spec | Task |
| --- | --- |
| §5 scaffold / scripts | 2, 3 |
| §7 schema/RLS/storage | 8 |
| §8 branding | 4, 9, 11 |
| §9 rotas/UX | 11–16 |
| §10 cursor/API | 6, 10, 13 |
| §11 preço/WhatsApp | 5, 7, 14 |
| §12 GTM/legais | 15 |
| §13 tema | 11 |
| §14 sharp | 7 |
| §15 seed | 8 |
| §16 env | 8, 18 |
| §17 flags | 7 |
| §19 testes | 4–7, 17 |
| Sem proxy/admin | 2, 11 |

## Self-review

- Sem TBD de implementação: destinos de busca global e `unaccent` via RPC se preciso estão decididos nas Tasks 10–11.
- Tipos alinhados: `CatalogQuery`, `FormattedPrice`, `processImageBuffer`, `queryProducts`.
- HEIC, admin, campanhas, restore ficam fora (spec §2).
