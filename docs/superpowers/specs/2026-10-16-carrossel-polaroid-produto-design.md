# Carrossel Polaroid na página do produto

Data: 16/10/2026. Status: aprovada pelo usuário e implementada; evidências no plano correspondente.

Complemento aprovado: substituir também outros usos do carrossel padrão, caso existam. A busca inicial encontrou somente `ProductGallery`, com um único consumidor em `/produto/[slug]`. Reconfirmar durante a implementação.

## Objetivo e apresentação

Substituir a galeria de `/produto/[slug]` pelo modelo Polaroid Line Carousel fornecido pelo usuário: fotos penduradas em uma corda curva, com pregadores, balanço, arraste e navegação. O carrossel ocupa toda a largura disponível da página, fora do limite `max-w-6xl`. Nome, categoria, preço, atributos e ações ficam abaixo dele em todos os breakpoints. As informações e os produtos relacionados continuam em um contêiner centralizado com largura máxima e margens responsivas.

O visual solicitado prevalece sobre a direção editorial anterior apenas nesta galeria. Cores de fundo e texto continuam usando os tokens do branding e funcionando nos temas claro e escuro.

## Integração

- Criar `src/components/ui/polaroid-line-carousel.tsx`, conforme o alias existente `@/components/ui`. O projeto já tem TypeScript, Tailwind e shadcn; não precisa de instalação nem de uma pasta paralela na raiz.
- Adaptar `src/components/catalog/product-gallery.tsx` para fornecer as fotos reais da galeria na ordem atual. Preservar o diálogo de ampliação e a imagem alternativa quando faltarem fotos.
- Alterar o layout de `src/app/(vitrine)/produto/[slug]/page.tsx` para colocar a galeria acima das informações, removendo as duas colunas entre galeria e detalhes.
- Concentrar textos de controles e anúncios acessíveis em `src/lib/copy/pt-br.ts`. Estilos próprios ficam isolados no componente ou em arquivo CSS dedicado a ele, sem alterar tokens globais.
- Não incluir a página demo, fotos do Unsplash ou paisagens geradas por canvas na integração de produtos. Usar as imagens existentes com `next/image`, tamanhos responsivos e prioridade apenas para a primeira foto.

## Responsividade

O mesmo modelo funciona em celular, tablet e desktop. Proposta inicial de altura: 440 px abaixo de 640 px, 540 px entre 640 e 1023 px e 640 px a partir de 1024 px, limitada pela altura útil da janela quando necessário. Ajustar largura dos cartões ao espaço disponível, mantendo foto, pregador e controles inteiros na vertical. Vizinhos podem aparecer parcialmente nas laterais, contidos pelo carrossel sem criar rolagem horizontal na página.

Os controles têm área de toque mínima de 44 px. A imagem mantém a proporção dentro da moldura, sem cortar partes da roupa. Detalhes abaixo usam 16 px de margem no celular e 24 px a partir de 640 px, com largura máxima de 1152 px.

## Interação e acessibilidade

- Arraste por mouse ou toque, clique nos cartões vizinhos e setas de teclado e botões para selecionar a foto.
- Preservar rolagem vertical por toque. Tratar cancelamento de gesto e liberação da captura do ponteiro.
- Manter balanço e acomodação por mola do exemplo. Respeitar mudanças de `prefers-reduced-motion`, removendo balanço, transições animadas e autoplay nesse modo.
- Autoplay a cada 4500 ms, com controle visível para pausar e retomar. Pausar durante interação, foco dentro da galeria, passagem do mouse, saída da área visível e aba oculta.
- Contador e nomes acessíveis em português. Não anunciar cada quadro da animação; anunciar a seleção ao concluir uma interação manual.
- Botão explícito para ampliar a foto selecionada, preservando foco e fechamento acessível do diálogo atual.
- Uma imagem dispensa autoplay e navegação redundante; galeria vazia exibe a alternativa existente. Mudança de dimensões ou quantidade de fotos mantém o índice válido. Nenhum contador pode mostrar `01 / 00`.

## Escopo e preservação

Não alterar banco, consultas, uploads, metadados, preço, atributos, compartilhamento, WhatsApp ou produtos relacionados. Não adicionar dependências. Preservar as alterações locais já existentes no repositório. Sem commit ou push.

## Validação prevista

- Testes pequenos das funções de índice, limites e física adaptadas do exemplo.
- Playwright para seleção por botão, teclado e arraste, ampliação, pausa e redução de movimento; verificar galeria vazia e de uma foto em fixture quando necessário.
- Conferir larguras de 320, 390, 768, 1024 e 1440 px, sem overflow da página, com informações abaixo da galeria e temas claro/escuro.
- Executar lint, TypeScript, testes relevantes e build. Registrar limitações caso dados ou ambiente impeçam validação real da rota.

## Conclusão

Spec e plano aprovados antes da implementação. Entrega validada e mantida localmente, sem commit ou push. Evidências e limitações registradas em `docs/superpowers/plans/2026-10-16-carrossel-polaroid-produto.md`.
