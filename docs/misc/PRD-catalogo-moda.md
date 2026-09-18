# PRD — Catálogo Digital Virtual para Moda Feminina

**Versão:** 1.2 | **Data:** 17/09/2026 | **Status:** Aprovado para desenvolvimento (aguardando validação)

**Changelog v1.2:** Pontos abertos resolvidos (§13 → §14): paginação "carregar mais" confirmada; preço opcional com "Sob consulta"; campanhas de promoção com validade e seleção por produtos/categorias (novo §4.4, RF-ADM-21, tabela `promo_campaigns`); tema escuro implementado (RF-PUB-19, tokens `theme.dark`); branding "Equilibrium Tecnologia" confirmado no fallback e no login do admin.

**Changelog v1.1:** Arquitetura corrigida de SaaS multi-tenant para modelo de repositório único com branches por cliente (§7.2). Removido `tenant_id`/RLS multi-tenant. Branding com fallback para padrão "Equilibrium Tecnologia" via JSON + overrides no banco (§9). Adicionada estratégia de features por branch vs. globais (§7.5).

---

## 1. Visão Geral

Catálogo digital de **exibição** (sem checkout) para lojas de moda feminina, com foco em tricô, malhas, jeans e moda plus size. Duas frentes:

1. **Área pública** — navegável por cliente final, com filtros dinâmicos por categoria, busca, ordenação e links compartilháveis que levam ao WhatsApp da loja.
2. **Área administrativa** — painel web para a loja (dona + equipe) gerenciar produtos, categorias, imagens e branding, com campos configuráveis por categoria e trilha de auditoria com rollback.

**Modelo de operação (definido):** o projeto é um **produto de repositório único**, não SaaS multi-tenant. O repositório `main` gera a branch `dev` e, a partir de `main`, uma branch por cliente (`cliente-<nome>`). Cada branch de cliente é vinculada a **um projeto Supabase exclusivo** (banco, auth e storage daquela loja apenas), configurado e mantido pela **Equilibrium Tecnologia**. A loja-cliente acessa apenas o sistema (vitrine + admin) — nunca infraestrutura.

**Stack:** Next.js (App Router, TypeScript) + Supabase (PostgreSQL + Auth + Storage) + conversão de imagens para `.webp` via `sharp`.

---

## 2. Objetivos e Não-Objetivos

### 2.1 Objetivos

- Permitir que o atendimento da loja compartilhe produtos/categorias/catálogo via WhatsApp com links que abrem direto no ponto certo.
- Reduzir a zero a dependência de dev para incluir/editar/remover produtos e personalizar branding.
- Suportar variações de produto distintas por categoria (tricô ≠ jeans ≠ plus size) sem hardcode de campos.
- Garantir rastreabilidade de todas as alterações com capacidade mínima de rollback.
- Arquitetura que permita feature exclusiva por cliente **sem forkar o projeto** (branch por cliente) e propagação de melhorias a todos (merge para `main`).
- Imagens otimizadas (WebP, múltiplos tamanhos) para carregamento rápido em 3G/4G.

### 2.2 Não-objetivos (fora de escopo nesta fase)

- Venda online, carrinho, checkout, pagamento.
- Gestão de estoque por variação (tamanho/cor) — informativos/exibição.
- Marketplace, integração com ERP.
- App nativo mobile.
- Painel de gerenciamento de infraestrutura por cliente (feito pela Equilibrium fora do sistema, no painel Supabase/Vercel).

---

## 3. Personas

| Persona | Descrição | Necessidades principais |
| --- | --- | --- |
| **Cliente final** | Mulher, navega pelo WhatsApp/Instagram, celular | Fotos grandes, filtrar por tamanho/cor (plus size!), preço claro, botão "Chamar no WhatsApp" |
| **Atendente da loja** | Responde WhatsApp, monta vitrines | Compartilhar link de produto/categoria rapidamente |
| **Dona da loja** | Dona/admin da loja-cliente | Cadastrar produtos sozinha, criar categorias com campos próprios, controlar quem acessa, personalizar branding, desfazer erros |
| **Funcionária (gestora)** | Equipe autorizada da loja | CRUD de produtos, sem acesso a configurações sensíveis |
| **Equilibrium Tecnologia** | Mantém plataforma e infra | Provisionar branch + Supabase por cliente, propagar features de `main`, customizar branch quando justificado |

---

## 4. Área Pública — Requisitos Funcionais

### 4.1 Home

- **RF-PUB-01** — Hero/vitrine configurável (imagem, título, subtítulo via resolução de branding — §9).
- **RF-PUB-02** — Vitrines: **Novidades**, **Destaques**, **Promoções** (preço promocional).
- **RF-PUB-03** — Listagem de categorias navegável (cards com imagem configurável por categoria).
- **RF-PUB-04** — Mobile-first; estado vazio elegante.

### 4.2 Listagem de produtos (categoria / busca)

- **RF-PUB-05** — Grade com foto de capa, nome, preço (de/por na promoção).
- **RF-PUB-06** — **Filtros dinâmicos gerados dos campos `filterable` do schema da categoria** (cor, tamanho, estilo, faixa de preço...). Combinação em conjunto (AND).
- **RF-PUB-07** — **Ordenação selecionável**: Novidades (padrão), Preço (menor→maior, maior→menor), Destaque.
- **RF-PUB-08** — **Busca textual** por nome e atributos, tolerante a acentos.
- **RF-PUB-09** — Paginação "carregar mais".
- **RF-PUB-10** — Filtros refletidos na URL (query string) — combinação compartilhável.

### 4.3 Página de produto

- **RF-PUB-11** — Galeria (mín. 2 fotos, validado no admin), gesto/setas, zoom leve.
- **RF-PUB-12** — Atributos exibidos conforme schema da categoria.
- **RF-PUB-13** — Preço e preço promocional com selo "PROMO". **Produto sem valor cadastrado exibe "Sob consulta"** no lugar do preço; o CTA WhatsApp permanece e a mensagem pré-preenchida omite o valor. Se `behavior.show_prices` for falso, o catálogo inteiro exibe "Sob consulta".
- **RF-PUB-14** — Botão **"Chamar no WhatsApp"** → wa.me com número (env var do deploy do cliente) + mensagem pré-preenchida com nome e URL do produto.
- **RF-PUB-15** — Compartilhar nativo (`navigator.share`, fallback copiar link).
- **RF-PUB-16** — Produtos relacionados (mesma categoria).

### 4.4 Campanhas de promoção
- **RF-PUB-17** — Campanha = vitrine com nome, banner, período de validade (`starts_at`/`ends_at`) e seleção de itens. Fora do período, a campanha não é exibida (expiração automática, sem intervenção).
- **RF-PUB-18** — Página/rota dedicada por campanha (`/campanhas/{slug}`) listando seus produtos, com banner, datas de validade e contagem regressiva quando faltarem ≤ 7 dias para o fim. Campanha pode ser fixada na home (seção configurável, RF-PUB-02 estende-se a campanhas ativas).
- **RF-PUB-19** — Seleção de itens em dois modos: **produtos específicos** (pick individual) ou **categorias inteiras** (todos os publicados da categoria entram; novos produtos da categoria entram automaticamente durante a vigência).

---

## 5. Área Administrativa — Requisitos Funcionais

### 5.1 Autenticação e permissões

- **RF-ADM-01** — Login e-mail/senha (Supabase Auth). Perfis: `owner` e `manager`. Tela de login e painel usam o branding resolvido (§9): Equilibrium Tecnologia quando o cliente ainda não personalizou.
- **RF-ADM-02** — `owner`: convida/remove gestores, edita branding, WhatsApp e configurações. `manager`: apenas produtos, categorias e imagens.
- **RF-ADM-03** — Todo o banco pertence a um único cliente; isolamento entre lojas ocorre por **projeto Supabase separado por branch**, não por RLS de tenant.

### 5.2 Gestão de produtos (CRUD)

- **RF-ADM-04** — Criar/editar/remover produto. Remoção é **soft delete**.
- **RF-ADM-05** — Formulário de produto **gerado dinamicamente** do schema de campos da categoria.
- **RF-ADM-06** — Upload múltiplo (drag-and-drop), reordenação drag-and-drop, capa = primeira. Mínimo 2 imagens para publicar.
- **RF-ADM-07** — Preview em tempo real (como a cliente vê).
- **RF-ADM-08** — Campos fixos: nome, slug (auto), **preço (opcional — vazio = "Sob consulta")**, preço promocional (exige preço base), status (rascunho/publicado), destaque, categoria. Novidade = derivada da data de criação.

### 5.3 Gestão de categorias e campos configuráveis

- **RF-ADM-09** — CRUD de categorias: nome, slug, descrição, imagem de capa, ordem, ativa/inativa.
- **RF-ADM-10** — **Editor de campos da categoria**: chave, rótulo, tipo (`text`, `textarea`, `number`, `select`, `multiselect`, `boolean`, `url`), opções.
- **RF-ADM-11** — Campo marcável como `filterable` (filtro público) e/ou `required`.
- **RF-ADM-12** — **Duplicar categoria** copiando o schema de campos.
- **RF-ADM-13** — **Sugestões contextuais**: placeholders e tooltips sugerindo campos comuns da moda (Cor, Tamanho, Composição, Medidas busto/cintura/quadril/comprimento, Cuidados na lavagem, Modelagem), agrupados por tipo de categoria (tricô, jeans, plus size...).
- **RF-ADM-14** — Editar schema **não apaga** dados existentes (chaves preservadas no JSONB; campos removidos ficam ocultos).

### 5.4 Auditoria e rollback

- **RF-ADM-15** — Toda criação/edição/exclusão gera log com usuário, timestamp, entidade, ação e **snapshot antes/depois**.
- **RF-ADM-16** — Timeline de alterações por produto/categoria.
- **RF-ADM-17** — **Rollback**: restaurar qualquer versão anterior (reaplica snapshot; rollback também é auditado).
- **RF-ADM-18** — Lixeira: recuperação por 30 dias.

### 5.5 Configurações da loja

- **RF-ADM-19** — Editor do branding com **resolução de camadas** (§9): JSON padrão da Equilibrium como base, overrides do cliente no banco, preview ao vivo.
- **RF-ADM-20** — Número de WhatsApp e mensagem padrão (salvos no banco do cliente; env var apenas como fallback de deploy).
- **RF-ADM-21** — CRUD de **campanhas de promoção**: nome, slug, banner, início/fim, modo de seleção (produtos | categorias), itens selecionados via picker com busca, fixar na home (sim/não), ativa/inativa. Preview público antes de publicar. Campanhas são auditáveis e passíveis de rollback (§5.4).
- **RF-ADM-22** — Tema escuro: tokens `theme.dark` editáveis no branding (com fallback automático derivado do tema claro); toggle manual no site (persistido em `localStorage`) respeitando `prefers-color-scheme` como padrão inicial.

---

## 6. Compartilhamento e Open Graph

- **RF-SHR-01** — Links compartilháveis em 3 níveis: home, categoria filtrada (query string preservada), produto.
- **RF-SHR-02** — OG/Twitter dinâmico por rota: produto → foto de capa; home → imagem OG do branding resolvido; categoria → imagem da categoria (fallback configurado).
- **RF-SHR-03** — `og:image` 1200×630 em WebP.
- **RF-SHR-04** — Serve para atendente→cliente e cliente→outras pessoas.

---

## 7. Arquitetura Técnica

### 7.1 Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end + SSR | Next.js 15 (App Router, TypeScript) |
| Banco/Auth/Storage | Supabase (1 projeto por cliente) |
| Imagens | `sharp` → WebP multi-variante |
| Deploy | Vercel (1 projeto por branch de cliente) |
| Domínio | Domínio próprio do cliente configurado na Vercel |

### 7.2 Modelo de repositório, branches e deploy

```javascript
main ───────────────► branch base do produto (código global)
  └─ dev ───────────► desenvolvimento/homologação global
  └─ cliente-ana ───► deploy exclusivo da Loja Ana
  └─ cliente-bia ───► deploy exclusivo da Loja Bia
  └─ cliente-cia ───► deploy exclusivo da Loja Cia (tem feature exclusiva X)
```

- Cada branch `cliente-*` é conectada a **seu próprio projeto Supabase** (URL + service key via env vars do deploy) e **seu domínio**.
- Provisionamento (novo cliente) = checklist da Equilibrium: criar branch a partir de `main`, criar projeto Supabase, rodar migrations, criar env vars, configurar domínio na Vercel.
- **Features globais** nascem em `dev` → merge em `main` → merge/downgrade nas branches de clientes ativos.
- **Features exclusivas** nascem direto na branch do cliente. Convenção: código exclusivo fica isolado atrás de **feature flags** (`FLAGS = { clientXFeature: true }` por branch) sempre que possível, para minimizar divergência e facilitar merge futuro.
- Convenção de branches: `feat/*` a partir da branch alvo; merge de `main` nas branches cliente pelo menos 1x/mês (lote de melhorias) para controlar drift.

### 7.3 Modelo de dados (single-tenant — sem `tenant_id`)

```javascript
store_settings (1 linha por banco — overrides de branding do cliente)
  id, key, value JSONB, updated_at, updated_by
  -- seed inicial vazio = 100% branding padrão (Equilibrium)

categories
  id, name, slug, description, cover_image_url,
  fields_schema JSONB, sort_order, is_active, created_at, updated_at, deleted_at

products
  id, category_id, name, slug, price, promo_price,
  status (draft|published), is_featured,
  attributes JSONB, created_at, updated_at, deleted_at

product_images
  id, product_id, storage_path, thumb_url, card_url, detail_url, og_url,
  width, height, size_kb, sort_order, created_at

profiles
  id, email, role (owner|manager), invited_by, created_at

promo_campaigns
  id, name, slug, banner_image_url, starts_at, ends_at,
  selection_mode (products|categories),
  campaign_items JSONB,   -- [{type: product|category, id}]
  pinned_on_home BOOLEAN, is_active, created_at, updated_at, deleted_at

audit_log
  id, user_id, entity (product|category|settings),
  entity_id, action (create|update|delete|rollback|restore),
  before JSONB, after JSONB, created_at
```

**Exemplo de `fields_schema` (categoria "Tricô"):**

```json
[
  {"key": "cor",       "label": "Cor",        "type": "multiselect", "options": ["Preto","Branco","Bege","Rosa","Vinho","Azul Marinho"], "filterable": true, "required": true},
  {"key": "tamanhos",  "label": "Tamanhos",   "type": "multiselect", "options": ["PP","P","M","G","GG","Plus (46-52)","Plus (54-60)"], "filterable": true, "required": true},
  {"key": "composicao","label": "Composição", "type": "text",        "placeholder": "Ex.: 85% acrílico, 15% poliamida"},
  {"key": "modelagem", "label": "Modelagem",  "type": "select",      "options": ["Justa","Regular","Oversized"], "filterable": true},
  {"key": "medidas",   "label": "Medidas (cm)", "type": "group", "fields": [
      {"key":"busto","label":"Busto","type":"number"},
      {"key":"comprimento","label":"Comprimento","type":"number"}]},
  {"key": "cuidados",  "label": "Cuidados na lavagem", "type": "textarea"}
]
```

### 7.4 Pipeline de imagens (celular e câmera profissional)

```javascript
Upload (JPEG/PNG/HEIC até 10MB)
  → Validação (MIME, mín. 800px)
  → sharp: auto-rotate (EXIF) + correção leve de cor
  → Hipótese "celular": normalização sutil de brilho/contraste (sem overprocessar)
  → Variantes WebP:
      • thumb 400px   (filtros/admin)
      • card 800px    (grade)
      • detail 1600px (página do produto — preserva foto pro)
      • og 1200×630   (compartilhamento)
  → Bucket `product-images/{product_id}/` no Supabase Storage do cliente
  → Registro em product_images
```

- Limpeza de órfãos (produto excluído há +30 dias) via job agendado (cron da Vercel ou pg_cron).

### 7.5 Estratégia de features (por branch vs. globais)

| Situação | Caminho |
| --- | --- |
| Melhoria benéfica a todos | `dev` → `main` → merge nas branches cliente ativas |
| Feature exclusiva de 1 cliente | Branch do cliente, idealmente atrás de feature flag |
| Feature pedida por outro depois | Merge da flag para `main`, ativada por config, não por código divergente |
| Correção de bug global | `main` (hotfix) → merge imediato em todas as branches cliente |

Regra de ouro: **divergência de código é exceção; divergência de configuração (flags + branding) é regra.**

### 7.6 Segurança

- Autenticação Supabase; server actions/rotas validam `owner`/`manager` server-side.
- Validação de upload (tipo/tamanho) server-side; bucket privado com URLs assinadas para variantes.
- Rate limit em busca e endpoints públicos; headers de segurança (CSP, X-Frame-Options).

---

## 8. Requisitos Não Funcionais

| Categoria | Requisito |
| --- | --- |
| Performance | LCP < 2,5s em 4G; lazy-load; bundle < 200KB gzip |
| SEO | Metadata por rota, sitemap.xml, robots configurável |
| Acessibilidade | WCAG 2.1 AA (contraste, alt text, teclado) |
| Disponibilidade | Alvo 99,9% (Vercel + Supabase) |
| Dados | Backup diário automático; auditoria retida 12 meses |
| Idioma | pt-BR único (i18n arquitetado) |

---

## 9. Branding: resolução em camadas (JSON padrão → banco do cliente)

Ordem de resolução (primeiro valor encontrado vence):

1. **Overrides no banco** (`store_settings`) — o que a loja configurou no admin.
2. **JSON padrão** versionado no repo (`branding.config.json`) — identidade da **Equilibrium Tecnologia** como placeholder de qualidade (não genérico).
3. Fallback de código (valores mínimos de segurança).

Comportamento: loja recém-provisionada exibe branding Equilibrium; ao editar qualquer chave no admin, essa chave passa a vir do banco. Botão "Restaurar padrão" por seção limpa os overrides. O objeto `theme.dark` segue a mesma resolução em camadas; se o cliente não definir, o tema escuro é derivado automaticamente do tema claro.

Arquivo entregue: `branding.example.json` (ver anexo), com schema validado no editor do admin (RF-ADM-19) e preview ao vivo.

---

## 10. Critérios de Aceite (principais)

1. Cliente abre link de produto recebido no WhatsApp e vê foto, preço e "Chamar no WhatsApp" em < 3s em 4G.
2. Dona da loja cria "Jeans Plus" duplicando "Jeans", ajusta tamanhos 46–60 e cadastra produto com 3 fotos de celular — sem dev.
3. Funcionária erra um preço; dona restaura a versão anterior em 2 cliques pelo histórico.
4. Link de categoria com filtros abre exatamente com filtros aplicados e OG correto.
5. Loja sem branding configurada exibe identidade Equilibrium; após configurar cores/logo no admin, passa a exibir a sua.
6. Feature criada para um cliente roda apenas no deploy dele; feature global mergeada em `main` passa a estar disponível para todos no próximo ciclo de merges.

---



## 11. Riscos e Mitigações

| Risco | Mitigação |
| --- | --- |
| **Drift entre branches cliente e `main`** | Feature flags por padrão; merge mensal agendado; código exclusivo isolado em módulos |
| Schema configurável crescer descontroladamente | Limite 20 campos/categoria; validação no editor |
| Fotos de celular fracas | Piso de 800px, normalização, preview no admin, guia de fotografia embutido |
| Rollback corromper dados | Snapshots preservam chaves órfãs; restore transacional |
| Custo de N projetos Supabase | Tier gratuito cobre fase inicial; monitorar e consolidar Storage para R2 se necessário (mesma interface) |

---

## 13. Roadmap

| Fase | Entrega | Estimativa* |
| --- | --- | --- |
| **F0 — Fundação** | Repo, `dev`, branch modelo, Supabase modelo com migrations, auth, branding com resolução em camadas (incl. `theme.dark`), feature flags, placeholders Equilibrium | 1 semana |
| **F1 — MVP público + admin** | Home, listagem, produto, CTA WhatsApp, preço opcional/"Sob consulta", CRUD produtos/categorias, upload + pipeline WebP, paginação "carregar mais" | 3 semanas |
| **F2 — Configurabilidade** | Editor de campos por categoria, duplicação, sugestões/tooltips, filtros dinâmicos, ordenação, CRUD de campanhas de promoção | 2 semanas |
| **F3 — Confiança e compartilhamento** | Auditoria, rollback, lixeira, OG dinâmico, links compartilháveis, busca | 2 semanas |
| **F4 — Polimento + playbook** | Vitrines, relacionados, tema escuro (toggle + tokens), estados vazios, testes de aceite, **playbook de provisionamento de novo cliente** (branch + Supabase + domínio) | 1–2 semanas |

\*Estimativas para 1 dev full-time.

---

## 14. Decisões Registradas (17/09/2026)

1. **Paginação**: "carregar mais" (confirmado; sem infinite scroll).
2. **Preço**: opcional por produto; sem valor exibe "Sob consulta" (catálogo inteiro pode virar "sob consulta" via `behavior.show_prices`).
3. **Promoções**: campanhas configuráveis com data de validade, fixação na home e seleção por **produtos específicos** ou **categorias inteiras** (§4.4, RF-ADM-21).
4. **Tema escuro**: **implementar** — tokens `theme.dark` no branding, fallback derivado do tema claro, toggle com `prefers-color-scheme`.
5. **Branding da plataforma**: "Equilibrium Tecnologia" no fallback e no login/área administrativa (confirmado).