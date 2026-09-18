# Catálogo Digital

Catálogo de **exibição** para lojas de roupa: vitrine pública com filtros e compartilhamento, mais um admin para a loja cadastrar produtos sem depender de desenvolvimento.

Quem vê o catálogo chama a loja no **WhatsApp**. Não há carrinho nem checkout.

Mantido pela **Equilibrium Tecnologia**. Um repositório, uma branch e um projeto Supabase por cliente. Primeiro cliente: **Mariah's Boutique**.

---

## Estado atual (set/2026)

Restart de produto. O zip da Fase 0 **não está neste disco**. Ainda não há app Next.js.

Perguntas da rodada inicial **estão respondidas**. Spec 1 escrito, aguardando aprovação: [`docs/superpowers/specs/2026-09-18-fundacao-e-vitrine-design.md`](./docs/superpowers/specs/2026-09-18-fundacao-e-vitrine-design.md).

| Caminho | Função |
| --- | --- |
| [`CLAUDE.md`](./CLAUDE.md) | Instruções para agentes |
| [`AGENTS.md`](./AGENTS.md) | Atalho para o mesmo arquivo |
| [`docs/superpowers/00-contexto-e-decisoes.md`](./docs/superpowers/00-contexto-e-decisoes.md) | Memória de produto (decisões travadas) |
| [`docs/superpowers/02-respostas-das-perguntas-abertas.md`](./docs/superpowers/02-respostas-das-perguntas-abertas.md) | Respostas da rodada |
| [`docs/superpowers/01-perguntas-abertas.md`](./docs/superpowers/01-perguntas-abertas.md) | Questionário original (histórico) |
| [`docs/superpowers/specs/2026-09-18-fundacao-e-vitrine-design.md`](./docs/superpowers/specs/2026-09-18-fundacao-e-vitrine-design.md) | Spec 1 — fundação + vitrine |
| [`docs/misc/`](./docs/misc/) | Arquivo morto da conversa Kimi. **Não é o código-fonte.** |

**Próximo passo:** revisar o spec. Sem scaffold até ele ser aprovado.

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
- Primeiro spec = fundação + vitrine (seed). Admin no spec seguinte.
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

## Quando o app existir

O scaffold e o `.env.example` saem do spec/plano. Até lá **não** rode `pnpm dev` neste diretório — não há `package.json`.

Rascunho histórico de variáveis: [`docs/misc/env.example`](./docs/misc/env.example).

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
