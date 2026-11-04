# Plano de implementação — Carrossel Polaroid

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Proposta de execução direta nesta sessão, sujeita ao aceite do usuário.

**Goal:** Substituir todos os usos atuais do carrossel padrão pelo modelo Polaroid e colocar os detalhes do produto abaixo da galeria em todos os breakpoints.

**Architecture:** O novo componente visual fica em `src/components/ui`, e `ProductGallery` mantém a adaptação dos dados e a ampliação. A página passa a empilhar galeria e informações; o contêiner de leitura permanece limitado, enquanto a galeria ocupa toda a largura. O único uso encontrado do carrossel padrão está nessa página.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript, Tailwind 4, next/image, Dialog existente, Vitest e Playwright; pnpm.

**Spec:** `docs/superpowers/specs/2026-10-16-carrossel-polaroid-produto-design.md`, aprovada em 16/10/2026 com extensão para todos os usos do carrossel padrão.

## Restrições globais

- Não adicionar dependências; preservar alterações locais preexistentes. Sem commit ou push.
- Fotos reais, na ordem atual; sem demo, Unsplash ou paisagens de canvas.
- Cores do branding, controles em pt-BR, área de toque mínima de 44 px e imagem inteira na moldura.
- Alturas iniciais: 440 px abaixo de 640 px; 540 px de 640 a 1023 px; 640 px a partir de 1024 px. Adaptar à altura útil sem sobrepor cartões e controles.
- Informações abaixo, com margens de 16/24 px e largura máxima de 1152 px. Preservar produtos relacionados.
- Não alterar banco, consultas, uploads, metadados, preço, atributos, compartilhamento ou WhatsApp.
- Ler os guias locais de Next em `node_modules/next/dist/docs/` antes de escrever código, incluindo Image e fronteira Client Component. Acessibilidade e requisitos da spec prevalecem sobre detalhes incompletos do snippet.

## Foco de revisão

1. Cancelamento de gesto e rolagem vertical no celular não podem deixar arraste preso.
2. Mudança de largura ou redução de fotos deve manter seleção e alvo da mola válidos.
3. Redução de movimento alterada com a página aberta deve interromper movimento e autoplay.
4. Galerias vazias ou de uma foto não podem anunciar contagem inválida nem mostrar controles inúteis.
5. Temporizadores e frames devem parar fora de visibilidade e na desmontagem; foco e hover pausam autoplay sem desfazer a pausa manual.

## Tarefa 1 — Componente Polaroid e comportamento

**Arquivos:** criar `src/components/ui/polaroid-line-carousel.tsx`, `src/components/ui/polaroid-line-carousel.module.css` e `src/components/ui/polaroid-line-carousel.test.ts`; modificar `src/lib/copy/pt-br.ts`.

**Interfaces:** exportar `Slide = { image: string; alt: string; title?: string; width?: number; height?: number }` e o componente default `PolaroidLineCarousel({ slides, onChange, ariaLabel }: { slides: Slide[]; onChange?: (index: number) => void; ariaLabel: string })`. A seleção inicial é zero. Alturas, largura do cartão, cores e autoplay de 4500 ms seguem a spec, sem expor opções que não tenham consumidor. Exportar as funções puras do snippet necessárias ao teste: `clamp`, `nearestAt`, `stringY`, `springStep`, `swingStep`.

- [x] Escrever e rodar primeiro os testes: `nearestAt(-200, 200, 3) === 0`, `nearestAt(900, 200, 3) === 2`, `nearestAt(0, 200, 0) === 0`; `stringY(0, 100, 40, 46) === 40` e `stringY(50, 100, 40, 46) === 86`; mola converge após passos de 1/60 s e balanço permanece limitado a ±0,6 rad. Confirmar falha por implementação ausente.
- [x] Adaptar a física e o DOM do modelo fornecido, removendo geração de imagens e demo. Usar `next/image` com `object-contain`, `sizes` coerente com os cartões e carregamento prioritário somente da primeira foto, conforme o guia da versão instalada. Definir posição inicial legível antes do primeiro frame e evitar carregar todas as imagens com prioridade.
- [x] Implementar CSS isolado, corda, pregadores, cartões vizinhos e dimensões responsivas. Calcular o cartão a partir de largura e altura reais para reservar espaço aos controles; evitar mínimo rígido que faça o cartão ultrapassar uma janela baixa.
- [x] Adicionar a `copyPtBr.gallery`: rótulos de galeria, anterior, próxima, pausar, retomar, ampliar e anúncio da foto selecionada. Botões de navegação ficam desabilitados nos extremos; autoplay retorna ao primeiro após o último.
- [x] Implementar gesto com captura e liberação de ponteiro, ignorando botões de controle; cancelamento acomoda na foto mais próxima sem tratar o gesto como clique. Preservar `touch-action: pan-y` e ignorar ponteiros secundários.
- [x] Implementar pausa manual persistente durante a montagem e pausas temporárias por foco, hover, arraste, documento oculto e interseção. Escutar mudanças de redução de movimento; nesse modo usar seleção imediata sem frames contínuos. Limpar listeners, observers, intervalos e RAF na desmontagem; revalidar índice quando fotos ou dimensões mudarem. Não emitir anúncios live durante autoplay.
- [x] Rodar `pnpm exec vitest run src/components/ui/polaroid-line-carousel.test.ts`, `pnpm typecheck` e lint dos arquivos criados/alterados. Resultado esperado: comandos sem erros relacionados à mudança.

## Tarefa 2 — Integração e substituição completa

**Arquivos:** modificar `src/components/catalog/product-gallery.tsx` e `src/app/(vitrine)/produto/[slug]/page.tsx`; criar `e2e/product-gallery.spec.ts`. Não reescrever `e2e/vitrine.spec.ts`, que já contém alterações locais.

**Interfaces:** preservar `ProductGallery({ images, productName }: { images: ProductGalleryImage[]; productName: string })`; consumir `Slide` e `onChange(index)` da tarefa 1. Manter o índice da imagem ampliada sincronizado, com fallback válido ao mudar a galeria.

- [x] Criar testes Playwright contra `/produto/blusa-trico-cashmere` para contar as fotos, avançar/voltar por botão, selecionar por teclado e arraste, e abrir/fechar a ampliação. Confirmar que a asserção do novo carrossel falha antes da integração.
- [x] Substituir a implementação anterior de `ProductGallery` pelo novo componente, mantendo o Dialog existente com botão explícito de ampliação. Usar `detailUrl` e dimensões existentes, conservar a alternativa atual sem fotos e evitar dados demonstrativos.
- [x] Remover `lg:grid-cols-2` entre galeria e informações. Separar o bloco de largura total da galeria do contêiner centralizado dos detalhes e relacionados; preservar a estrutura semântica do produto e todos os dados/ações.
- [x] Repetir busca por `ProductGallery`, `carousel`, `carrossel`, `goPrev`, `goNext`, bibliotecas de slider e padrões de seleção de slides em `src`. Migrar qualquer outro consumidor equivalente encontrado para o mesmo componente; não converter listas de produtos ou editores administrativos em carrosséis.
- [x] Rodar `pnpm exec playwright test e2e/product-gallery.spec.ts e2e/vitrine.spec.ts --project=chromium`. Resultado esperado: nova interação e fluxos existentes de produto/WhatsApp passam. Se ambiente ou dados impedirem a execução, registrar a causa sem alterar dados do banco para contorná-la.

## Tarefa 3 — Casos extremos e validação responsiva

**Arquivos:** ampliar `e2e/product-gallery.spec.ts` e `src/components/ui/polaroid-line-carousel.test.ts` somente onde a evidência exigir. Para casos que não existam no seed, testar o componente em jsdom via `src/components/ui/polaroid-line-carousel.behavior.test.ts` com `// @vitest-environment jsdom`, React DOM/test utilities e mocks dos observers, sem nova rota pública de teste.

- [x] Adicionar testes de zero/uma foto, redução de movimento alterada após montagem, atualização de fotos/dimensões, cancelamento do ponteiro e limpeza de efeitos. Usar temporizadores controlados para provar pausa manual, foco, hover, visibilidade e ausência de avanço após desmontagem; verificar que pausa temporária encerrada não cancela pausa manual.
- [x] No browser, verificar 320, 390, 768, 1024 e 1440 px, incluindo orientação horizontal com pouca altura. Asserções: largura do carrossel coincide com a largura útil da página, `scrollWidth <= clientWidth`, informações começam após a galeria e controles permanecem dentro da área visível. Confirmar temas claro/escuro e toque com rolagem vertical; separar o que foi simulado do que foi verificado em aparelho real.
- [x] Inspecionar capturas de desktop e celular em uma rodada conjunta e corrigir defeitos encontrados em lote. Confirmar com no máximo mais uma rodada, sem ampliar o escopo visual.
- [x] Executar `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e os testes Playwright da tarefa 2. Comparar eventuais falhas com as alterações locais preexistentes; não corrigi-las fora do escopo silenciosamente.
- [x] Executar `git diff --check`; revisar somente o diff desta entrega e confirmar remoção do carrossel anterior, preservação das alterações alheias e ausência de novas dependências. Entregar resumo com verificações executadas e limitações reais. Sem commit ou push.

## Aceite e execução

Plano aprovado e executado diretamente nesta sessão. Implementação mantida no diretório e na branch local existentes, sem commit ou push.

## Evidências de conclusão — 16/10/2026

- `pnpm exec vitest run --maxWorkers=1`: 25 arquivos e 109 testes passando. Executado fora do sandbox após erros de acesso a arquivos temporários do Vitest no ambiente restrito.
- `pnpm exec playwright test e2e/product-gallery.spec.ts e2e/vitrine.spec.ts --project=chromium --workers=2 --max-failures=1`: 16 testes passando, incluindo toque nativo via CDP, rolagem vertical, ampliação, teclado, arraste, temas e larguras de 320 a 1440 px.
- `pnpm build`: passou, incluindo compilação, TypeScript e geração de páginas. `pnpm typecheck` também passou separadamente.
- `pnpm lint`: zero erros; nove avisos em arquivos preexistentes fora desta mudança. Lint dos arquivos da entrega sem avisos.
- `git diff --check`: passou. Nenhuma dependência adicionada; carrossel anterior removido e nenhum outro consumidor encontrado.
- Revisão independente identificou pausa de autoplay no modal e pintura de arraste com movimento reduzido; correções e recentralização no mesmo índice receberam regressões RED/GREEN. A revisão de retorno confirmou os três pontos resolvidos.
- Capturas inspecionadas em desktop claro, celular escuro e janela horizontal baixa: `test-results/product-gallery-capturas-r-0dc2a-s-dois-temas-e-janela-baixa-chromium/`. As capturas finais dispensam o banner de cookies antes de inspecionar controles.
- Limitação: a primeira imagem do produto do seed não carregou no ambiente; as capturas validam geometria, temas e controles, sem comprovar disponibilidade de todas as imagens remotas. Não foram alterados banco ou fontes de imagens para contornar isso. Toque verificado por emulação Chromium, não em aparelho físico.

A extensão de interface foi limitada a `children` (gatilho existente de ampliação) e `suspended` (pausa enquanto o modal está aberto). Nenhuma opção genérica de configuração foi adicionada. Tokens e estilos globais preservados.
