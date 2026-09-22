# CLAUDE.md — Catálogo Digital

Instruções permanentes para qualquer agente (Claude Code, Cursor, Codex) neste repositório.

Leia isto **antes** de explorar código, tirar dúvidas soltas ou implementar.

---

## Estado do repo

- Next.js 16 na **raiz** com vitrine do spec 1 e **spec 2** (login + CRUD de catálogo no admin) implementados na branch `local`, ainda **sem commit**. Vitrine: home, coleção (filtros na URL), produto, CTA WhatsApp, branding em leitura, GTM/consent, páginas legais, `sitemap`/`robots`. Admin: `/admin/login`, categorias, campos, produtos, imagens, publicar/lixeira — sem self-signup público. Dados via **seed** no Supabase DEV (`prisma migrate` + `prisma db seed`). **Próximo spec:** editores de convite e branding (fora desta entrega).
- Prisma: `prisma/schema.prisma`, migrations em `prisma/migrations/` (inclui RLS e bucket). **Sem** pasta `supabase/` neste spec.
- Trabalho na branch `local` (derivada de `main`). Também existe `dev`.
- O zip da “Fase 0” da conversa com Kimi **não está neste disco**.
- `docs/misc/` é **histórico**. Não trate PRD/SQL/README de lá como fonte da verdade nem os copie para a raiz.
- Perguntas da rodada inicial **estão respondidas** em `docs/superpowers/02-respostas-das-perguntas-abertas.md`.

**Spec 1 aprovada e implementada:** `docs/superpowers/specs/2026-09-18-fundacao-e-vitrine-design.md`.  
**Plano (concluído):** `docs/superpowers/plans/2026-09-18-fundacao-e-vitrine.md`.  
Setup humano: `README.md`.

**Supabase:** reset permitido só no projeto de desenvolvimento. Jamais `db reset` / `migrate reset` em banco de cliente.

---

## O que é este projeto

Catálogo de **exibição** (sem checkout) para **lojas de roupa em geral**. Primeiro cliente: **Mariah's Boutique**.

- Vitrine pública: filtros, busca, ordenação, links compartilháveis, CTA WhatsApp, GTM/LGPD, páginas legais.
- Admin (spec seguinte): categorias com campos configuráveis, produtos, imagens, branding, legais, usuários, campanhas, auditoria.
- Operação: `main` / `dev` / `cliente-*` + **um projeto Supabase e um projeto Vercel por loja**.

Memória de produto: `docs/superpowers/00-contexto-e-decisoes.md`.  
Visão humana: `README.md`.

---

## Fluxo Superpowers (obrigatório)

1. ~~Perguntas~~ — feitas.
2. **Brainstorming → spec** da fatia atual. Aguardar aprovação.
3. **Plano** em `docs/superpowers/plans/` (`writing-plans`). Aguardar aceite.
4. **Implementação** só a partir do plano (TDD / `subagent-driven-development` ou `executing-plans`).

Primeiro spec = **fundação + vitrine pública mínima** (home, categoria, produto, WhatsApp, branding em leitura, imagens, GTM/LGPD, legais em leitura). Dados via **seed**. Admin CRUD é o spec 2.

---

## Regras de produto (não negociar sozinho)

- Sem carrinho, checkout, pagamento, estoque por SKU, ERP, marketplace, app nativo.
- Sem `tenant_id` / SaaS multi-loja no mesmo banco.
- Conversão = WhatsApp. Valor efetivo no banco; `WHATSAPP_NUMBER` só fallback. Nunca hardcode.
- Preço opcional → “Sob consulta”. `promo_price` exige preço base.
- Paginação: “carregar mais”, não infinite scroll.
- Filtros públicos = campos `filterable` do schema da categoria. URL compartilhável.
- Tipos de campo no MVP: `text`, `textarea`, `number`, `select`, `multiselect`, `boolean`, `url`. Sem `group`.
- Soft delete. Não `DELETE` físico no fluxo normal.
- Feature exclusiva: **flag**, não `if (cliente === 'x')`. Nenhuma flag de cliente ligada ainda.
- Branding: merge profundo banco → `branding.config.json` (Equilibrium no `main`) → fallback. Falha de DB na vitrine serve o JSON, não quebra.
- Legais: mesma resolução em camadas (banco → padrão Equilibrium).
- Admin usa branding **resolvido**. Rodapé: componente `PoweredByEquilibrium`.
- pt-BR. Sem `next-intl`. Copy em módulo/constantes.
- Idioma de commit, spec e UI: português; identificadores de código em inglês (`snake_case` SQL, `kebab-case` arquivos).
- Vitrine: visual autoral minimalista/editorial (refs Drive New York / Poolside store — clima, não cópia). shadcn na vitrine só em dialog/input/toast.
- Usuárias: sem self-signup. Convite + gestão no admin (spec 2), sem SQL no dia a dia.

---

## Stack e skills (travadas)

| Área | Usar |
| --- | --- |
| App | **Next.js 16**, App Router, TypeScript, `src/`, React 19 |
| Pacotes | **pnpm** — nunca misturar lockfile |
| Admin UI | Tailwind + **shadcn/ui** + Zod + React Hook Form |
| Dados | **Prisma ORM** no servidor → Postgres do Supabase DEV. RLS ligado (defesa PostgREST). Sem supabase-js neste spec |
| Imagens | `sharp` no Next (Server Action / rota Node) → WebP público |
| Host | Vercel |
| Testes | Vitest (domínio) + Playwright (fluxos críticos) |
| Analytics | skill `next-gtm-lgpd-bootstrap` **adaptada**: banner, Consent Mode v2, GTM, `whatsapp_click`. **Sem** form de lead nem `/obrigado` |
| Docs de lib | Context7 MCP (Next, Prisma, Tailwind, shadcn) |
| Planejamento | sequentialthinking em tarefa multi-passo |
| Supabase | skill `supabase` + `supabase-postgres-best-practices` **antes** de SQL/RLS |
| Qualidade web | browser ou Playwright em fluxo que muda UI |

Não pin Next 15 nem npm. SQL em `docs/misc/0002_core_tables.sql` não é canônico.

---

## Segurança (quando houver código)

- Nunca commitar `.env`, service role, tokens.
- Sem `service_role` no runtime da vitrine. Nada de `NEXT_PUBLIC_` em segredo. `DATABASE_URL` / `DIRECT_URL` só no servidor.
- Autorização **não** lê `user_metadata`. Papel em `profiles` / `app_metadata` conforme o spec.
- RLS em toda tabela exposta. `TO authenticated` **com** predicado de papel; `anon` só lê publicado e não deletado.
- Views com `security_invoker` se existirem.
- Upload: validar MIME e tamanho no servidor.
- Não logar PII nem chaves.

---

## Git

- Só commitar se o humano pedir.
- Sem `--no-verify`, force push em `main`, ou amend de commit que não é desta conversa.
- Branches alvo: `main`, `dev`, `cliente-*`, `feat/*` a partir da branch certa.

---

## O que não fazer

- Não “recuperar” o zip inventando a Fase 0.
- Não promover `docs/misc/PRD-catalogo-moda.md` a spec. É insumo.
- Não aplicar `docs/misc/0002_core_tables.sql` como migration canônica.
- Não implementar “só um pedacinho” para adiantar.
- Não meter admin CRUD, convite, campanhas ou restore no spec da vitrine.
- Não usar APIs de Next/Supabase de memória: Context7 / docs atuais.
- Não copiar o visual retrô do Poolside FM; a âncora de catálogo é o Drive New York (minimal, editorial, funcional).

---

## Ordem de leitura em qualquer tarefa

1. Este arquivo  
2. `docs/superpowers/00-contexto-e-decisoes.md`  
3. `docs/superpowers/02-respostas-das-perguntas-abertas.md`  
4. Spec vigente em `docs/superpowers/specs/`, se houver  
5. Plano vigente em `docs/superpowers/plans/`, se houver  
6. `README.md`  
7. Código da tarefa  

Cursor: `.cursor/rules/catalogo-digital.mdc` aponta para cá.
