## Matheus

Crie um catálogo digital virtual para uma loja de moda feminina, focada em tricô, malhas, jeans e moda plus size.

Esse catálogo precisa possuir uma área pública para compartilhamento, com filtros por categoria e filtros internos (cor, tamanho, etc.)

Além da área pública, precisa possuir uma área administrativa de fácil manutenção, seja para incluir novos produtos, remover, editar, etc.
O catálogo pode misturar uso de NextJS + Neon PostgreSQL + Cloudflare R2 para armazenamento das imagens ou NextJS + Supabase com bucket para armazenamento das mesmas, com fluxo de conversão para `.webp` em ambos os casos. Deixo essa decisão para você escolher.

Se houver dúvidas, me pergunte antes de prosseguir, vamos montar o PRD do projeto antes do desenvolvimento.

## Kimi

Perfeito, vamos montar o PRD antes de qualquer linha de código. Antes, deixo minha recomendação de stack e depois as perguntas que preciso que você responda.

## Minha recomendação de stack

Sugiro **Next.js + Supabase** pelos seguintes motivos:

- **Menor complexidade operacional**: banco PostgreSQL, autenticação do admin, buckets de storage e Row Level Security em um único serviço — menos peças para manter que Neon + R2 + Auth separado.
- **RLS nativo**: a área administrativa fica protegida por políticas de segurança no próprio banco, sem precisar construir uma camada de API customizada para cada operação.
- **Conversão para WebP**: pode ser feita via Supabase Edge Functions (Deno com `sharp`) ou no servidor Next.js com `next/image` + otimização automática.
- **Custo inicial**: tier gratuito do Supabase cobre banco + storage para um catálogo em fase inicial.

O caminho Neon + R2 é mais "desacoplado" e escalável para muito tráfego de imagem, mas exige configurar autenticação, políticas de bucket e integrações à parte. Para esse escopo, Supabase ganha em velocidade de entrega.

## Perguntas para o PRD

**1. Loja física e vendas**

- O catálogo é apenas para **exibição** (a cliente vê e vai à loja / chama no WhatsApp) ou terá **compra online** no futuro? Isso muda o modelo de dados (estoque, carrinho, checkout).

**2. Área administrativa**

- Quem vai acessar o admin? Apenas você/dona da loja, ou funcionárias também (com permissões diferentes)?
- Prefere editar produtos por um painel web ou algo mais simples, tipo planilha Google sincronizada?

**3. Produtos e variações**

- Um produto de tricô, por exemplo, tem variações de **cor + tamanho com estoque individual**? E no plus size: os tamanhos vão até qualquer numeração (ex.: 46 ao 60)?
- Precisa de campos como tecido/composição, medidas da peça (busto, cintura, comprimento), cuidados na lavagem?

**4. Imagens**

- Quantas fotos por produto, em média? Tem fotos profissionais ou serão tiradas no celular? (Isso define se preciso pensar em tratamento de fundo/branco no pipeline.)
- As imagens vêm já em boa qualidade ou devo prever redimensionamento automático (ex.: 1200px para o catálogo, thumbnail 400px)?

**5. Filtros da área pública**

- Além de categoria, cor e tamanho: preço (faixas), estilo (básico, casual, festa), coleção/estação, destaque/promoção?
- Ordenação por preço, novidades, mais vendidos?

**6. Compartilhamento**

- "Área pública para compartilhamento" significa link direto por produto (ex.: mandar no WhatsApp/Instagram)? Precisa de botão de compartilhar em redes sociais por produto?

**7. Identidade e domínio**

- Já tem logo, cores da marca e nome de domínio? Ou construo com placeholders e você personaliza depois?

**8. Extras (me diga o que faz sentido)**

- Vitrine de "Novidades" e "Promoções" na home?
- Busca por texto (ex.: "blusa de tricô gola alta")?
- Quantidade de produtos estimada no lançamento (30? 200? 1000?)? Isso impacta performance e paginação.

Responda o que souber (pode numerar as respostas) e eu monto o PRD completo com escopo, modelo de dados, fluxos do admin e cronograma de desenvolvimento.

## Matheus

1. catálogo apenas para exibição: ele pode ser fornecido pelo atendente da loja através do whatsapp ou ser encontrado na internet e levar do catálogo para o whatsapp da loja. O número será uma variável de ambiente configurável.

2a. Apenas eu e o dono da loja, funcionários podem ser adicionados para gerenciar; auditoria das modificações (garantir rollback mínimo em casos de erro humano)
2.b. Painel web básico, mas intuitivo

3.a. Os campos precisam atender todos os tipos de produtos; Cria categoria e campos que ela possuirá, ou seja, os campos serão configuráveis por categoria, podendo ela ser duplicada para criar uma nova sem criar todos os campos novamente
3.b. Adicione sugestões de campos no placeholder ao criar um novo campo ou como um tooltip na criação de uma nova categoria

4.a. Mínimo de 2 fotos, sem máximo por enquanto, podendo ser tiradas pelo celular ou câmera profissional, podendo ser mesclada com modelos femininas geradas por IA
4.b. Terão boa qualidade, mas pense nas duas hipóteses

5.a. Acredito que entra em conjunto com as respostas da 3
5.a. Adicione ordenação selecionável inicialmente pelas 3 sugestões

6. O link de compartilhamento pode ser da home do catálogo, das categorias filtradas, do produto em específico; Adicionar uma área de configuração para ao compartilhar, ir com a thumb do cliente quando for home ou categoria filtrada e ir do produto quando link direto; seja para o atendente compartilhar para o cliente que chamou no whatsapp ou para o cliente compartilhar/enviar para mais pessoas.

7. Minha empresa possui um domínio, ele será "compartilhado" para o cliente (cliente.dominio ou catalogocliente.dominio), se o cliente possuir, poderá ser configurado um redirect do meu para o dele (domínio). Crie um `JSON` onde eu possa configurar seja informações ou URL de imagens, para iniciar com um placeholder menos genérico.

8.a. Faz sentido
8.b. Sim
8.c. Acima de 30 logo de início

## Kimi

PRD pronto! 🎉 Resumo do que foi documentado e as decisões que tomei com base nas suas respostas:

## Destaques do PRD

**Decisão de stack confirmada:** Next.js + Supabase (Auth, PostgreSQL com RLS e Storage em um só serviço, com pipeline `sharp` → WebP).

**Ponto-chave que identifiquei:** pela descrição do domínio (cliente.dominio, config por loja), arquitetei como **plataforma multi-tenant** — cada loja sua cliente recebe um subdomínio, com isolamento total de dados via Row Level Security e opção de redirect para domínio próprio. Isso muda bastante o modelo de dados e está detalhado no doc.

**O que ficou mais robusto que o pedido original (pelas suas respostas):**

- **Campos configuráveis por categoria** (RF-ADM-09 a 14): cada categoria define seu próprio schema de campos (cor, tamanho, composição, medidas...) com tipos suportados, marcação de `filterable`/`required`, **duplicação de categoria** e sugestões contextuais com placeholders/tooltips. Os filtros públicos são gerados dinamicamente desses schemas.
- **Auditoria com rollback real**: snapshot completo antes/depois de toda alteração, timeline por produto, restore em 2 cliques, soft delete com lixeira de 30 dias.
- **Pipeline de imagens cobre as duas hipóteses**: foto de celular passa por normalização sutil; foto profissional é preservada em alta (1600px). Ambas geram 4 variantes WebP (thumb, card, detail e og 1200×630).
- **Compartilhamento em 3 níveis** (home, categoria filtrada, produto) com OG image dinâmico — configuração de qual imagem vai em cada caso vive no JSON de branding.
- **Ordenação**: novidades (padrão), preço ↑↓ e destaque.

## Arquivos entregues

1. **`PRD-catalogo-moda.md`** — documento completo: personas, requisitos funcionais numerados, modelo de dados, pipeline de imagens, critérios de aceite, roadmap em 5 fases e riscos.
2. **`branding.example.json`** — o JSON de configuração que você pediu: identidade, cores, hero, vitrines, estados vazios, imagens OG e comportamento — com placeholders menos genéricos (paleta terrosa de moda feminina) e fácil de adaptar por cliente.

## Próximos passos

Só preciso de um **"pode ir"** (ou ajustes) para começar a **Fase 0**. Também deixei 5 pontos abertos no PRD §13 — o mais relevante: qual a identidade da **sua plataforma** (nome/cores do painel admin, que é diferente da identidade de cada loja-cliente)?

## Matheus

O projeto não será estilo SaaS, ele terá um repositório `main` e dele branches para `dev` e de cada `main` uma branch por cliente, que será vinculado em um Supabase. Cada banco será apenas de um cliente, configurados pela minha empresa.
O cliente terá apenas acesso ao sistema (vitrine + área administrativa), banco, conexão, e demais serão configurados por nós. Cliente poderá modificar a branding, para adicionar suas cores, imagens e textos, se ele não configurar, usa o `json` padrão com as informações da minha empresa "Equilibrium Tecnologia", se ele configurar, chama do banco os dados do cliente.

Esse modelo servirá caso um cliente deseje uma feature que não faz sentido ser global, ao mesmo tempo que eu posso implementar uma feature desenvolvida por mim para todos, se for algo benéfico para todos os clientes ativos.

## Kimi

PRD atualizado para v1.1! 🎯 Resumo das mudanças arquiteturais:

## O que mudou com o modelo por branch

**Removido:** SaaS multi-tenant, `tenant_id`, RLS de isolamento entre lojas, resolução por subdomínio.

**Adicionado/substituído:**

- **§7.2 — Modelo de repositório:** `main` → `dev` + uma branch por cliente, cada uma conectada a **seu próprio projeto Supabase e domínio** (via env vars do deploy). Loja-cliente toca apenas no sistema; infra é 100% Equilibrium.
- **§7.5 — Estratégia de features:** regra de ouro documentada — _"divergência de código é exceção; divergência de configuração é regra"_. Features exclusivas nascem na branch do cliente idealmente atrás de **feature flags** (ex.: `FLAGS = { clientXFeature: true }`), o que permite que uma feature nascida para um cliente seja "ligada" para outro depois, via merge em `main`, sem reescrever código. Merge mensal de `main` nas branches cliente para controlar drift.
- **§9 — Branding em camadas** (o coração do seu requisito):
  1. Overrides no banco (`store_settings`) ← o que a loja configurou no admin
  2. `branding.config.json` versionado no repo ← identidade **Equilibrium Tecnologia** (não genérica: paleta azul-petróleo/dourado, placeholder próprio)
  3. Fallback de código

  Loja nova exibe Equilibrium; ao editar qualquer chave no admin, só essa chave passa a vir do banco. Botão "Restaurar padrão" por seção.

- **Roadmap F4** agora inclui o **playbook de provisionamento** (branch + Supabase + domínio em checklist) — com 2+ clientes isso vira rotina e precisa estar documentado.
- **Risco #1** virou o drift entre branches, com mitigação clara (flags + merge mensal).
- **Critério de aceite 5 e 6** novos, cobrindo exatamente os dois comportamentos que você descreveu (fallback Equilibrium → override da loja; feature exclusiva vs. global).

O `branding.example.json` também foi reescrito com a identidade **Equilibrium Tecnologia** como padrão.

Ainda em aberto (§13, item 5): confirmo "Equilibrium Tecnologia" no fallback e na tela de login do admin?

## Matheus

## 13. Pontos Abertos

1. **Paginação**: "carregar mais" (recomendado)
2. Preço se configurado ou "sob consulta" para produtos sem valor
3. Vitrine de "Promoções" com campanha/data de validade: sim, configurável e podendo selecionar produtos específicos ou categorias inteiras
4. Tema escuro: implementar
5. Nome do produto/branding da plataforma para o **painel admin** — uso de "Equilibrium Tecnologia" no fallback e no login do admin.

## Kimi

PRD atualizado para **v1.2** — todos os 5 pontos fechados e registrados. Resumo do que entrou:

## Decisões incorporadas

1. **Paginação** — "carregar mais" confirmado (sem infinite scroll).
2. **Preço "Sob consulta"** — preço agora é opcional por produto (RF-ADM-08). Sem valor, a vitrine e a página do produto exibem "Sob consulta", e o CTA do WhatsApp omite o valor da mensagem pré-preenchida. Bônus que mantive: `behavior.show_prices: false` no branding desliga preços do catálogo inteiro de uma vez.
3. **Campanhas de promoção** — ganharam seção própria (**§4.4**, RF-PUB-17/18/19 + **RF-ADM-21**) e tabela dedicada `promo_campaigns`:
   - Nome, banner, início/fim com **expiração automática** (fora da vigência, some sozinha);
   - **Dois modos de seleção**: produtos específicos (picker com busca) ou categorias inteiras — e aqui um detalhe importante: no modo categoria, produtos novos cadastrados durante a campanha **entram automaticamente**;
   - Página dedicada por campanha com contagem regressiva (≤ 7 dias para o fim) e opção de fixar na home;
   - Campanhas também passam por auditoria/rollback.
4. **Tema escuro — implementar** — tokens `theme.dark` no branding com a mesma resolução em camadas (banco → JSON → fallback derivado do tema claro), toggle manual persistido com `prefers-color-scheme` como padrão. Já incluí no `branding.example.json` com a paleta escura da Equilibrium.
5. **Equilibrium Tecnologia** confirmado no fallback, no login e no painel admin (RF-ADM-01 atualizado).

O roadmap também foi revisto: "Sob consulta" e paginação entraram na F1; campanhas na F2; tema escuro na F4. A antiga seção de pontos abertos virou **§14 — Decisões Registradas**.

Com isso o PRD está completo e sem pendências. Próximo passo natural: começar a **Fase 0** — quer que eu gere o scaffold inicial do repositório (estrutura Next.js + migrations do Supabase + `branding.config.json` versionado)?

## Matheus

Inicie pela fase 0, posteriormente irei adicionar as demais `.env` que forem necessárias, você pode criar elas sem valores e com comentários do que precisa.

## Kimi

**Fase 0 concluída!** ✅ Repositório scaffoldado, versionado no git (branches `main` e `dev` criadas) e empacotado em `/mnt/agents/output/catalogo-moda-fase0.zip`.

## O que foi entregue

**Banco (Supabase) — `supabase/migrations/`**

- `0001` — extensões (`unaccent` para busca tolerante a acentos) e enums (`owner`/`manager`, `draft`/`published`, etc.)
- `0002` — as 6 tabelas do PRD v1.2: `profiles`, `store_settings` (overrides de branding), `categories` (com `fields_schema` JSONB), `products` (**`price` nullable = "Sob consulta"**, check de `promo_price` exigir preço base), `product_images` (4 variantes), `promo_campaigns` e `audit_log` — com soft delete e índices
- `0003` — RLS completa por papel + **auditoria automática por trigger** (snapshot before/after em toda mudança, base do rollback da F3) + `updated_at` automático
- `0004` — bucket `product-images` com leitura pública e escrita só staff
- `0005` — auth hook: cria `profile` no primeiro login (promover a dona a `owner` — comando no README)

**App (Next.js 15 + TS)**

- `lib/branding.ts` — resolução em camadas funcionando: banco → `branding.config.json` (Equilibrium) → fallback, com merge profundo, validação zod e **resiliência** (se o DB falhar na vitrine, exibe o padrão em vez de quebrar)
- `lib/flags.ts` + `flags.config.ts` — feature flags com override via `FLAGS_JSON` (env)
- `layout.tsx` — injeta tokens de tema como CSS vars + **tema escuro via script inline** (`localStorage` + `prefers-color-scheme`, sem flash de FOUC)
- `/admin/login` funcional + middleware de sessão protegendo `/admin`
- Home e painel admin placeholders que já leem dados reais (contagens)

**Configuração**

- `.env.example` e `.env.local` — **sem valores**, cada variável comentada com onde encontrá-la no painel Supabase
- `README.md` — setup local, primeiro acesso e o **checklist de provisionamento de novo cliente** (branch + Supabase + Vercel + domínio)

## Para rodar localmente

```bash
npm install && cp .env.example .env.local   # preencher com os dados do Supabase
supabase init && supabase db reset          # aplica as migrations
npm run dev
```

Quando quiser, partimos para a **Fase 1** (vitrines, listagem com filtros, página de produto, CTA WhatsApp e pipeline de imagens WebP).
