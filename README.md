# Catálogo Digital

Catálogo de **exibição** para lojas de roupa: vitrine pública com filtros e compartilhamento, mais um admin para a loja cadastrar produtos sem depender de desenvolvimento.

Quem vê o catálogo chama a loja no **WhatsApp**. Não há carrinho nem checkout.

Mantido pela **Equilibrium Tecnologia**. Um repositório, uma branch e um projeto Supabase por cliente. Primeiro cliente: **Mariah's Boutique**.

---

## Estado atual (set/2026)

Spec 1 **aprovada** e implementada: vitrine pública (home, coleção com filtros na URL, produto, WhatsApp, GTM/consent, páginas legais, sitemap/robots). Plano concluído: [`docs/superpowers/plans/2026-09-18-fundacao-e-vitrine.md`](./docs/superpowers/plans/2026-09-18-fundacao-e-vitrine.md).

Spec 2 (admin — login + CRUD de catálogo) **implementada na branch `local`**, ainda sem commit. Design: [`docs/superpowers/specs/2026-09-21-admin-catalogo-design.md`](./docs/superpowers/specs/2026-09-21-admin-catalogo-design.md). Plano: [`docs/superpowers/plans/2026-09-22-admin-catalogo.md`](./docs/superpowers/plans/2026-09-22-admin-catalogo.md). Entrada do painel: **`/admin/login`**. Sem cadastro público (self-signup desligado no Auth).

Trabalho na branch `local` (`main` = produto, `dev` = homologação). **Próximo spec:** fluxo de convite e editores de branding/legais no admin (fora do escopo atual).

| Caminho | Função |
| --- | --- |
| [`CLAUDE.md`](./CLAUDE.md) | Instruções para agentes |
| [`AGENTS.md`](./AGENTS.md) | Atalho para o mesmo arquivo |
| [`docs/superpowers/00-contexto-e-decisoes.md`](./docs/superpowers/00-contexto-e-decisoes.md) | Memória de produto (decisões travadas) |
| [`docs/superpowers/02-respostas-das-perguntas-abertas.md`](./docs/superpowers/02-respostas-das-perguntas-abertas.md) | Respostas da rodada |
| [`docs/superpowers/01-perguntas-abertas.md`](./docs/superpowers/01-perguntas-abertas.md) | Questionário original (histórico) |
| [`docs/superpowers/specs/2026-09-18-fundacao-e-vitrine-design.md`](./docs/superpowers/specs/2026-09-18-fundacao-e-vitrine-design.md) | Spec 1 — fundação + vitrine |
| [`docs/superpowers/specs/2026-09-21-admin-catalogo-design.md`](./docs/superpowers/specs/2026-09-21-admin-catalogo-design.md) | Spec 2 — admin catálogo |
| [`docs/misc/`](./docs/misc/) | Arquivo morto da conversa Kimi. **Não é o código-fonte.** |

---

## O produto, em uma frase

A atendente manda um link (home, categoria filtrada ou produto). A cliente abre no celular, filtra, vê fotos e preço (ou “Sob consulta”) e toca em **Chamar no WhatsApp**.

A dona da loja gerencia isso num painel: categorias com campos próprios, produtos, imagens WebP, branding, textos legais e campanhas.

O modelo serve **qualquer loja de roupa**. Mariah's Boutique (moda feminina, plus size) é o primeiro deploy, não o limite do produto.

---

## Decisões travadas (resumo)

- Exibição; conversão WhatsApp (banco + env fallback).
- **Next.js 16** (App Router, TypeScript, `src/`) + React 19 + Tailwind + **pnpm**.
- **Supabase** (Postgres, Auth, Storage, RLS) + `sharp` no Next → WebP público.
- Host: **Vercel** (1 projeto por `cliente-*`). Subdomínio Equilibrium; domínio próprio opcional.
- Admin: shadcn/ui + Zod + RHF. Vitrine: layout próprio sobre tokens de branding.
- Branding em camadas: banco → `branding.config.json` (Equilibrium no `main`) → fallback.
- Campos planos por categoria; filtros públicos saem do schema. Sem tipo `group` no MVP.
- GTM + Consent Mode v2 + banner; páginas legais no banco (padrão Equilibrium).
- Spec 1 = fundação + vitrine (seed). Spec 2 (admin de catálogo) implementada; próximo spec: convite e branding.
- Testes: Vitest + Playwright. Só pt-BR.

Detalhe: [`docs/superpowers/00-contexto-e-decisoes.md`](./docs/superpowers/00-contexto-e-decisoes.md).

---

## Modelo de branches

```
main              produto global
 └─ dev           homologação global
 └─ cliente-<id>  deploy da loja: 1 Supabase + 1 Vercel + subdomínio
```

- Feature de todos: `dev` → `main` → merge nas branches `cliente-*`.
- Feature de um cliente: na branch dele, com feature flag.
- Divergência de código é exceção; divergência de configuração é regra.

---

## Stack

- Next.js 16 App Router + TypeScript + React 19
- Tailwind CSS · shadcn/ui (admin) · Zod · React Hook Form
- Supabase (Postgres + Auth + Storage + RLS)
- `sharp` (variantes WebP)
- Vitest · Playwright
- pnpm
- Vercel

---

## Setup local (vitrine e admin no DEV)

Requisitos: **Node.js** (LTS) e **pnpm 11.16.0** (`packageManager` no `package.json`). O `postinstall` já gera o Prisma Client.

1. **Dependências**

   ```bash
   pnpm install
   ```

2. **Variáveis de ambiente**

   Copie [`.env.example`](./.env.example) para `.env` (o `.env` já está no `.gitignore`). Preencha as chaves do projeto Supabase de **desenvolvimento**:

   **Vitrine**

   - `DATABASE_URL`, `DIRECT_URL` — Postgres (pooler + sessão)
   - `NEXT_PUBLIC_SITE_URL` — ex.: `http://localhost:3000`
   - `WHATSAPP_NUMBER` — só dígitos (fallback; o valor efetivo vem do banco)
   - `NEXT_PUBLIC_GTM_ID` — vazio desliga o container
   - `FLAGS_JSON` — override de feature flags (opcional)

   **Admin (spec 2)**

   - `NEXT_PUBLIC_SUPABASE_URL` — URL do projeto (pública)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — chave **anon** (pública; usada no login do admin no browser)
   - `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` — credenciais da usuária **owner** criada pelo seed (somente DEV)
   - `SUPABASE_SERVICE_ROLE_KEY` — chave **service role**; **somente** em `prisma/seed.ts` para criar a owner no Auth. Não é `NEXT_PUBLIC_` e **não** deve aparecer em `src/`.

   Dicas de pooler (portas 6543/5432), `sslmode`, IPv6 e percent-encoding na senha estão comentadas em [`.env.example`](./.env.example). **Não** coloque secrets neste README nem commite o `.env`.

3. **Banco (somente projeto DEV)**

   ```bash
   pnpm exec prisma migrate deploy
   pnpm exec prisma db seed
   ```

   O comando `pnpm exec prisma db seed` cria a usuária **owner** do ambiente DEV no Supabase Auth (usando `ADMIN_SEED_*` e a service role **apenas** no script de seed).

   **Reset de banco, `prisma migrate reset`, `db reset` ou qualquer migrate destrutivo: somente no projeto Supabase de desenvolvimento. Nunca no banco de um cliente.**

4. **Servidor de desenvolvimento**

   ```bash
   pnpm dev
   ```

   Vitrine: [http://localhost:3000](http://localhost:3000). Admin: [http://localhost:3000/admin/login](http://localhost:3000/admin/login).

5. **Admin no DEV**

   Com o seed concluído, entre em `/admin/login` com o e-mail e a senha de `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`. Não há página de cadastro público; o signup permanece desligado no dashboard do Supabase Auth.

6. **Primeiro acesso em projeto de cliente**

   Para a loja em produção (signup off): crie a usuária manualmente no **Supabase Auth** (dashboard). O trigger de perfil deixa o papel inicial como `manager`. Promova a dona da loja com SQL no SQL Editor (ajuste o e-mail):

   ```sql
   UPDATE public.profiles SET role = 'owner' WHERE email = 'email-da-loja';
   ```

   Depois disso, ela acessa `/admin/login` no domínio da loja.

7. **Testes e checagens**

   ```bash
   pnpm test          # Vitest (domínio)
   pnpm test:e2e      # Playwright (vitrine; sobe pnpm dev via webServer)
   pnpm check         # lint + typecheck + test
   ```

Schema e seed: `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`. RLS e bucket de Storage vivem nas migrations Prisma — **não** há pasta `supabase/` neste spec.

---

## Documentação Superpowers

```
docs/superpowers/
  00-contexto-e-decisoes.md      memória de produto
  01-perguntas-abertas.md        questionário (histórico)
  02-respostas-das-perguntas-abertas.md
  specs/2026-09-18-fundacao-e-vitrine-design.md
  plans/                         plano depois do spec aprovado
docs/misc/                       arquivo morto
```

---

## Licença e operação

Repositório privado da Equilibrium Tecnologia. Cada loja recebe o sistema; infraestrutura e chaves ficam com a Equilibrium.
