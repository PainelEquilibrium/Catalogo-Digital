# Contexto e decisões — Catálogo Digital

**Data:** 18/09/2026  
**Status:** spec 1 **aprovada**. Plano: `docs/superpowers/plans/2026-09-18-fundacao-e-vitrine.md`. Implementação na branch `local`.

**Supabase:** o projeto de **desenvolvimento** pode sofrer `db reset`. **Jamais** resetar banco de cliente.  
**Fontes:** `docs/misc/chat-01.md`, leftovers em `docs/misc/`, respostas em `02-respostas-das-perguntas-abertas.md`.

Este arquivo é a memória de produto. Não substitui o spec Superpowers (`docs/superpowers/specs/`).

---

## 1. O que estamos construindo

Catálogo digital de **exibição** (sem checkout) para **lojas de roupa em geral**. O primeiro cliente é moda feminina (tricô, malhas, jeans, plus size), mas o produto **não** fica preso a esse recorte: categorias, campos e copy da loja é que especializam cada vitrine.

Duas frentes:

1. **Vitrine pública** — a pessoa navega, filtra, abre produto e chama a loja no WhatsApp. Links compartilháveis (home, categoria filtrada, produto).
2. **Admin** — dona da loja e equipe cadastram produtos, categorias, imagens, branding, textos legais e campanhas, sem depender de desenvolvedor.

O atendimento usa o catálogo no WhatsApp; o catálogo também pode ser encontrado na internet e converter para o mesmo número.

**Não é SaaS multi-tenant.** Repositório único, uma branch e um projeto Supabase por cliente, provisionados pela Equilibrium Tecnologia.

---

## 2. Quem usa

| Persona | Papel |
| --- | --- |
| Cliente final | Vê fotos, filtra, entende preço ou “Sob consulta”, chama no WhatsApp |
| Atendente | Compartilha o link certo (home, filtro ou produto) no WhatsApp |
| Dona da loja (`owner`) | CRUD completo, branding, WhatsApp, textos legais, convite/gestão de usuárias, auditoria |
| Gestora (`manager`) | Produtos, categorias e imagens. Sem configurações sensíveis |
| Equilibrium Tecnologia | Branch, Supabase, Vercel, domínio, env, features globais e exclusivas |

**Primeiro cliente:** Mariah's Boutique (branch `cliente-mariahs` ou equivalente). O `main` continua sendo o produto genérico.

---

## 3. Decisões fechadas

Não reabrir sem pedido explícito.

### Produto

- Exibição apenas. Sem carrinho, checkout, pagamento, estoque por variação, ERP ou app nativo.
- Conversão = WhatsApp. Fonte da verdade no **banco**; `WHATSAPP_NUMBER` só como fallback de deploy. Nunca hardcode.
- Mais de 30 produtos no lançamento da primeira loja.
- Paginação **“carregar mais”** (não infinite scroll).
- Preço **opcional**. Sem valor → “Sob consulta” (também some da mensagem do WhatsApp). `behavior.show_prices: false` desliga preço do catálogo inteiro. `promo_price` exige preço base.
- Ordenação: novidades (padrão), preço ↑, preço ↓, destaque.
- Busca textual, tolerante a acentos.
- Home com vitrines de Novidades, Destaques e Promoções (quando houver dados).
- Tema escuro: tokens no branding, `prefers-color-scheme`, toggle persistido.
- Fallback de marca: **Equilibrium Tecnologia** no JSON do `main`, no login e no admin até a loja personalizar.
- Feature exclusiva: só **flag**. Nenhuma feature exclusiva conhecida para a Mariah's ainda.
- pt-BR nativo. Sem `next-intl` nesta geração. Copy em módulo/constantes, não crua no JSX.

### Categorias e campos

- Schema **configurável por categoria**, não hardcoded por segmento.
- Duplicar categoria copia o schema.
- Campo: `filterable` e/ou `required`.
- Filtros públicos nascem desses campos; URL compartilhável.
- Sugestões ao criar campo/categoria são **dicas** (moda, medidas, composição…), não o modelo de dados.
- Tipos no MVP: `text`, `textarea`, `number`, `select`, `multiselect`, `boolean`, `url`. **Sem `group`.** Medidas = campos `number` separados (`busto_cm`, etc.).
- Editar schema **não apaga** valores já salvos.

### Imagens

- Mínimo 2 fotos para publicar; sem máximo definido.
- Celular, câmera profissional e imagens geradas por IA podem se misturar.
- Pipeline: `sharp` em **Server Action / rota Node no Next.js** → WebP (thumb, card, detail ~1600px, OG 1200×630).
- Bucket: variantes processadas **públicas** (URL estável para vitrine e OG). Original privado ou prefixo separado. Sem `service_role` no browser. Validação MIME/tamanho no servidor.

### Compartilhamento

- Três níveis: home, categoria com query string, produto.
- OG dinâmico: imagem da loja na home/categoria; foto do produto no link direto.

### Campanhas

- Nome, banner, início/fim, expiração automática.
- Seleção por produtos **ou** categorias inteiras (produto novo da categoria entra na vigência).
- Pode fixar na home. Página própria com contagem regressiva se faltarem ≤ 7 dias.
- CRUD de campanha **não** entra no primeiro spec.

### Admin e confiança

- Painel web básico. Login e chrome usam branding **resolvido** (loja se configurou; senão Equilibrium).
- Componente próprio **`PoweredByEquilibrium`** no rodapé discreto do admin (“fornecido por Equilibrium Tecnologia”).
- Soft delete + lixeira (~30 dias).
- **1ª geração do admin:** log com snapshot before/after + timeline. Restore em 2 cliques = geração seguinte.
- Owner convida `manager` por e-mail (Supabase Invite). Sem self-signup.
- Manutenção de usuários **no próprio admin** (listar, convitar, papel, desativar) — sem SQL no dia a dia. Isso entra no spec de admin, não no da vitrine.
- Textos legais (privacidade, cookies, termos) no **banco**, mesma ideia de camadas do branding (override da loja sobre padrão Equilibrium). Editor completo no spec de admin; a vitrine já lê e exibe.

### Branding em camadas

1. Overrides no banco (`store_settings` ou equivalente)  
2. `branding.config.json` versionado no **`main` = sempre Equilibrium**  
3. Fallback de código  

Na branch `cliente-*`, a loja personaliza pelo admin (banco). Só commitar JSON da loja na branch se houver motivo operacional. “Restaurar padrão” por seção.

Histórico de exemplo: `docs/misc/branding.config.json`.

### Modelo de entrega

```
main            produto global (JSON Equilibrium)
  └─ dev        homologação global
  └─ cliente-*  1 Vercel + 1 Supabase + subdomínio Equilibrium
```

- Subdomínio Equilibrium como padrão (`catalogo-<cliente>.<dominio-equilibrium>`).
- Domínio próprio da loja opcional (CNAME / redirect na Vercel).
- Feature global: `dev` → `main` → merge nas branches cliente (≥ 1×/mês).
- Divergência de código é exceção; divergência de configuração é regra.

---

## 4. Stack travada

| Camada | Escolha |
| --- | --- |
| App | **Next.js 16**, App Router, TypeScript, `src/` |
| UI runtime | React 19 |
| Estilo | Tailwind CSS |
| Admin | **shadcn/ui** + Zod + React Hook Form |
| Vitrine | Layout/CSS **próprios** sobre tokens do branding. shadcn só em controles genéricos (dialog, input, toast) |
| Pacotes | **pnpm** (um lockfile; sem npm/yarn misturado) |
| Banco / Auth / Storage | Supabase (1 projeto por cliente), RLS por papel `owner` / `manager` |
| Imagens | `sharp` no Next → WebP |
| Host | **Vercel**, 1 projeto por branch `cliente-*` |
| Testes | Vitest (domínio) + Playwright (fluxos críticos da vitrine, filtro/URL, WhatsApp, login admin quando existir) |
| Analytics | GTM + Consent Mode v2 + banner de cookies. Eventos `whatsapp_click` e page view. Sem `/obrigado` nem API de lead neste produto |
| Schema leftover | `docs/misc/0002_core_tables.sql` é **rascunho**. Spec redesenha tabelas/RLS |

---

## 5. Direção visual da vitrine

Não copiar layout. Pegar o clima: **minimalista, editorial, funcional**.

Referências dadas:

- [The Drive New York](https://thedrivenewyork.com/) — concept store: tipografia sóbria, categorias numeradas, foto grande, chrome mínimo, paleta terrosa. É a âncora mais próxima de um catálogo de roupa.
- [Poolside FM Store (Lapa)](https://www.lapa.ninja/post/poolside-fm-store/) — vitrine como peça de design, não dashboard. Não reproduzir a estética “OS retrô”.

Tokens (cores, fonte, raio, colunas) vêm do branding resolvido. A vitrine não parece admin shadcn.

---

## 6. Recorte dos specs

| Spec | Entra | Não entra |
| --- | --- | --- |
| **1. Fundação + vitrine** (spec escrito) | Ver `docs/superpowers/specs/2026-09-18-fundacao-e-vitrine-design.md` | CRUD admin, convite, editor de branding/legais, campanhas, restore, HEIC, `proxy.ts` |
| **2. Admin** (seguinte) | Login, produtos/categorias/imagens, schema de campos, usuários no painel, branding/legais editáveis, `PoweredByEquilibrium` | Restore em 2 cliques |
| **3+** | Campanhas, auditoria visível + restore, playbook de provisionamento | Checkout, estoque, i18n |

Sem admin no spec 1, a vitrine nasce com **seed** (produtos publicados de exemplo). Cadastro real é o spec 2.

---

## 7. Fora de escopo (produto)

- Venda online, carrinho, checkout, pagamento
- Estoque numérico por tamanho/cor
- Marketplace / ERP / app nativo
- Painel Equilibrium para provisionar clientes (Git + Supabase + Vercel fora do app)
- SaaS com `tenant_id` no mesmo banco
- Tipo `group` no schema de campos (MVP)
- Self-signup público

---

## 8. Leftovers (`docs/misc/`)

Arquivo morto. Não copiar para a raiz como se fosse o app.

| Arquivo | O que é |
| --- | --- |
| `chat-01.md` | Transcrição da conversa com Kimi |
| `PRD-catalogo-moda.md` | PRD v1.2 — insumo, não spec Superpowers |
| `branding.config.json` | Exemplo de fallback Equilibrium |
| `env.example` | Rascunho de variáveis |
| `0002_core_tables.sql` | Recorte; redesenhar no spec |
| `README.md` | README do zip que não chegou |

---

## 9. Inconsistências do PRD — resolvidas nesta rodada

| Ponto | Decisão |
| --- | --- |
| Domínio | Subdomínio Equilibrium + domínio próprio opcional |
| Storage | Variantes públicas; original não precisa ser público |
| WhatsApp | Banco primeiro; env fallback |
| Tipo `group` | Fora do MVP |
| i18n | Só pt-BR |
| Admin vs Equilibrium | Branding resolvido + `PoweredByEquilibrium` |
| SQL leftover | Rascunho |
| Next 15 / npm / host | Next 16, pnpm, Vercel |
| Fase 0 no zip | Não existe neste disco; fundação entra no spec 1 |

**Ainda operacional (não bloqueia spec):** Q24 — hostname e WhatsApp reais da Mariah's no provisionamento / `.env`.

---

## 10. Fluxo Superpowers a partir daqui

1. ~~Base README + CLAUDE.md~~  
2. ~~Perguntas respondidas~~  
3. ~~Spec 1 aprovada~~  
4. ~~Plano escrito~~ (`docs/superpowers/plans/2026-09-18-fundacao-e-vitrine.md`)  
5. **Agora:** implementar na branch `local` (Next na raiz). Reset Supabase só no projeto DEV.
