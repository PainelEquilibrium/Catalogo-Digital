# Spec: Admin — login e catálogo

**Data:** 21/09/2026  
**Status:** aprovada (22/09/2026). Plano: `docs/superpowers/plans/2026-09-22-admin-catalogo.md`  
**Fatia:** spec 2 de N (usuárias + branding/legais = spec seguinte; campanhas/auditoria depois)  
**Base:** `docs/superpowers/00-contexto-e-decisoes.md`, `02-respostas-das-perguntas-abertas.md`, spec 1 `2026-09-18-fundacao-e-vitrine-design.md`

Este documento é o design a implementar. Não é plano de tarefas. Depois da aprovação, o plano vai para `docs/superpowers/plans/`.

---

## 1. Objetivo

A dona da loja (e a gestora) cadastram categorias, campos, produtos e fotos **sem SQL e sem a Equilibrium no dia a dia**. A vitrine da spec 1 passa a refletir o cadastro: publicar, filtrar, “Sob consulta”, WhatsApp.

O painel é **funcional e prático**. A usuária típica sabe o básico de computador/navegador. Agilidade de gestão > visual de produto de design. Alguns clientes, no futuro, poderão editar estilos do admin via **client-flag**, loja a loja — **não** nesta fatia.

**Sucesso:** no DEV, seed do owner + login → criar categoria com campos → produto com ≥ 2 fotos → publicar → o item aparece na vitrine. Reset de banco **só** no Supabase de desenvolvimento.

---

## 2. Fora deste spec

Não implementar:

- Convite e gestão de usuárias no painel (listar, papel, desativar)
- Editor de branding, WhatsApp da loja, textos legais
- Campanhas (`promo_campaigns`)
- `audit_log`, timeline, restore em 2 cliques (snapshot before/after)
- Purge físico da lixeira aos 30 dias (só o rótulo da política na UI)
- Editor de CSS/tema/estilo do admin (client-flag, caso a caso)
- HEIC (o pipeline já rejeita; continua rejeitando)
- Self-signup, checkout, estoque, i18n, `tenant_id`
- Job de órfãos no Storage

O selo `PoweredByEquilibrium` **já está** no rodapé da vitrine. Nesta fatia entra também no **login** e no **rodapé do chrome** do admin.

---

## 3. Abordagens consideradas

### 3.1 Como o admin lê e grava

|                   | Abordagem                                                                                                                                                                                                            | Prós                                                         | Contras                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| **A (escolhida)** | Mesmo Next.js. Auth com `@supabase/ssr` (cookie). Tabelas com **Prisma + Server Actions**. Storage com cliente Supabase **da sessão** (JWT da usuária). RLS de escrita = defesa PostgREST, não a autorização do app. | Um critério de dados com a vitrine; papel lido em `profiles` | Dois clientes no servidor (Prisma + supabase session)   |
| B                 | CRUD no browser via PostgREST (`@supabase/supabase-js`)                                                                                                                                                              | Menos Server Actions                                         | Autorização só no RLS; fura o contrato Prisma da spec 1 |
| C                 | REST/tRPC na frente do Prisma                                                                                                                                                                                        | Contrato HTTP extra                                          | Camada a mais no mesmo app                              |

Prisma continua bypassando RLS. Toda mutação **confere sessão + `profiles.role`** no servidor (`owner` ou `manager`). Sem `user_metadata` para papel. Sem `service_role` no runtime da app (nem vitrine nem admin).

### 3.2 Primeiro acesso

|                   | Abordagem                                                                                                                        | Prós                          | Contras                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| **A (escolhida)** | DEV: seed cria Auth + `profiles.role = owner`. Cliente: Equilibrium cria a primeira conta no dashboard do Auth e ajusta o papel. | Spec de usuárias pode esperar | Seed precisa de `SUPABASE_SERVICE_ROLE_KEY` **só no script de seed** |
| B                 | Sempre dashboard, inclusive DEV                                                                                                  | Menos código de seed          | Fricção no `pnpm dev`                                                |
| C                 | Convite mínimo nesta spec                                                                                                        | Adianta a spec seguinte       | Escopo inchado                                                       |

---

## 4. Arquitetura

```text
Browser
  → /admin/login          @supabase/ssr (cookie)
  → /admin/*              layout confere sessão + profile
       → Server Actions   getSession → profiles.role ∈ {owner, manager}
            → Prisma      categories / products / product_images
            → Storage     upload com JWT da usuária (bucket product-images)
            → sharp       processImageBuffer (já existe)
  → vitrine               inalterada na leitura pública (force-dynamic)

proxy.ts (Next.js 16)
  → refresh do cookie Auth em toda request
  → redirect para /admin/login só em /admin/* (exceto login, recuperar-senha e atualizar-senha)
  → vitrine pública: sem gate
```

**Unidades (uma responsabilidade cada):**

| Unidade                   | Faz                                                              | Depende de                         | Consumidores            |
| ------------------------- | ---------------------------------------------------------------- | ---------------------------------- | ----------------------- |
| `lib/auth`                | Clientes SSR (browser/server/proxy), `requireStaff()`            | `@supabase/ssr`, Prisma `profiles` | layout admin, actions   |
| `lib/copy/admin-pt-br.ts` | Strings do painel                                                | —                                  | UI admin                |
| `domain/product-write`    | Regras: publicar, slug, preço, troca de categoria                | category-fields, price             | actions, testes         |
| `domain/category-write`   | Schema de campos (key imutável), exclusão com produtos           | category-fields                    | actions, testes         |
| `lib/catalog` (extensão)  | Queries admin (inclui draft + lixeira) **sem** predicado público | Prisma                             | pages admin             |
| `lib/images/upload`       | MIME/tamanho, `processImageBuffer`, sobe variantes               | sharp, Storage sessão              | actions de produto/capa |
| `components/admin`        | chrome, tabelas, forms, editor de campos, lixeira                | shadcn, copy                       | `app/admin`             |
| `PoweredByEquilibrium`    | Selo no login e no footer do chrome                              | —                                  | login, admin layout     |

Falha de Auth/Prisma no admin: página de erro com “Tentar novamente”, não stack. Sem sessão: `/admin/login`. Sessão sem linha em `profiles` ou papel fora de `owner`/`manager`: “sem acesso” + sair.

---

## 5. Stack extra (além da spec 1)

- `@supabase/ssr` + `@supabase/supabase-js` **somente** para Auth (login, recovery, sessão) e **Storage** (upload). Zero `.from('products')` no client.
- shadcn/ui no admin (formulário, tabela, dialog, toast, input, select). **Não** copiar a paleta default do shadcn para a vitrine: `components.json` aponta CSS do admin **ou** os tokens do branding resolvido no chrome. Separar o CSS da vitrine se o CLI do shadcn ainda apontar para `globals.css` da vitrine (risco já listado na spec 1).
- React Hook Form + Zod nos forms.
- Next.js 16: arquivo `src/proxy.ts` exportando `proxy` (não `middleware.ts`). `params` / `searchParams` continuam `Promise`.
- pnpm. Sem misturar lockfile.

---

## 6. Árvore de arquivos (alvo, só o que esta fatia acrescenta)

```text
src/
  proxy.ts
  app/admin/
    layout.tsx                 # chrome autenticado; branding resolvido
    login/page.tsx
    recuperar-senha/page.tsx
    atualizar-senha/page.tsx
    produtos/page.tsx          # home do admin
    produtos/novo/page.tsx
    produtos/[id]/page.tsx
    categorias/page.tsx
    categorias/novo/page.tsx
    categorias/[id]/page.tsx
    lixeira/page.tsx
  components/admin/
    admin-chrome.tsx
    product-form.tsx
    category-form.tsx
    fields-schema-editor.tsx
    image-gallery-editor.tsx
  lib/auth/
  lib/images/upload.ts
  domain/product-write.ts
  domain/category-write.ts
  lib/copy/admin-pt-br.ts
e2e/
  admin.spec.ts
```

Rotas da vitrine não mudam de contrato. `SiteFooter` da vitrine já usa o selo; não duplicar em cada page pública.

---

## 7. Auth, papéis e seed

Signup **continua desligado** no painel Authentication do projeto.

- Login: e-mail + senha.
- “Esqueci a senha”: `resetPasswordForEmail` com redirect para `/admin/atualizar-senha` no `NEXT_PUBLIC_SITE_URL`. Essa página é pública (sessão de recovery do Auth no client). Sem cadastro público.
- Cookie httpOnly via `@supabase/ssr`.
- Papel: coluna `profiles.role`. Trigger `handle_new_user` (spec 1) ainda insere `manager` em todo `auth.users` novo.
- Nesta fatia `owner` e `manager` têm o **mesmo** poder de catálogo (CRUD categoria/produto/imagem/lixeira). Não há telas de branding/usuárias para diferenciar. A checagem de papel existe para a spec seguinte não ter de inventar o gate.

**Seed DEV (obrigatório):**

1. Lê `ADMIN_SEED_EMAIL` e `ADMIN_SEED_PASSWORD`.
2. Com `SUPABASE_SERVICE_ROLE_KEY` **só neste script**, `auth.admin.createUser` (e-mail confirmado). Se o usuário já existe, não falha.
3. Faz `profiles.role = 'owner'` nesse `id`.
4. Não loga a senha. Não usa service role em Server Action, Route Handler ou Client Component.

**Loja cliente:** README: criar usuária no dashboard Auth → o trigger gera `manager` → SQL pontual (documentado) promove a `owner`. Sem self-signup.

Env nova (`.env.example` sem valores):

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ADMIN_SEED_EMAIL=
ADMIN_SEED_PASSWORD=
# Só seed / scripts. Nunca NEXT_PUBLIC_. Nunca no runtime Next.
SUPABASE_SERVICE_ROLE_KEY=
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` é chave **publicável** (Auth no browser). Não é service role.

---

## 8. Schema e RLS (o que muda)

Herdar tabelas da spec 1. Esta fatia acrescenta:

### 8.1 Categorias — capa

- `cover_storage_path text null` (objeto no bucket, para substituir/apagar).
- `cover_image_url` continua sendo a URL pública da variante **card** (vitrine).
- Upload da capa = mesmo `processImageBuffer` (JPEG/PNG/WebP, lado menor ≥ 800px). HEIC recusado.

### 8.2 Slugs

Índices únicos parciais da spec 1 (`deleted_at is null`) **já existem**. O admin respeita: slug editável, kebab a partir do nome, colisão → erro em português (“este endereço já está em uso”). Item na lixeira **não** bloqueia o slug (índice parcial).

Trocar slug de item **publicado**: aviso de que o link antigo deixa de abrir. Sem redirect nesta spec.

### 8.3 RLS (defesa PostgREST)

Manter SELECT público da spec 1.

Acrescentar, com predicado `public.is_staff()` = existe `profiles` com `id = auth.uid()` e `role in ('owner','manager')`:

| Tabela           | authenticated staff                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `categories`     | SELECT/INSERT/UPDATE (inclui inativas e lixeira)                                                |
| `products`       | SELECT/INSERT/UPDATE (draft + lixeira)                                                          |
| `product_images` | SELECT/INSERT/UPDATE/DELETE da linha (soft delete do produto **não** apaga arquivos nesta spec) |
| `profiles`       | SELECT **só a própria** linha (`id = auth.uid()`)                                               |
| `store_settings` | SELECT (já público); escrita **não** nesta spec                                                 |

Sem `DELETE` físico nas tabelas de catálogo no fluxo normal (soft delete via `deleted_at`). `product_images`: remover foto no editor pode `DELETE` a linha (e o objeto no Storage); não é soft delete de imagem.

Storage (`product-images`):

- SELECT público em `variants/**` (já existe).
- INSERT/UPDATE/DELETE em `originals/**` e `variants/**` para `authenticated` + `is_staff()`.
- Paths: `originals/{productId\|categories}/{uuid}` e `variants/{productId\|categories}/{uuid}-{variant}.webp`. UUID no path; rascunho não é secreto, só unlisted.

GRANT: `authenticated` recebe INSERT/UPDATE necessários. `anon` permanece só SELECT público.

---

## 9. Regras de escrita (domínio)

### 9.1 Produto

- Status: `draft` \| `published`.
- **Salvar rascunho:** incompleto ok (0 fotos, required vazios, sem preço).
- **Publicar** (e re-publicar) exige, senão recusa em português:
  - ≥ 2 imagens na galeria
  - todo campo `required` do `fields_schema` da categoria preenchido
  - slug válido e único entre não deletados
  - `promo_price` só com `price`; `promo_price < price` (check já no banco)
- Sem preço → vitrine “Sob consulta”; some `{price}` no WhatsApp (já na spec 1).
- Categoria obrigatória. **Trocar categoria:** confirmação; `attributes` com chaves que o schema novo não tem **permanecem no JSON**; o form só mostra as chaves do schema atual.
- Destaque = `is_featured`.
- Excluir = `deleted_at = now()`, some da vitrine (predicado público). Restaurar zera `deleted_at`. Se o slug colidir com outro ativo, restaurar falha com mensagem para editar o slug.

### 9.2 Categoria

- Nome, slug, descrição, capa, `is_active`, `sort_order`.
- **Editor de campos:** tipos `text`, `textarea`, `number`, `select`, `multiselect`, `boolean`, `url`. Sem `group`. `required` em qualquer tipo. **`filterable` só na UI para `select`, `multiselect` e `boolean`** (é o que a vitrine aceita como facet na URL; spec 1). Select/multiselect exigem `options` não vazias. `key` = `[a-z0-9_]+`, único na categoria, **imutável depois de criado**. Label, filterable, required, options e ordem podem mudar. Remover uma option **não** limpa produtos que ainda têm o valor. Remover um campo do schema **não** apaga a chave em `attributes`.
- Duplicar categoria: copia `fields_schema` (e metadados visuais), **não** copia produtos; slug novo sugerido (`-copia` + sufixo se colidir).
- Sugestões ao criar campo (dica de UI, não modelo): cor, tamanho, composição, medidas (`busto_cm`, etc.) — copy, não enum no banco.
- **Excluir** (lixeira): bloqueado se existir produto com `deleted_at is null` nessa categoria. Mensagem: mover ou excluir os produtos antes.
- Categoria inativa: some da vitrine (já na spec 1) mesmo com produtos publicados.

### 9.3 Imagens de produto

- Ordem = `sort_order` (capa da vitrine = menor). Reordenar no editor.
- Remover foto: apaga linha + objetos no bucket.
- Falha: lado &lt; 800px, HEIC, MIME fora de JPEG/PNG/WebP, arquivo &gt; **8 MB** → toast/texto em pt-BR (a action traduz o erro de `processImageBuffer`).

---

## 10. UX do painel

**Princípios:** tarefa rápida; português curto; botão nomeia a ação (“Salvar rascunho”, “Publicar”, “Mover para a lixeira”); confirmação só em excluir, publicar e trocar categoria; erros dizem o que faltou. Área de clique no padrão shadcn (min ~44px). Sem JSON visível. Slug rotulado **“endereço na loja”** com preview ` /produto/{slug}` ou `/colecao/{slug}`.

**Chrome** (autenticado): logo + nome do branding **resolvido**, nav **Produtos / Categorias / Lixeira**, sair. Rodapé: `PoweredByEquilibrium` `variant="footer"`, `label` = “Fornecido por”, `showTextFallback={false}`. Sem selo no header, card ou form.

**Login:** mesmo branding resolvido + selo. Sessão válida → `/admin/produtos`. Sem “criar conta”.

**Home = lista de produtos:** capa, nome, categoria, preço ou “Sob consulta”, status, destaque, atualizado. Filtros: categoria, status (rascunho/publicado), busca por nome. “Novo produto”. Editar; mover para lixeira. Lista: 30 itens + “carregar mais” (não infinite scroll). Offset no admin é aceitável (catálogo &lt; 1k).

**Form produto:** categoria no topo (define os campos). Depois nome, endereço na loja, preço/promo, destaque, atributos, galeria.

**Categorias:** lista (nome, slug, ativa, qtd produtos, ordem). Form + editor de campos. Duplicar.

**Lixeira:** abas ou filtro produtos | categorias. Restaurar. Texto: itens ficam até ~30 dias; esvaziar automático **não** roda nesta spec.

Vitrine: `force-dynamic` já cobre publicação imediata.

Estilo customizado do admin: **fora**. Flag futura, caso a caso; `flags.config.ts` continua vazio / nenhuma flag ligada.

---

## 11. Copy e idioma

Novo módulo `src/lib/copy/admin-pt-br.ts`. Nada de string crua no JSX do admin. Identificadores de código em inglês. UI pt-BR. Sem `next-intl`.

---

## 12. Testes

**Vitest (domínio):**

- Publicar sem 2 fotos falha; required vazio falha.
- `promo_price` sem `price` falha.
- Slug duplicado (entre não deletados) falha.
- Categoria com produto ativo não vai para a lixeira.
- Troca de categoria não apaga `attributes` órfãos.
- `key` de campo existente não pode ser alterada; schema Zod rejeita `group` e select sem options (já na spec 1; manter).
- Upload: rejeita buffer HEIC e &lt; 800px (já existe); action mapeia para copy pt-BR.

**Playwright (`e2e/admin.spec.ts` + vitrine existente continua passando):**

1. Visitante em `/admin/produtos` → login.
2. Login com seed DEV → lista de produtos.
3. Criar categoria com um campo `select` filterable.
4. Criar rascunho de produto (1 foto) → não aparece na vitrine.
5. Segunda foto + publicar → aparece na vitrine / coleção.
6. Mover para lixeira → some da vitrine; restaurar → volta.
7. Logout → `/admin/produtos` exige login de novo.
8. Sem rota de cadastro público (`/admin/login` não oferece criar conta).

E2e usa `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` do env de teste. GTM vazio como na spec 1.

---

## 13. Critérios de aceite

1. Seed DEV cria (ou reusa) owner; README descreve o primeiro acesso no cliente (dashboard + SQL de papel).
2. Login, recuperar senha (fluxo pedido de e-mail) e logout funcionam.
3. `owner` e `manager` entram no catálogo; sem profile/papel → sem acesso, não 500.
4. CRUD de categoria com editor de campos; duplicar copia o schema; filtro `filterable` novo aparece na vitrine após publicar produto que o usa.
5. CRUD de produto com galeria; publicar exige ≥ 2 fotos e required; rascunho incompleto salva.
6. Capa de categoria sobe pelo pipeline (não URL colada).
7. Lixeira restaura; vitrine não lista item deletado nem draft.
8. Slug único entre ativos; jargão “endereço na loja” na UI.
9. Selo Equilibrium no login e no rodapé do admin; vitrine inalterada nesse ponto.
10. Sem `service_role` no bundle/runtime Next. `pnpm check` + `pnpm test:e2e` passam.
11. Nenhuma flag de estilo/cliente ligada. Nenhum editor de CSS do admin.

---

## 14. Riscos deste recorte

| Risco                                                     | Mitigação                                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Variantes públicas vazam foto de rascunho por URL         | Path com UUID; não tratar foto de produto como segredo                                    |
| Service role vazar para o app                             | Só no `prisma/seed.ts`; lint/review; `.env` gitignored                                    |
| CLI shadcn reescrever CSS da vitrine                      | CSS do admin separado **antes** do primeiro `shadcn add` desta fatia                      |
| Trigger cria `manager` e o seed esquece de promover owner | Seed falha se o profile final não for `owner`                                             |
| `proxy.ts` gate na vitrine                                | Matcher redireciona **apenas** `/admin/*` autenticado; refresh de cookie pode rodar amplo |

---

## 15. O que a spec seguinte herda

- Sessão, `requireStaff()`, chrome, selo, upload, editor de campos, lixeira simples
- Policies `is_staff()` e Storage autenticado

Spec seguinte (não esta): convite/gestão de usuárias; editor de branding e legais; diferença real owner vs manager nas telas sensíveis.

Depois: campanhas; auditoria + restore em 2 cliques; purge 30 dias; flags de estilo por cliente.
