# Admin — login e catálogo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dona e a gestora cadastram categorias, campos, produtos e fotos no `/admin`, e a vitrine da spec 1 reflete publicar / lixeira.

**Architecture:** Cookie Auth com `@supabase/ssr`. Mutações em Server Actions + Prisma (o app autoriza via `profiles.role`; RLS é defesa do PostgREST). Upload usa o JWT da sessão no Storage e o `processImageBuffer` já existente. O layout da vitrine sai do `RootLayout` para um route group, senão o admin herda header/footer públicos.

**Tech Stack:** Next.js 16.3 (`src/proxy.ts`), React 19, pnpm, Prisma 7, Tailwind, shadcn só no admin, Zod 4, React Hook Form, `@supabase/ssr`, `@supabase/supabase-js` (Auth + Storage), sharp, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-21-admin-catalogo-design.md`

## Global Constraints

- Branch **`local`**. Subagentes **commitam** ao final de cada task. Sem `--no-verify`, sem force push.
- Reset de banco **só** no Supabase DEV. Jamais banco de cliente.
- Sem convite, branding/legais editáveis, campanhas, `audit_log`, purge 30 dias, editor de CSS do admin, self-signup, checkout, `tenant_id`.
- `owner` e `manager` têm o **mesmo** poder de catálogo nesta fatia. Papel lido em `profiles`, nunca `user_metadata`.
- `SUPABASE_SERVICE_ROLE_KEY` **só** em `prisma/seed.ts`. Zero `service_role` em Server Action, Route Handler, Client Component ou `NEXT_PUBLIC_`.
- `@supabase/supabase-js`: Auth e Storage. **Proibido** `.from("products"|"categories"|...)`.
- Prisma bypassa RLS. Vitrine continua filtrando `published` + `deletedAt: null` + categoria ativa. Admin **não** usa esse predicado.
- Copy do admin em `src/lib/copy/admin-pt-br.ts`. Sem string crua no JSX do admin. pt-BR. Sem `next-intl`.
- `params` / `searchParams` são `Promise`.
- `flags.config.ts` permanece sem flag ligada.
- `PoweredByEquilibrium`: login + rodapé do chrome. `variant="footer"`, `label` = copy “Fornecido por”, `showTextFallback={false}`. Não no header, card ou form. Vitrine já tem o selo no `SiteFooter`.
- JPEG/PNG/WebP, lado menor ≥ 800, HEIC recusado, arquivo ≤ **8 MB**.
- Context7 (`/vercel/next.js` v16, `/supabase/ssr`, Prisma) no dia da task que tocar a lib. Não copiar API de memória se o doc divergir; o contrato deste plano (nomes exportados) permanece.

---

### Task 1: Dependências, env e CSS do admin

**Files:**

- Modify: `package.json`, `pnpm-lock.yaml`, `.env.example`, `components.json`
- Create: `src/app/admin/admin.css`

**Interfaces:**

- Produces: pacotes `@supabase/ssr`, `@supabase/supabase-js`, `react-hook-form` e o resolver Zod compatível com Zod 4 (confirmar no Context7 de `@hookform/resolvers` antes de pin). `components.json` → `"css": "src/app/admin/admin.css"`.

- [ ] **Step 1:** Context7: versão atual de `@supabase/ssr` e resolver RHF+Zod 4.

- [ ] **Step 2:** Instalar

```powershell
pnpm add @supabase/ssr @supabase/supabase-js react-hook-form
```

Acrescentar o resolver que o doc indicar (ex. `@hookform/resolvers`). Não instalar um segundo lockfile.

- [ ] **Step 3:** `.env.example` — acrescentar, sem valores:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ADMIN_SEED_EMAIL=
ADMIN_SEED_PASSWORD=
# Só prisma/seed.ts. Nunca NEXT_PUBLIC_. Nunca importar no src/.
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 4:** `src/app/admin/admin.css` com o bloco mínimo que o shadcn espera (`@import "tailwindcss"` **não** repetir se quebrar o app — importar só os tokens/utilities que o CLI gravar neste arquivo). Apontar `components.json` `tailwind.css` para esse arquivo **antes** de qualquer `shadcn add`.

- [ ] **Step 5:** Adicionar componentes (CLI). Se o CLI alterar `src/app/globals.css`, **reverter** essa alteração.

```powershell
pnpm dlx shadcn@latest add button input label textarea select checkbox table alert-dialog --yes
```

- [ ] **Step 6:** `git diff -- src/app/globals.css` não pode introduzir paleta default do shadcn. `pnpm typecheck` exit 0.

**Done when:** env documentado; CSS da vitrine intacto; primitives shadcn em `src/components/ui/`.

---

### Task 2: Domínio `product-write` (TDD)

**Files:**

- Create: `src/domain/product-write.ts`, `src/domain/product-write.test.ts`
- Consumes: `CategoryField` de `src/domain/category-fields.ts`

**Interfaces:**

- Produces:

```ts
export type PublishBlocker =
  | { code: "min_photos"; have: number }
  | { code: "required_field"; key: string }
  | { code: "slug_invalid" }
  | { code: "slug_taken" }
  | { code: "promo_without_price" }
  | { code: "promo_not_lower" };

export type PublishInput = {
  imageCount: number;
  fields: CategoryField[];
  attributes: Record<string, unknown>;
  slug: string;
  slugTaken: boolean;
  price: number | null;
  promoPrice: number | null;
};

export function publishBlockers(input: PublishInput): PublishBlocker[];
export function slugFromName(name: string): string;
export function keepOrphanAttributes(
  previous: Record<string, unknown>,
  nextFieldKeys: readonly string[],
): Record<string, unknown>;
```

`publishBlockers` vazio = pode publicar. Rascunho **não** chama esta função.

- [ ] **Step 1:** Testes que falham

```ts
import { describe, expect, it } from "vitest";
import {
  keepOrphanAttributes,
  publishBlockers,
  slugFromName,
} from "./product-write";

const cor = {
  key: "cor",
  label: "Cor",
  type: "select" as const,
  required: true,
  options: ["Preto"],
};

describe("publishBlockers", () => {
  const base = {
    imageCount: 2,
    fields: [cor],
    attributes: { cor: "Preto" },
    slug: "blusa-preta",
    slugTaken: false,
    price: 100,
    promoPrice: null as number | null,
  };

  it("aceita o mínimo publicável", () => {
    expect(publishBlockers(base)).toEqual([]);
  });

  it("recusa menos de 2 fotos", () => {
    expect(publishBlockers({ ...base, imageCount: 1 })).toEqual([
      { code: "min_photos", have: 1 },
    ]);
  });

  it("recusa required vazio", () => {
    expect(publishBlockers({ ...base, attributes: {} })).toEqual([
      { code: "required_field", key: "cor" },
    ]);
  });

  it("recusa slug inválido ou tomado", () => {
    expect(publishBlockers({ ...base, slug: "Blusa" })[0]?.code).toBe(
      "slug_invalid",
    );
    expect(publishBlockers({ ...base, slugTaken: true })).toContainEqual({
      code: "slug_taken",
    });
  });

  it("recusa promo sem preço e promo >= preço", () => {
    expect(
      publishBlockers({ ...base, price: null, promoPrice: 10 }),
    ).toContainEqual({ code: "promo_without_price" });
    expect(publishBlockers({ ...base, promoPrice: 100 })).toContainEqual({
      code: "promo_not_lower",
    });
  });
});

describe("slugFromName", () => {
  it("kebab sem acento", () => {
    expect(slugFromName("  Blusa Tricô  ")).toBe("blusa-trico");
  });
});

describe("keepOrphanAttributes", () => {
  it("mantém chaves que o schema novo não tem", () => {
    expect(
      keepOrphanAttributes({ cor: "Preto", busto_cm: 90 }, ["cor"]),
    ).toEqual({ cor: "Preto", busto_cm: 90 });
  });
});
```

- [ ] **Step 2:** `pnpm exec vitest run src/domain/product-write.test.ts` → FAIL (módulo ausente).

- [ ] **Step 3:** Implementar. Slug válido = `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`. Required: `undefined`, `""`, `null` e array vazio contam como vazio. `false` e `0` contam como preenchidos. Promo: `promoPrice != null && price == null` → `promo_without_price`; ambos números e `promoPrice >= price` → `promo_not_lower`.

- [ ] **Step 4:** O mesmo vitest → PASS.

**Done when:** os cinco casos acima passam.

---

### Task 3: Domínio `category-write` (TDD)

**Files:**

- Create: `src/domain/category-write.ts`, `src/domain/category-write.test.ts`

**Interfaces:**

- Produces:

```ts
export function trashCategoryBlocker(
  activeProductCount: number,
): "has_active_products" | null;

export function renamedFieldKeys(input: {
  previousKeys: readonly string[];
  next: readonly { key: string; previousKey?: string }[];
}): string[];

export function suggestCopySlug(
  slug: string,
  taken: ReadonlySet<string>,
): string;
```

Remover um campo (key antiga ausente no `next`, sem `previousKey` apontando para ela) é permitido. Renomear (`previousKey` definido e `key !== previousKey`) não.

- [ ] **Step 1:** Testes

```ts
import { describe, expect, it } from "vitest";
import {
  renamedFieldKeys,
  suggestCopySlug,
  trashCategoryBlocker,
} from "./category-write";

describe("trashCategoryBlocker", () => {
  it("bloqueia quando há produto não deletado", () => {
    expect(trashCategoryBlocker(1)).toBe("has_active_products");
    expect(trashCategoryBlocker(0)).toBeNull();
  });
});

describe("renamedFieldKeys", () => {
  it("acusa troca de key e ignora remoção", () => {
    expect(
      renamedFieldKeys({
        previousKeys: ["cor", "tamanho"],
        next: [{ key: "cores", previousKey: "cor" }, { key: "composicao" }],
      }),
    ).toEqual(["cor"]);
  });
});

describe("suggestCopySlug", () => {
  it("sufixa -copia e incrementa", () => {
    expect(suggestCopySlug("trico", new Set(["trico"]))).toBe("trico-copia");
    expect(suggestCopySlug("trico", new Set(["trico", "trico-copia"]))).toBe(
      "trico-copia-2",
    );
  });
});
```

- [ ] **Step 2:** vitest FAIL → implementar → PASS.

**Done when:** os três describes passam. Não alterar `parseFieldsSchema` (já rejeita `group` e select sem options).

---

### Task 4: Migration — capa + `is_staff` + policies

**Files:**

- Modify: `prisma/schema.prisma` (`Category.coverStoragePath`)
- Create: `prisma/migrations/<timestamp>_admin_staff_rls/migration.sql` via `prisma migrate dev` **no projeto DEV**

**Interfaces:**

- Produces: coluna `categories.cover_storage_path text null`; função `public.is_staff()` `SECURITY DEFINER`, `search_path = public`, `STABLE`, `true` sse `profiles.id = auth.uid()` e `role in ('owner','manager')`.

- [ ] **Step 1:** No schema Prisma:

```prisma
coverStoragePath String? @map("cover_storage_path")
```

em `Category`, ao lado de `coverImageUrl`.

- [ ] **Step 2:** `pnpm exec prisma migrate dev --name admin_staff_rls` no DEV. A SQL gerada cria a coluna. **Completar no mesmo arquivo** (não uma segunda história) as policies abaixo. Não dropar as policies públicas da spec 1.

```sql
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('owner', 'manager')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

CREATE POLICY categories_staff_select ON public.categories
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY categories_staff_insert ON public.categories
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY categories_staff_update ON public.categories
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY products_staff_select ON public.products
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY products_staff_insert ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY products_staff_update ON public.products
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY product_images_staff_write ON public.product_images
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

CREATE POLICY product_images_staff_objects ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_staff()
    AND (storage.foldername(name))[1] IN ('originals', 'variants')
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_staff()
    AND (storage.foldername(name))[1] IN ('originals', 'variants')
  );
```

Não usar `FOR ALL` em `categories` e `products` (isso liberaria DELETE físico no PostgREST). No lugar, três policies por tabela — `SELECT`, `INSERT`, `UPDATE` — com o mesmo `USING` / `WITH CHECK` de `is_staff()`. `product_images` mantém `FOR ALL` (o editor apaga a linha da foto).

- [ ] **Step 3:** `pnpm exec prisma generate`. `pnpm typecheck` exit 0.

**Done when:** migrate aplicada no DEV; `is_staff` existe; SELECT público da vitrine intacto.

---

### Task 5: Auth + `proxy.ts`

**Files:**

- Create: `src/lib/auth/roles.ts`, `src/lib/auth/roles.test.ts`, `src/lib/auth/server.ts`, `src/lib/auth/browser.ts`, `src/lib/auth/proxy.ts`, `src/proxy.ts`

**Interfaces:**

- Produces:

```ts
export type StaffRole = "owner" | "manager";
export function parseStaffRole(
  role: string | null | undefined,
): StaffRole | null;

export type StaffSession = { userId: string; email: string; role: StaffRole };
export class StaffAuthError extends Error {
  readonly code: "unauthenticated" | "forbidden";
}
export async function requireStaff(): Promise<StaffSession>;

export function createBrowserSupabase(): SupabaseClient;
export async function updateAdminSession(
  request: NextRequest,
): Promise<NextResponse>;
```

`parseStaffRole("owner"|"manager")` devolve o papel; qualquer outro valor → `null`.

`requireStaff`: sem user → `unauthenticated`; sem profile ou `parseStaffRole` null → `forbidden`. Lê profile com Prisma `findUnique({ where: { id: user.id } })`.

`updateAdminSession`: refresh de cookie em toda request (padrão `@supabase/ssr` + `getClaims()` — Context7 `/supabase/ssr` no dia). Redirect para `/admin/login` **somente** se path começa com `/admin` e **não** é `/admin/login`, `/admin/recuperar-senha` nem `/admin/atualizar-senha`, e não há user. Vitrine nunca redireciona.

`src/proxy.ts`:

```ts
import type { NextRequest } from "next/server";
import { updateAdminSession } from "@/lib/auth/proxy";

export async function proxy(request: NextRequest) {
  return updateAdminSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 1:** Teste de `parseStaffRole` (owner, manager, `null`, `"admin"`, `""`).

- [ ] **Step 2:** Implementar roles + clientes. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Se faltarem no `requireStaff`, lançar erro claro de configuração (não usar service role).

- [ ] **Step 3:** `pnpm typecheck`. Grep em `src/`: nenhum `SERVICE_ROLE` e nenhum `.from("products")`.

**Done when:** vitest de roles passa; `src/proxy.ts` exporta `proxy`, não existe `middleware.ts`.

---

### Task 6: Seed do owner (DEV)

**Files:**

- Modify: `prisma/seed.ts`

**Interfaces:**

- Consumes: `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`.
- Produces: usuário Auth confirmado + `profiles.role = 'owner'`. Se faltar env, o seed **lança** (não segue calado). Se o e-mail já existe, busca o id e promove o profile.

- [ ] **Step 1:** No **fim** do seed atual, função `seedOwner()`:

```ts
import { createClient } from "@supabase/supabase-js";

async function seedOwner() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!url || !serviceRole || !email || !password) {
    throw new Error(
      "Seed do owner exige NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD",
    );
  }
  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  let userId = created.data.user?.id;
  if (!userId) {
    const listed = await admin.auth.admin.listUsers({ perPage: 200 });
    userId = listed.data.users.find((user) => user.email === email)?.id;
  }
  if (!userId)
    throw new Error("Não foi possível resolver o id do owner de seed");
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email, role: "owner" },
    update: { email, role: "owner" },
  });
  const row = await prisma.profile.findUnique({ where: { id: userId } });
  if (row?.role !== "owner")
    throw new Error("Seed não promoveu profile a owner");
}
```

Não `console.log` de senha. O trigger pode ter criado `manager` antes do upsert — o `update` corrige.

- [ ] **Step 2:** `pnpm exec prisma db seed` no DEV. Esperado: exit 0 e profile owner. Segunda execução também exit 0.

**Done when:** seed idempotente promove owner. Catálogo da spec 1 continua sendo semeado.

---

### Task 7: Copy, casco da vitrine e chrome do admin

**Files:**

- Create: `src/lib/copy/admin-pt-br.ts`
- Modify: `src/app/layout.tsx` (tirar header/footer da vitrine)
- Move pages públicas para `src/app/(vitrine)/` com `layout.tsx` que renderiza `SiteHeader` + `SiteFooter` + children
- Create: `src/app/admin/layout.tsx` (branding resolvido, sem nav)
- Create: `src/app/admin/(public)/login/page.tsx`, `recuperar-senha/page.tsx`, `atualizar-senha/page.tsx`
- Create: `src/app/admin/(panel)/layout.tsx`, `src/app/admin/(panel)/produtos/page.tsx` (placeholder “Nenhum produto” ok nesta task)
- Create: `src/components/admin/admin-chrome.tsx`
- Create: `src/app/admin/(panel)/sem-acesso/page.tsx`

**Interfaces:**

- Consumes: `requireStaff`, `createBrowserSupabase`, `resolveBranding`, `PoweredByEquilibrium`, `copyPtBr.poweredByLabel` **ou** a chave nova em `admin-pt-br` `chrome.poweredBy`.
- `admin-pt-br` exporta `copyAdminPtBr` com pelo menos: `login.email`, `login.password`, `login.submit`, `login.forgot`, `login.noSignup` (não renderizar link de cadastro), `recovery.submit`, `recovery.sent`, `password.update`, `chrome.products`, `chrome.categories`, `chrome.trash`, `chrome.signOut`, `chrome.poweredBy` = `"Fornecido por"`, `forbidden.title`, `error.retry`.

Rotas de URL permanecem `/admin/login`, `/admin/produtos`, etc. O `(panel)` e `(public)` não aparecem na URL.

Root layout **mantém** fontes, consent, GTM, toaster, skip-link. Não mantém `SiteHeader`/`SiteFooter`.

`(panel)/layout.tsx`: `requireStaff()`. `unauthenticated` → `redirect("/admin/login")`. `forbidden` → `redirect("/admin/sem-acesso")`.

Login: se já houver sessão staff, `redirect("/admin/produtos")`. Form client: `signInWithPassword`. Sem botão de criar conta.

Recuperar: `resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/admin/atualizar-senha` })`. Atualizar: `updateUser({ password })` na sessão de recovery.

Chrome: logo `branding.store.logo_url`, nome, links Produtos/Categorias/Lixeira. Nesta task, `categorias/page.tsx` e `lixeira/page.tsx` são stubs com o título da copy (as tasks 9 e 12 substituem). Sair = `signOut` + `router.push("/admin/login")`. Footer do chrome com o selo.

- [ ] **Step 1:** Mover páginas da vitrine. `pnpm test:e2e` da vitrine (os 7 casos) ainda passam — header e footer continuam nas rotas públicas.

- [ ] **Step 2:** Páginas de auth + chrome. `pnpm typecheck`.

- [ ] **Step 3:** No browser, `/` ainda tem nav de categorias e selo no footer. `/admin/login` mostra selo e **não** mostra header da vitrine. `/admin/produtos` sem cookie redireciona ao login.

**Done when:** os três checks do Step 3. Nenhuma flag nova.

---

### Task 8: Queries do admin

**Files:**

- Create: `src/lib/catalog/query-admin-products.ts`, `src/lib/catalog/query-admin-categories.ts`
- Test: não bater no banco. Extrair o `where` para funções puras testáveis se a query crescer; o mínimo testável é o helper de página.

**Interfaces:**

- Produces:

```ts
export const ADMIN_PAGE_SIZE = 30;

export async function queryAdminProducts(input: {
  q: string | null;
  categoryId: string | null;
  status: "draft" | "published" | null;
  page: number;
}): Promise<{ items: AdminProductRow[]; hasMore: boolean }>;

export async function queryAdminCategories(): Promise<AdminCategoryRow[]>;
```

`where` sempre `deletedAt: null` (lixeira é outra query, Task 12). `q` filtra `name` contains insensitive. `status` null = ambos. `page` 1-based, `skip: (page-1)*30`, `take: 31` para saber `hasMore`. Ordenar `updatedAt desc`.

`AdminProductRow`: `id`, `name`, `slug`, `status`, `isFeatured`, `price`, `promoPrice`, `updatedAt`, `category: { id, name }`, capa = imagem de menor `sortOrder` (`cardUrl`) ou null.

`AdminCategoryRow`: `id`, `name`, `slug`, `isActive`, `sortOrder`, `fieldsSchema`, `_count.products` onde `deletedAt: null`.

- [ ] **Step 1:** Implementar. Não reutilizar `publicProductWhere`.

- [ ] **Step 2:** `pnpm typecheck`.

**Done when:** as duas funções existem com esses nomes e não filtram `published`.

---

### Task 9: CRUD de categorias + editor de campos

**Files:**

- Modify: `src/app/admin/(panel)/categorias/page.tsx` (stub da Task 7)
- Create: `src/app/admin/(panel)/categorias/novo/page.tsx`, `[id]/page.tsx`
- Create: `src/components/admin/category-form.tsx`, `fields-schema-editor.tsx`
- Create: `src/app/admin/(panel)/categorias/actions.ts`

**Interfaces:**

- Consumes: `trashCategoryBlocker`, `renamedFieldKeys`, `suggestCopySlug`, `parseFieldsSchema`, `slugFromName`, `queryAdminCategories`, `requireStaff`, `copyAdminPtBr`.
- Produces server actions (todas começam com `await requireStaff()`):

```ts
export async function saveCategory(input: {
  id: string | null;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  fields: {
    key: string;
    previousKey?: string;
    label: string;
    type: FieldType;
    required: boolean;
    filterable: boolean;
    options: string[];
    placeholder?: string;
  }[];
}): Promise<{ ok: true; id: string } | { ok: false; message: string }>;

export async function duplicateCategory(
  id: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }>;

export async function trashCategory(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }>;
```

`saveCategory`: slug inválido/tomado → message da copy (“este endereço já está em uso” / “endereço inválido”). `renamedFieldKeys` não vazio → recusa. `filterable: true` só persiste se type ∈ select|multiselect|boolean; nos outros gravar `filterable: false`. Validar com `parseFieldsSchema` antes do write. `previousKey` não vai para o JSON.

Editor: botões “Adicionar campo”, tipos do MVP, dicas de copy (cor, tamanho, composição, `busto_cm`) que **preenchem** key/label, não um enum. Label do slug: “Endereço na loja” + texto `/colecao/{slug}`. Sem textarea de JSON.

Duplicar: copia `fieldsSchema`, description, `isActive`; nome com sufixo “ (cópia)”; slug via `suggestCopySlug`; sem produtos; capa null nesta task (upload na Task 11).

Lista: nome, slug, ativa, qtd, ordem. Link editar, botão duplicar, botão lixeira.

- [ ] **Step 1:** Actions + form. `pnpm typecheck`.

- [ ] **Step 2:** No browser (logado com o seed): criar categoria “Lenços” com campo select `cor` filterable + option `Preto`. Recarregar e ver o campo. Duplicar gera outro slug.

**Done when:** o Step 2 funciona. Capa ainda sem upload.

---

### Task 10: CRUD de produtos (sem galeria ainda)

**Files:**

- Create: `src/app/admin/(panel)/produtos/page.tsx` (substitui placeholder), `novo/page.tsx`, `[id]/page.tsx`
- Create: `src/components/admin/product-form.tsx`
- Create: `src/app/admin/(panel)/produtos/actions.ts`

**Interfaces:**

- Consumes: `publishBlockers`, `slugFromName`, `keepOrphanAttributes`, `formatProductPrice` ou copy “Sob consulta”, `queryAdminProducts`, `ADMIN_PAGE_SIZE`.
- Produces:

```ts
export async function saveProduct(input: {
  id: string | null;
  categoryId: string;
  name: string;
  slug: string;
  price: number | null;
  promoPrice: number | null;
  isFeatured: boolean;
  attributes: Record<string, unknown>;
  intent: "draft" | "publish";
  confirmCategoryChange: boolean;
}): Promise<
  | { ok: true; id: string }
  | { ok: false; message: string; needsCategoryConfirm?: boolean }
>;

export async function trashProduct(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }>;
```

Rascunho: grava mesmo com blockers. Publicar: se `publishBlockers` (imageCount real no banco, 0 nesta task) não for vazio, `{ ok: false, message }` em pt-BR mapeando o code (fotos, campo obrigatório pelo **label**, endereço em uso, promoção). Troca de `categoryId` com attributes órfãos: se `confirmCategoryChange` false, devolver `needsCategoryConfirm` sem gravar; se true, gravar attributes **intactos** (`keepOrphanAttributes` não apaga — o form só exibe keys do schema novo).

Lista: filtros `q`, `categoria`, `status` na query string. 30 + link “Carregar mais” que incrementa `page` (não infinite scroll). Preço via a mesma regra da vitrine (null → “Sob consulta”).

Aviso ao editar slug de produto `published`: texto da copy, sem redirect.

- [ ] **Step 1:** Implementar. Publicar com 0 fotos deve falhar com a mensagem de fotos.

- [ ] **Step 2:** Browser: rascunho sem foto salva e **não** aparece em `/colecao/...`. `pnpm typecheck`.

**Done when:** rascunho persiste; publicar sem 2 fotos recusa.

---

### Task 11: Upload (produto e capa)

**Files:**

- Create: `src/lib/images/upload.ts`, `src/lib/images/upload-errors.ts`, `src/lib/images/upload-errors.test.ts`
- Create: `src/components/admin/image-gallery-editor.tsx`
- Modify: actions de produto e categoria; `category-form.tsx`

**Interfaces:**

- Produces:

```ts
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export function mapUploadError(
  error: unknown,
  byteLength: number,
): "too_large" | "heic" | "too_small" | "format" | "generic";

export async function storeProcessedImage(input: {
  bytes: Buffer;
  scope:
    | { kind: "product"; productId: string }
    | { kind: "category"; categoryId: string };
}): Promise<{
  storagePath: string;
  thumbUrl: string;
  cardUrl: string;
  detailUrl: string;
  ogUrl: string;
  width: number;
  height: number;
  sizeKb: number;
}>;
```

Paths: `originals/{productId|categoryId}/{uuid}` e `variants/{id}/{uuid}-{thumb|card|detail|og}.webp`. URL pública: `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/variants/...`.

Cliente Storage = `createServerClient` da **sessão** (não service role). `storage.from("product-images").upload`.

`mapUploadError`: byteLength > 8 MB → `too_large` antes do sharp. Mensagem sharp `/HEIC/` → `heic`; `/800/` → `too_small`; `/Unsupported image format/` → `format`.

Actions:

```ts
export async function addProductImage(
  productId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; message: string }>;
export async function reorderProductImages(
  productId: string,
  orderedIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }>;
export async function removeProductImage(
  imageId: string,
): Promise<{ ok: true } | { ok: false; message: string }>;
export async function setCategoryCover(
  categoryId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; message: string }>;
```

`removeProductImage`: delete da linha Prisma + `storage.remove` dos paths. Capa: grava `coverImageUrl` = card URL e `coverStoragePath`. Substituir capa apaga o objeto anterior.

Galeria: input file, lista com subir/descer (`sortOrder`), remover. Sem URL colada.

- [ ] **Step 1:** Teste de `mapUploadError` com `Error("HEIC images are not supported")`, `Error("...800...")`, buffer length `MAX_UPLOAD_BYTES + 1`.

- [ ] **Step 2:** Implementar upload. Publicar com 2 fotos passa em `publishBlockers`.

- [ ] **Step 3:** Browser: duas imagens ≥ 800px num rascunho → Publicar → o slug abre na vitrine. Capa da categoria não é um `<input type="url">`.

**Done when:** Step 3. Vitrine e2e antigo ainda passa.

---

### Task 12: Lixeira

**Files:**

- Modify: `src/app/admin/(panel)/lixeira/page.tsx` (stub da Task 7)
- Create: `src/app/admin/(panel)/lixeira/actions.ts`
- Modify: trash actions já criadas nas tasks 9–10 para setar `deletedAt`

**Interfaces:**

- Produces:

```ts
export async function queryTrash(): Promise<{
  products: { id: string; name: string; slug: string; deletedAt: Date }[];
  categories: { id: string; name: string; slug: string; deletedAt: Date }[];
}>;

export async function restoreProduct(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }>;
export async function restoreCategory(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }>;
```

`queryTrash`: `deletedAt: { not: null }`. Restaurar: `deletedAt: null`. Se o slug colidir com outro ativo, `{ ok: false, message }` pedindo editar o endereço (não restaura). Categoria restaurada **mantém** `isActive` como estava. Página mostra a copy dos ~30 dias e diz que nada é apagado sozinho nesta versão. Filtro ou abas Produtos | Categorias.

- [ ] **Step 1:** Implementar.

- [ ] **Step 2:** Browser: lixeira um produto publicado → 404 na vitrine → restaurar → 200 de novo.

**Done when:** Step 2. Nenhum `DELETE` Prisma em `Product` ou `Category`.

---

### Task 13: Playwright admin

**Files:**

- Create: `e2e/admin.spec.ts`
- Modify: `playwright.config.ts` só se o webServer não carregar `.env` (já carrega via Next). Documentar `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` no env do runner.

**Casos (spec §12), nesta ordem, um arquivo:**

1. `page.goto("/admin/produtos")` sem storage state → URL `/admin/login`.
2. Login com env seed → heading ou link “Produtos”.
3. Criar categoria com select filterable (nome único `e2e-${Date.now()}`).
4. Produto rascunho com 1 fixture PNG ≥ 800px em `e2e/fixtures/` → não listado na coleção pública.
5. Segunda foto + Publicar → coleção pública contém o nome.
6. Mover para lixeira → some da coleção; restaurar → volta.
7. Sair → `/admin/produtos` volta ao login.
8. `/admin/login` não contém “Criar conta” nem “Cadastrar”.

Fixture: gerar PNG 800×800 no teste com sharp **ou** commitar um png pequeno válido ≥ 800 (preferir arquivo em `e2e/fixtures/ok.png`).

- [ ] **Step 1:** Escrever os 8 testes.

- [ ] **Step 2:** `pnpm test:e2e` — vitrine (7) + admin (8) passam. `pnpm check` exit 0.

**Done when:** 15 testes Playwright verdes no DEV com seed.

---

### Task 14: README e guarda-corpo

**Files:**

- Modify: `README.md`, `CLAUDE.md` (estado do repo: spec 2 em implementação / entregue conforme o momento)
- Modify: `docs/superpowers/specs/2026-09-21-admin-catalogo-design.md` status só se o humano pedir para marcar aprovada — **nesta task** o README é o alvo.

**Conteúdo README (trecho novo, pt-BR):**

- Env da spec 2 (anon key pública, service role só seed).
- `pnpm exec prisma db seed` cria o owner do DEV.
- Cliente: criar usuária no dashboard Auth (signup continua off) → trigger deixa `manager` → SQL documentado:

```sql
UPDATE public.profiles SET role = 'owner' WHERE email = 'email-da-loja';
```

- Aviso em negrito: reset só no projeto DEV.
- Admin em `/admin/login`. Sem self-signup.

- [ ] **Step 1:** Atualizar README. Não colar segredo.

- [ ] **Step 2:** Grep `src/` por `SERVICE_ROLE` → só se aparecer, é defeito (não deve). Grep `flags.config.ts` → objeto vazio.

**Done when:** um leitor segue o README e entra no admin do DEV sem abrir SQL, exceto no parágrafo do cliente.

---

## Cobertura da spec (self-review)

| Spec                                                   | Task            |
| ------------------------------------------------------ | --------------- |
| §3 Prisma + sessão Storage                             | 5, 11           |
| §3.2 seed owner                                        | 6               |
| §4 proxy só admin                                      | 5               |
| §5 shadcn sem pintar vitrine                           | 1               |
| §6 árvore / route groups                               | 7, 9–12         |
| §7 papéis iguais, sem user_metadata                    | 5, 7            |
| §8 cover_storage_path, is_staff, RLS                   | 4, 11           |
| §9 publicar, slug, órfãos, lixeira categoria           | 2, 3, 9, 10, 12 |
| §9.3 8 MB / HEIC / 800                                 | 11              |
| §10 UX prática, 30 + carregar mais, selo               | 7, 8, 9, 10     |
| §11 copy                                               | 7               |
| §12 testes                                             | 2, 3, 11, 13    |
| §13 aceite                                             | 13, 14          |
| Fora: convite, branding, audit, purge, flags de estilo | nenhuma task    |
