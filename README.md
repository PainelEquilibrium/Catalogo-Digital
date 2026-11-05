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

## Imagens: originais privados e variantes públicas (16/10/2026)

O original permanece privado em `product-images/originals/**`. As quatro variantes WebP (`thumb`, `card`, `detail`, `og`) ficam em `product-image-variants/variants/**`, com download público sem sessão. O runtime usa a sessão de staff para escrever/remover. URLs de rascunhos conhecidas continuam públicas; despublicação e lixeira não revogam URLs nem caches externos. Soft delete/restauração preserva os arquivos. Remoção física pode deixar conteúdo em cache após a exclusão.

A migration `20261016180000_image_storage_buckets` provisiona bucket e policies. No Dashboard, a alternativa é criar configuração equivalente, conferir visibilidade, prefixos e policies e executar a migration versionada. Não editar histórico/checksum nem marcar migration aplicada sem comprovar equivalência. O bucket público nunca deve receber originais. A proteção adicional de UPDATE está em `20261017150000_prevent_image_bucket_changes`: trigger `SECURITY INVOKER` bloqueia mudança de bucket envolvendo os dois buckets e permite UPDATE no mesmo bucket. Por atuar no schema gerenciado do Supabase, exige revisão em manutenção futura do Storage ou antes de autorizar movimentação entre buckets.

### Corte operacional

Somente o DEV `fzmnuodimupkmptdvfee` foi autorizado nesta entrega. Cliente/produção exige antes pacote concreto: backup de banco e objetos Storage, inventário de Auth/config/policies necessários, restauração isolada validada, manifesto e simulação revisados; obter aprovação explícita desse pacote antes de executar. Nunca resetar banco de cliente.

1. Pausar uploads, substituições e remoções em **todas** as instâncias; aguardar operações em voo. Leituras podem continuar.
2. Confirmar projeto/URLs de conexão e registrar estado/backup. Provisionar bucket/policies pela migration.
3. Gerar inventário/simulação com a CLI. Revisar elegíveis, ignorados, órfãos, ausências, hashes, conflitos e falhas; não presumir que o registro investigado em 16/10 ainda é elegível. Conjunto incompleto bloqueia atualização; não há regeneração automática.
4. Copiar/verificar com `--apply --copy-only`; conferir download público sem credenciais, WebP e SHA-256. Não sobrescrever destino divergente nem apagar legado.
5. Disponibilizar código compatível com os dois layouts. Executar `--apply` para atualizar referências condicionalmente, somente quando ainda correspondem ao manifesto. Essa segunda fase altera o banco.
6. Comprovar permissões e carregamento real no admin/vitrine/OG/otimizador. Revisar contagens e pendências; então retomar mutações.

Com ambiente preparado fora do Git (`DATABASE_URL`, URL/chave pública do Supabase e `IMAGE_MIGRATION_ACCESS_TOKEN` de sessão staff), a simulação padrão usa destino novo ignorado pelo Git:

```bash
pnpm exec tsx scripts/migrate-image-variants.ts --project-ref fzmnuodimupkmptdvfee --manifest .superpowers/sdd/2026-10-16-separacao-buckets-imagens/inventory-dev.json
# Somente após implementação/revisão da fase apply e revisão do manifesto:
pnpm exec tsx scripts/migrate-image-variants.ts --project-ref fzmnuodimupkmptdvfee --manifest .superpowers/sdd/2026-10-16-separacao-buckets-imagens/inventory-dev.json --apply --copy-only
pnpm exec tsx scripts/migrate-image-variants.ts --project-ref fzmnuodimupkmptdvfee --manifest .superpowers/sdd/2026-10-16-separacao-buckets-imagens/inventory-dev.json --apply
```

O manifesto e seu journal contêm dados operacionais: preservar fora do Git, assim como tokens, credenciais e dumps. Revisar o journal após interrupção antes de reexecutar. Não apresentar comandos documentados como execução concluída.

### Variante OG em JPG

`scripts/migrate-og-to-jpg.ts` gera `variants/<entidade>/<uuid>-og.jpg` a partir do original privado e aponta `og_url` (produtos) e `cover_og_url` (categorias) para ele. Simulação por padrão; `--apply` grava. Ordem: upload do JPG, depois update condicional e enfileiramento do `-og.webp` antigo na mesma transação (a fila diária remove o WebP; o script não drena). Falha de uma foto remove o JPG recém-criado e segue para as outras. Linhas já em `.jpg` e originais fora do padrão (seed) são puladas, então repetir é seguro. Sem rollback automático. Usa a chave de serviço do `.env` e a mesma checagem de projeto da transição acima (só o DEV `fzmnuodimupkmptdvfee`).

```bash
pnpm exec tsx scripts/migrate-og-to-jpg.ts --project-ref fzmnuodimupkmptdvfee
pnpm exec tsx scripts/migrate-og-to-jpg.ts --project-ref fzmnuodimupkmptdvfee --apply
```

### Retorno condicional

Pausar mutações, simular com `--rollback` (sem `--apply`), revisar conflitos e só então executar `--rollback --apply` sobre o mesmo manifesto. Atualizar apenas referências ainda correspondentes às URLs novas registradas; não sobrescrever edições posteriores. O retorno recupera URLs antigas possivelmente inválidas, sem garantir exibição funcional. Manter os dois buckets e suporte aos dois layouts, sobretudo após novos uploads. Não retornar isoladamente para código de bucket único nem excluir o bucket público.

### Provas e limites

```bash
pnpm check
pnpm build
pnpm exec playwright test e2e/admin.spec.ts e2e/vitrine.spec.ts
# Somente com configuração opt-in do DEV conferida:
pnpm exec vitest run src/lib/images/storage-policies.integration.test.ts
```

A matriz Storage só roda com `RUN_STORAGE_INTEGRATION=1`, `STORAGE_DEV_PROJECT_REF`, `STORAGE_DEV_CONFIRM=DEV:<ref>` e credenciais isoladas de owner/manager/nonstaff descritas no teste. O nonstaff precisa existir no Auth sem perfil de staff. `STORAGE_LEGACY_VARIANT_PATH` e `STORAGE_LEGACY_VARIANT_MANAGER_PATH` identificam fixtures legadas descartáveis, distintas e previamente provisionadas: o teste consome/remove essas fixtures; reprovisionar novos objetos antes de repetir. Não usar objetos reais de catálogo como fixture. Mocks unitários não comprovam RLS.

O E2E admin cria sua categoria/produto e usa `public/images/clothes-placeholder-imagem.webp`; aguarda lazy loading e `complete && naturalWidth > 0`, incluindo editor/listagem, home/coleção, galeria e capas. Downloads usam contexto sem cookies; OG e `/_next/image` exigem HTTP 200 e conteúdo de imagem. As simulações de aviso de limpeza e falha da terceira capa são interceptações restritas ao E2E: comprovam comportamento da UI, enquanto falhas Storage são verificadas nos testes unitários e permissões na matriz real. Não adicionar mecanismos de falha ao runtime.

**Atualização em 17/10/2026 — implementação e corte DEV concluídos.** A migration adicional `20261017150000_prevent_image_bucket_changes` foi aplicada no DEV; repetição sem pendências. O P1 de UPDATE entre buckets foi corrigido: quatro falhas RED → matriz RLS real GREEN 7/7 em 49,2 s (quatro novas e três anteriores), substituindo a evidência anterior de 3 PASS de 16/10. `pnpm check` atual: 180 PASS/7 opt-in SKIP, typecheck aprovado e lint sem erros (9 warnings preexistentes); build aprovado com 16 páginas. Transição e ações mantêm as auditorias registradas de 48 PASS e 14 PASS. Estes são resultados confirmados pela coordenação, não novas execuções desta atualização documental.

A leitura remota confirmou buckets privado/público corretos e 76 variantes copiadas. A retomada copy-only com o manifesto anterior registrou 19 elegíveis, zero cópias, 76 verificadas, zero updates/conflitos/falhas e 41 ignorados. Apply real concluído: 19 elegíveis, zero cópias, 76 verificadas, 19 updates, 41 ignorados, zero conflitos/falhas. Simulação de retorno: zero updates, 60 ignorados, zero conflitos/falhas; retorno real: 19 updates, 41 ignorados, zero conflitos/falhas. Servidor permaneceu parado e nenhum arquivo foi removido. Reapply real passou: 19 updates, 76 verificadas, 41 ignorados, zero cópias/conflitos/falhas. Idempotência real passou (exit 0): 19 elegíveis, zero cópias, 76 verificadas, zero updates, 60 ignorados e zero conflitos/falhas. Browser: admin 11/11 na rodada final (1,7 min) e vitrine 8/8 na primeira rodada, sem mudança de runtime entre elas; total de 19 cenários distintos aprovados, incluindo OG/otimizador. Revisão focada dos ajustes E2E sem achados. Estado final DEV: 19 referências migradas, 41 externas preservadas, 19 originais e 76 variantes legadas mantidos. Warnings SVG/hydration preexistentes permanecem fora do escopo. Sem commit/push; localhost:3000 permanece disponível pela coordenação. Cliente/produção não executado nem aprovado.
