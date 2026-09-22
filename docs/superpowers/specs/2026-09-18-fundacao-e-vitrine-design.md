# Spec: Fundação + vitrine pública

**Data:** 18/09/2026  
**Status:** aprovada (18/09/2026); emenda 19/09/2026 — Prisma ORM, env enxuto  
**Fatia:** spec 1 de N (admin = spec 2)  
**Base:** `docs/superpowers/00-contexto-e-decisoes.md` e `02-respostas-das-perguntas-abertas.md`

Este documento é o design a implementar. Não é plano de tarefas. Depois da aprovação, o plano vai para `docs/superpowers/plans/`.

---

## 1. Objetivo

Entregar um catálogo **público** que a atendente consiga mandar no WhatsApp e a cliente consiga abrir no celular: home, coleção com filtros na URL, produto, preço ou “Sob consulta”, CTA WhatsApp, tema claro/escuro, cookies/GTM e páginas legais.

A loja ainda **não** cadastra nada pela UI. Os dados vêm de **seed**. O cadastro real é o spec de admin.

**Sucesso:** com `pnpm install`, `.env` do projeto DEV, `prisma migrate` + seed e `pnpm dev`, a vitrine funciona ponta a ponta. Reset de banco **só** no Supabase de desenvolvimento.

---

## 2. Fora deste spec

Não implementar:

- Rotas `/admin`, login, convite, CRUD, editor de branding/legais, `PoweredByEquilibrium`
- Tabelas `promo_campaigns` e `audit_log`
- Restore, lixeira UI, campanhas, contagem regressiva
- Carrinho, checkout, estoque, i18n, `next-intl`
- Formulário de lead, `/obrigado`, APIs de conversão formal
- `proxy.ts` / middleware de sessão (Next 16 chama isso de Proxy; aqui a vitrine é 100% pública)
- Upload no admin; job de órfãos; playbook de cliente novo além do README de setup local

Herdar depois: o schema, os módulos de domínio, o pipeline `sharp` e as rotas públicas.

---

## 3. Abordagens consideradas

### 3.1 Como a vitrine lê dados

|                   | Abordagem                                                                                                                                                                     | Prós                                                       | Contras                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **A (escolhida)** | Server Components + **Prisma** no servidor (`DATABASE_URL` pooler). Primeira página HTML completa. “Carregar mais” = `GET /api/vitrine/produtos` com a mesma `queryProducts`. | Tipagem, um critério de consulta, sem PostgREST na vitrine | Prisma no role `postgres` **bypassa RLS** — filtro published/deleted é obrigatório em toda query |
| B                 | Tudo no client (`useEffect` + PostgREST)                                                                                                                                      | Simples de prototipar                                      | SEO fraco, flicker, filtros mais fáceis de divergir                                              |
| C                 | BFF GraphQL / tRPC para cada tela                                                                                                                                             | Contrato único                                             | Overkill para este volume                                                                        |

**Query única:** `src/lib/catalog/query-products.ts` usada pela page e pela route. Sem duplicar SQL.

### 3.2 Imagens neste spec (sem admin)

|                   | Abordagem                                                                                                                                                                      | Prós                                           | Contras                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------------- |
| **A (escolhida)** | Módulo `processImageBuffer` (sharp → 4 WebPs) **implementado e testado** com fixture. Seed da vitrine usa URLs placeholder. Bucket criado, mas o app sobe sem binários no git. | Pipeline existe de verdade; setup local barato | Seed não prova o Storage ponta a ponta   |
| B                 | Seed processa arquivos e sobe no Storage local                                                                                                                                 | Mais fiel                                      | Fricção no primeiro `pnpm dev`           |
| C                 | Só `<img src={url}>`, sharp no spec 2                                                                                                                                          | Menos código agora                             | Mentiria o recorte “pipeline neste spec” |

### 3.3 IDs

PK `uuid` com `gen_random_uuid()`. URL pública é sempre **slug**. Catálogo < 1k linhas: fragmentação de UUIDv4 é irrelevante. Não exigir extensão `pg_uuidv7`. Paginação keyset usa `(sort_value, id)`.

---

## 4. Arquitetura

```text
Browser
  → Next.js 16 (App Router, src/app)  RSC + poucos client components
       → resolveBranding()     banco store_settings ⊕ branding.config.json ⊕ fallback
       → queryProducts()       Postgres via Prisma (servidor)
       → resolveWhatsapp()     store_settings.contact ⊕ WHATSAPP_NUMBER
       → legalPages()          store_settings.legal ⊕ src/content/legal
  → GTM só depois do Consent Mode v2 (default denied)
  → wa.me (CTA) dispara dataLayer whatsapp_click

Supabase (1 projeto = 1 loja)
  Postgres + Auth (signup desligado) + Storage bucket product-images
```

**Unidades (uma responsabilidade cada):**

| Unidade                         | Faz                                                     | Depende de            | Consumidores                   |
| ------------------------------- | ------------------------------------------------------- | --------------------- | ------------------------------ |
| `domain/branding`               | Tipo Zod do JSON, merge profundo, derivar tema escuro   | —                     | `lib/branding`, testes         |
| `lib/branding`                  | Ler settings + arquivo + fallback; CSS vars             | Prisma, JSON          | `layout`, metadata             |
| `domain/price`                  | `formatProductPrice`                                    | branding.behavior     | card, produto, WhatsApp        |
| `domain/catalog-query`          | Parse/serialize query string (filtros, sort, q, cursor) | fields_schema         | pages, API, testes             |
| `lib/catalog`                   | Queries de categoria/produto/imagens                    | Prisma, catalog-query | pages, API                     |
| `lib/images`                    | Specs das variantes + `processImageBuffer`              | sharp                 | testes; spec 2 = upload        |
| `lib/whatsapp`                  | Montar `wa.me` + mensagem                               | price, branding, env  | CTA                            |
| `lib/flags`                     | `isEnabled(name)` ← `flags.config.ts` ⊕ `FLAGS_JSON`    | env                   | futuro; neste spec só o módulo |
| `lib/consent` + `lib/analytics` | Consent Mode v2, dataLayer, UTMs                        | —                     | layout, CTA, banner            |
| `lib/copy`                      | Strings pt-BR da vitrine                                | —                     | UI                             |

Falha do banco na **leitura** de branding ou legais: servir o arquivo/fallback, **não** 500 na home. Falha ao listar produtos: empty state + log servidor, não tela branca. Produto/coleção inexistente ou não publicado: `notFound()`.

---

## 5. Stack de fundação

Pinado na implementação pelo que o `create-next-app` e o CLI do Supabase vigentes gerarem, com estes invariantes:

- Next.js **16**, App Router, TypeScript, diretório `src/`, React 19, Tailwind
- **pnpm** (`pnpm-lock.yaml` único)
- ESLint (`eslint-config-next`)
- shadcn/ui inicializado: neste spec só o que a vitrine precisar de genérico (`button` se necessário, `dialog` zoom, `sonner` “link copiado”). Visual da vitrine **não** é dashboard shadcn
- **Prisma ORM** (versão vigente via Context7) — único acesso a tabelas na vitrine. `DATABASE_URL` (pooler) no Client; `DIRECT_URL` no CLI/`migrate`. Singleton em `src/lib/prisma/client.ts`. Nunca no browser.
- `sharp`, `zod`
- Vitest + Playwright
- Host de dados: **projeto Supabase de desenvolvimento** (Auth desligado para signup; Storage bucket criado por SQL). Sem `@supabase/supabase-js` neste spec (spec 2 pode reintroduzir para Auth/upload).
- Schema: `prisma/schema.prisma` + `prisma migrate`. RLS, `unaccent`, trigger de `profiles` e bucket: SQL na **mesma** pasta `prisma/migrations` (migration extra), não um segundo histórico em `supabase/migrations`.

Scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `check` (lint + typecheck + test).

`params` e `searchParams` no App Router 16 são `Promise` — sempre `await`.

---

## 6. Árvore de arquivos (alvo)

```text
branding.config.json
flags.config.ts
.env.example
prisma/
  schema.prisma
  migrations/
  seed.ts
src/
  app/
    layout.tsx                    # html lang=pt-BR, CSS vars, consent, GTM, skip-link
    page.tsx                      # home
    error.tsx
    not-found.tsx
    robots.ts
    sitemap.ts
    colecao/[slug]/page.tsx
    produto/[slug]/page.tsx
    privacidade/page.tsx
    cookies/page.tsx
    termos/page.tsx
    api/vitrine/produtos/route.ts
  components/
    layout/                       # header, footer, theme-toggle
    catalog/                      # card, gallery, filters, load-more, cta, price
    analytics/
    legal/
    ui/                           # shadcn pontual
  content/legal/                  # fallback Equilibrium (markdown ou ts)
  domain/
    branding.ts
    price.ts
    catalog-query.ts
    category-fields.ts            # tipos do fields_schema
    product.ts
    legal.ts
  lib/
    prisma/client.ts              # PrismaClient singleton (servidor)
    branding/
    catalog/
    images/
    whatsapp/
    flags/
    analytics/
    consent/
    copy/pt-br.ts
  config/site.ts                  # SITE_URL helper
e2e/
  vitrine.spec.ts
```

Sem cliente Supabase JS neste spec. Sem `src/services`. Arquivos kebab-case. Componentes PascalCase.

---

## 7. Schema (Prisma + SQL de defesa; leftover não é canônico)

Modelos em `prisma/schema.prisma`. `prisma migrate` aplica tabelas. Uma migration SQL irmã cria extensões, checks/índices que o Prisma não expressa bem, RLS, trigger `auth.users` → `profiles`, bucket `product-images`.

**Prisma bypassa RLS** (conexão típica do role `postgres`). Toda query da vitrine **repete** o predicado público (`status = published`, `deletedAt == null`, categoria ativa). RLS continua ligado para a Data API / chave anon não vazar rascunhos se alguém usar PostgREST.

Extensões: `pgcrypto` (ou o default do projeto para `gen_random_uuid`), `unaccent`.

Enums em `text` + `check` (mais fácil de evoluir que `CREATE TYPE` neste produto):

- `products.status`: `draft` | `published`
- `profiles.role`: `owner` | `manager` (tabela existe; sem UI)

Não usar `uuid_generate_v4()` da extensão `uuid-ossp`. Usar `gen_random_uuid()`.

### 7.1 Tabelas deste spec

**`profiles`**

- `id uuid PK` → `auth.users(id)` on delete cascade
- `email text not null`
- `role text not null default 'manager'` check
- `invited_by uuid null` → `profiles`
- `created_at timestamptz not null default now()`

Trigger: ao criar usuário em `auth.users`, inserir profile `manager`. Ninguém vira `owner` sozinho (spec 2 / SQL pontual documentado no README).

**`store_settings`**

- `key text PK` — chaves de topo: `store`, `theme`, `hero`, `sections`, `empty_states`, `share`, `contact`, `behavior`, `legal`
- `value jsonb not null`
- `updated_at timestamptz not null default now()`
- `updated_by uuid null` → `profiles`

Seed desta fatia: tabela **vazia** (100% JSON Equilibrium). Teste de merge pode inserir uma chave no teste de integração, não precisa ir no `seed.sql`.

**`categories`**

- `id uuid PK default gen_random_uuid()`
- `name text not null`
- `slug text not null` unique entre não deletadas (índice único parcial `where deleted_at is null`)
- `description text null`
- `cover_image_url text null`
- `fields_schema jsonb not null default '[]'`
- `sort_order int not null default 0`
- `is_active boolean not null default true`
- `created_at` / `updated_at` / `deleted_at`

**`products`**

- `id uuid PK`
- `category_id uuid not null` → `categories` (índice)
- `name text not null`
- `slug text not null` unique parcial `deleted_at is null`
- `price numeric(10,2) null` — null = “Sob consulta”
- `promo_price numeric(10,2) null`
- `status text not null default 'draft'`
- `is_featured boolean not null default false`
- `attributes jsonb not null default '{}'`
- timestamps + `deleted_at`
- check: `promo_price is null or price is not null`
- check: `promo_price is null or promo_price < price`

**`product_images`**

- `id uuid PK`
- `product_id uuid not null` → `products` **on delete restrict** (soft delete do produto já esconde as imagens via RLS; restrict evita apagar produto físico por acidente)
- `storage_path text not null`
- `thumb_url` `card_url` `detail_url` `og_url` `text not null` neste spec (seed preenche; pipeline também)
- `width int null`, `height int null`, `size_kb int null`
- `sort_order int not null default 0`
- `created_at`
- índice `(product_id, sort_order)`

Capa = menor `sort_order`.

**Índices parciais (vitrine):**

- `products (category_id, created_at desc)` where `deleted_at is null and status = 'published'`
- `products (is_featured)` where publicado
- GIN em `products.attributes` (filtros `@>`)
- busca: `unaccent(name) ilike` + `unaccent(attributes::text) ilike`; sem índice extra neste spec

**`updated_at`:** trigger `touch_updated_at` em `categories`, `products`, `store_settings`.

### 7.2 `fields_schema`

Array Zod:

```ts
{
  key: string           // slug [a-z0-9_], único na categoria
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'boolean' | 'url'
  required?: boolean
  filterable?: boolean
  options?: string[]    // obrigatório se select | multiselect
  placeholder?: string
}
```

Sem `group`. Valores em `products.attributes` são um objeto `{ [key]: string | number | boolean | string[] }`.

Filtro público só para campos `filterable: true` dos tipos `select`, `multiselect`, `boolean`. `text`/`textarea`/`url`/`number` **não** viram facet na URL neste spec (a busca textual cobre o resto).

### 7.3 RLS

RLS **ligado** em todas as tabelas acima. Sem policy = negado.

| Tabela           | `anon` e `authenticated` SELECT               | INSERT/UPDATE/DELETE |
| ---------------- | --------------------------------------------- | -------------------- |
| `categories`     | `is_active and deleted_at is null`            | nenhuma (spec 2)     |
| `products`       | `status = 'published' and deleted_at is null` | nenhuma              |
| `product_images` | existe produto pai publicado e não deletado   | nenhuma              |
| `store_settings` | todas as linhas                               | nenhuma              |
| `profiles`       | nenhuma                                       | nenhuma              |

Storage: bucket `product-images`, leitura pública em `variants/**`. Upload autenticado = spec 2. Neste spec o bucket pode ficar vazio.

Auth: signup desligado no projeto DEV (painel Authentication). Sem `service_role` no runtime. Seed via `prisma db seed`.

---

## 8. Branding em camadas

Ordem (primeiro valor **definido** na chave vence, merge profundo de objetos):

1. `store_settings.value` por chave de topo
2. `branding.config.json` (Equilibrium, versionado na raiz)
3. Constante `FALLBACK_BRANDING` no código (mesmo shape; se o JSON estiver corrompido)

Validar o JSON com Zod no boot da resolução. JSON inválido no arquivo → log + fallback de código. JSON inválido no banco numa chave → ignorar essa chave, seguir para o arquivo.

`theme.dark` ausente: derivar do claro (inverter fundo/texto; manter `accent`/`secondary` se o contraste passar; se não passar, usar o par do fallback). Não deixar texto ilegível.

**`branding.config.json` neste spec** (não copiar o leftover cegamente):

- `store.name`: Equilibrium Tecnologia
- `store.tagline`: genérico de catálogo de **roupas** (não “plus size / tricô” como teto do produto)
- paleta terrosa já do leftover (`#2D3A4A` / `#C9A66B` / `#F7F5F2`)
- `sections.campaigns.enabled: false` (não há campanhas)
- `contact.whatsapp_number` opcional no JSON; vazio no arquivo padrão
- `legal` **não** vive no branding visual; vive em `store_settings.legal` + `src/content/legal`

Injetar no `<html>` variáveis `--color-primary`, `--color-secondary`, `--color-background`, `--color-text`, `--color-accent`, `--color-surface`, `--radius`, `--font-heading`, `--font-body`. Layout da vitrine usa essas vars, não cores Tailwind `blue-500`.

Fontes neste spec: `next/font` **Inter** + **Fraunces** (bate com o JSON padrão). Se o override do banco pedir outra família, aplicar o stack CSS; não baixar famílias arbitrárias do Google neste spec.

---

## 9. Rotas e UX

Clima: minimalista, editorial, funcional. Âncora [The Drive New York](https://thedrivenewyork.com/): chrome baixo, foto grande, categorias claras. Não copiar OS retrô do Poolside.

`lang="pt-BR"`. Skip link “Ir para o conteúdo”. Alvo de toque ~44px no mobile.

### 9.1 `/` Home

1. Header: logo (nome se não houver logo), nav das categorias ativas (nome), busca, toggle de tema se `theme.dark_mode.show_toggle`
2. Hero se `hero.enabled`
3. Lista de categorias (cover + nome), ordem `sort_order`
4. Novidades se `sections.new_arrivals.enabled` — publicados, `created_at desc`, `limit`
5. Destaques se enabled — `is_featured`
6. Promoções se enabled — `promo_price is not null`
7. Footer: links legais. Sem CTA WhatsApp genérico (o CTA mora no produto).

Seção sem itens: **não renderiza** (não mostra título vazio). Catálogo zerado: `empty_states.no_products`.

### 9.2 `/colecao/[slug]`

Grade da categoria ativa.

- Filtros gerados de `fields_schema` (facets permitidas na §7.2), combinação **AND entre campos**, **OR dentro do mesmo campo** (multiselect: o produto contém _algum_ dos valores pedidos)
- Ordenação: `novidades` | `preco_asc` | `preco_desc` | `destaque` (novidades = default do branding)
- Busca `q` (nome + valores textuais de `attributes`), `unaccent`, case-insensitive
- Query string canônica, compartilhável:

```text
/colecao/trico?cor=Preto,Bege&tamanho=M&ordenar=preco_asc&q=gola
```

- Primeira página: RSC, `pageSize = 12`
- “Carregar mais” (botão, não infinite scroll): client chama a API com `cursor` + os mesmos params; concatena cards. Sem resultados: `empty_states.no_results`
- Produto sem preço na ordenação por preço: vai **para o fim**

### 9.3 `/produto/[slug]`

- Galeria: imagens na ordem; capa primeiro; zoom leve (dialog); setas se > 1 foto
- Seed: cada produto **publicado** tem ≥ 2 imagens (regra de negócio da publicação; enforced no spec 2; seed já cumpre)
- Atributos na ordem do schema, pulando chave ausente
- Preço via `formatProductPrice`
- CTA WhatsApp (ver §11)
- Compartilhar: `navigator.share` se existir; senão copiar URL + toast
- Relacionados: até 4 da mesma categoria, excluindo o atual, `created_at desc`

### 9.4 Legais

`/privacidade`, `/cookies`, `/termos` — HTML a partir do markdown/texto resolvido (§12). Título + `h1`. Sem jargão de produto.

### 9.5 Metadata, sitemap, robots

- `generateMetadata` em home, coleção, produto
- Home/coleção: `share.og_home_image` / cover da categoria ou `og_category_fallback`
- Produto: `og_url` da capa
- `og:image` 1200×630 quando a URL for a variante og
- `sitemap.ts`: `/`, coleções ativas, produtos publicados, três legais
- `robots.ts`: allow `/`; usar `NEXT_PUBLIC_SITE_URL`

404: página amigável + link home. `error.tsx`: “Não foi possível carregar” + tentar de novo.

---

## 10. Query string e “carregar mais”

Parser em `domain/catalog-query.ts` (puro, testável):

| Param                       | Significado                   |
| --------------------------- | ----------------------------- |
| `q`                         | busca                         |
| `ordenar`                   | um de `behavior.sort_options` |
| chaves do schema filterable | CSV de valores                |
| `cursor`                    | opaco, só na API / no botão   |

Cursor: base64url de JSON `{ o, v, i }` = ordenação, valor do sort, id. Keyset, **não** `OFFSET`.

API `GET /api/vitrine/produtos`:

- Query: `slug` da coleção (obrigatório), mais os params acima
- Resposta: `{ items: ProductCard[], nextCursor: string | null }`
- 400 se slug/params inválidos; 404 se categoria inexistente
- Mesmo shape de card da home (id, slug, name, price, image, badges)

Não expor `draft` nem `deleted`. A API usa Prisma com os **mesmos** predicados de `queryProducts`. RLS é rede extra contra PostgREST, não o filtro da vitrine.

---

## 11. Preço e WhatsApp

`formatProductPrice({ price, promoPrice, showPrices, currency })`:

| Condição               | UI                          | WhatsApp          |
| ---------------------- | --------------------------- | ----------------- |
| `showPrices === false` | “Sob consulta”              | sem valor         |
| `price == null`        | “Sob consulta”              | sem valor         |
| `promoPrice != null`   | de/por + selo PROMO         | preço promocional |
| senão                  | preço formatado `pt-BR` BRL | preço             |

Número efetivo: `store_settings.contact.whatsapp_number` (só dígitos) → senão `WHATSAPP_NUMBER` → senão **esconder o CTA** (não gerar `wa.me` quebrado).

Template: `contact.whatsapp_message_default` com `{product_name}`, `{product_url}`, `{price}` (vazio se consulta). Sem placeholder órfão na mensagem final.

Clique: `window.open` / âncora `https://wa.me/{numero}?text=...` + `whatsapp_click` no dataLayer (`event_id`, path, slug).

---

## 12. GTM, consentimento, legais

Adaptar o bootstrap GTM/LGPD do portfólio **sem** form, `/api` de lead nem `/obrigado`.

- Consent Mode v2: default `denied` **antes** do GTM
- Banner com dois botões: **Aceitar** (analytics granted) e **Recusar** (analytics denied; cookies necessários só). Sem painel “gerenciar categorias” neste spec
- Consentimento persistido (chave `catalogo-consent`) restaurado antes do GTM
- `NEXT_PUBLIC_GTM_ID` vazio: não injeta o script; banner e dataLayer ainda existem (dev)
- Eventos deste spec: page view (dataLayer) e `whatsapp_click`. Sem `generate_lead`
- UTM da URL persistida (mesmo padrão do helper de portfólio: first-touch até o consentimento/sessão)

Legais: fallback em `src/content/legal/{privacidade,cookies,termos}.md` (texto Equilibrium, placeholders `[nome da loja]` resolvidos com `store.name`). Override: `store_settings` chave `legal` = `{ privacidade?: string, cookies?: string, termos?: string }` (markdown). Chave ausente → arquivo.

---

## 13. Tema escuro

- `theme.dark_mode.enabled === false`: sem classe `dark`, sem toggle
- `default: "auto"`: `prefers-color-scheme` na primeira visita
- Toggle grava `localStorage` (`catalogo-theme` = `light` | `dark`)
- Script **inline** no `<head>` para não piscar (FOUC)
- Tokens `theme.dark` nas vars quando `.dark` no `<html>`

---

## 14. Pipeline de imagem (módulo)

`src/lib/images/variants.ts`:

| Variante | Lado maior                   | Uso                    |
| -------- | ---------------------------- | ---------------------- |
| thumb    | 400                          | filtros / futura admin |
| card     | 800                          | grade                  |
| detail   | 1600                         | galeria                |
| og       | 1200×630 (cover crop centro) | OG                     |

`processImageBuffer(input: Buffer)`:

- Aceita só `image/jpeg`, `image/png`, `image/webp`. HEIC fica para o spec 2 (depende de lib nativa). Recusa com erro explícito.
- Recusa lado menor < 800px
- Auto-rotate EXIF
- Normalização leve de brilho/contraste (não “filtro Instagram”)
- Saída: quatro buffers WebP + metadados

Neste spec **ninguém chama isso em produção** além dos testes. Spec 2 liga o upload.

Vitrine: `<Image>` do Next com `card_url` / `detail_url`, width/height quando houver, `sizes` coerente com `theme.products_per_row`. Domínios: `placehold.co` + host do Supabase no `next.config` `images.remotePatterns`.

---

## 15. Seed de demonstração

`supabase/seed.sql` (idempotente o suficiente para `db reset`):

- 2 categorias ativas, slugs `trico` e `jeans`, `fields_schema` com cor (multiselect filterable), tamanho (multiselect filterable), composição (text), `busto_cm` (number, não filterable)
- ≥ **16** produtos publicados (para “carregar mais” aparecer com pageSize 12)
- ≥ 1 produto `price null`
- ≥ 1 com `promo_price`
- ≥ 1 `is_featured`
- ≥ 1 `draft` (slug conhecido) — Playwright espera 404
- ≥ 1 categoria `is_active = false` — não sai no header
- Cada publicado: 2 imagens placeholder (URLs `placehold.co` já no tamanho das variantes)
- `store_settings` vazio
- Copy do seed pode ser moda feminina (primeiro cliente); o **JSON padrão** permanece genérico

README: `pnpm install` → preencher `.env` (só as chaves da §16) → `pnpm prisma migrate deploy` no **DEV** → `pnpm prisma db seed` → `pnpm dev`. Jamais migrate/reset em banco de cliente.

---

## 16. Variáveis de ambiente

`.env.example` **sem valores**. A vitrine precisa só disto:

```text
# Prisma — pooler (app) e conexão direta (migrate / studio)
DATABASE_URL=
DIRECT_URL=

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000
WHATSAPP_NUMBER=
NEXT_PUBLIC_GTM_ID=
FLAGS_JSON=

# Opcional: host do Storage para next/image (spec 2). Sem uso obrigatório agora.
NEXT_PUBLIC_SUPABASE_URL=
```

**Não usar na vitrine (pode apagar do `.env`):**  
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_PASSWORD`, `SUPABASE_PROJECT_ID`, `SUPABASE_DIRECT_URL` (se for cópia de `DIRECT_URL`).

Senha do banco vive **dentro** de `DATABASE_URL`/`DIRECT_URL`. Nunca em arquivo versionado.

---

## 17. Feature flags

`flags.config.ts`: objeto `Record<string, boolean>` vazio ou com flags `false`.  
`isEnabled('x')` = `FLAGS_JSON` (parse Zod) sobrescreve o arquivo.  
Nenhuma flag ligada. Nenhum `if` de cliente no código da vitrine.

---

## 18. Visual — restrições concretas

- Mobile first; grade 2 colunas no mobile, 4 no desktop (tokens `products_per_row`)
- Header fino; hero com imagem larga; cards com foto dominante, nome, preço; sem ribbon de e-commerce genérico além do selo PROMO
- Filtros: lista/chips acima da grade, não sidebar pesada tipo SaaS
- Sem `bg-blue-500` / paleta default shadcn na vitrine
- Contraste WCAG AA nos pares claro e escuro do JSON padrão (checar no spec de implementação; se o dourado no claro falhar, escurecer o token no JSON)

---

## 19. Testes

**Vitest (domínio, sem browser):**

- merge de branding (banco parcial, JSON, fallback; DB down → JSON)
- derivação de `theme.dark`
- `formatProductPrice` (4 linhas da tabela §11)
- parse/serialize de catalog-query + cursor round-trip
- validação `fields_schema` (rejeita `group`, key duplicada, select sem options)
- `processImageBuffer` com PNG fixture ≥ 800px → 4 webps; rejeita 100px
- mensagem WhatsApp omite preço e placeholders mortos
- `isEnabled` com `FLAGS_JSON`

**Playwright (críticos):**

1. Home renderiza hero (ou nome da loja) e pelo menos um card
2. Coleção: aplicar um filtro → URL contém o param → reload mantém o filtro
3. Ordenar por preço; “carregar mais” aumenta a quantidade de cards quando há seed suficiente
4. Produto: CTA WhatsApp com `wa.me` e dígitos; produto sem preço não coloca valor na query `text`
5. Slug draft → 404
6. `/privacidade` tem conteúdo
7. Toggle de tema persiste após reload (localStorage)

GTM ID vazio nos e2e. WhatsApp: usar `WHATSAPP_NUMBER` no env de teste (ex. `5511999998888`).

---

## 20. Critérios de aceite

1. Setup do README sobe a vitrine localmente com seed.
2. Link `/produto/{slug}` abre foto, nome, preço ou “Sob consulta”, CTA (se houver número).
3. Link `/colecao/{slug}?cor=Preto` abre já filtrado (compartilhável).
4. “Carregar mais” não é infinite scroll e não usa OFFSET.
5. Sem branding no banco, a loja mostra Equilibrium (nome + paleta).
6. Produto draft e categoria inativa não vazam na UI nem na API.
7. Sem `WHATSAPP_NUMBER` e sem número no banco: CTA ausente, página não quebra.
8. Banner de cookies visível; GTM não carrega antes do consentimento quando há ID.
9. `pnpm check` e `pnpm test:e2e` passam no CI local.
10. Não existe rota de admin neste deploy.

---

## 21. Riscos deste recorte

| Risco                                     | Mitigação                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Spec 1 grande (fundação + vitrine + GTM)  | Um plano com tarefas pequenas; GTM/legais podem ser as últimas tarefas, não um spec separado (já decidido na Q10/Q11/Q22) |
| Placeholder ≠ Storage real                | Módulo sharp testado; spec 2 só pluga upload                                                                              |
| `unaccent` em JSONB                       | Busca: `unaccent(name)` + `unaccent(attributes::text)` no server; aceitável no volume do seed                             |
| Next 16 `proxy.ts` vs hábito `middleware` | Não criar nenhum dos dois neste spec                                                                                      |

---

## 22. O que o spec 2 herda pronto

- Tabelas de catálogo + RLS de leitura
- `profiles` + trigger de signup (mesmo com signup off)
- Resolução de branding e legais
- `processImageBuffer` + bucket
- Parser de filtros / preço / WhatsApp / flags
- Vitrine como cliente do admin (preview futuro reusa as mesmas pages)

Spec 2 acrescenta: policies de escrita por papel, login, CRUD, convite, editor, upload, mínimo 2 fotos para publicar, `PoweredByEquilibrium`.
