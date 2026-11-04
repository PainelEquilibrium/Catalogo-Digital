export const copyPtBr = {
  a11y: {
    skipToContent: "Ir para o conteúdo",
  },
  price: {
    onRequest: "Sob consulta",
    promoBadge: "Promoção",
  },
  catalog: {
    loadMore: "Carregar mais",
    loadingMore: "Carregando…",
    searchPlaceholder: "Buscar produtos",
    searchResults: (term: string) => `Resultados para “${term}”`,
    allProducts: "Todos os produtos",
    sortLabel: "Ordenar por",
    filtersLabel: "Filtros",
    clearFilters: "Limpar filtros",
    relatedProducts: "Você também pode gostar",
    collectionTitle: "Coleção",
  },
  sort: {
    novidades: "Novidades",
    preco_asc: "Menor preço",
    preco_desc: "Maior preço",
    destaque: "Destaques",
  },
  gallery: {
    label: "Fotos do produto",
    previous: "Imagem anterior",
    next: "Próxima imagem",
    pause: "Pausar apresentação",
    resume: "Retomar apresentação",
    enlarge: "Ampliar imagem",
    photo: (index: number) => `Foto ${String(index).padStart(2, "0")}`,
    position: (index: number, total: number) => `Foto ${index} de ${total}`,
  },
  whatsapp: {
    ctaLabel: "Comprar pelo WhatsApp",
    ctaLabelShort: "WhatsApp",
  },
  share: {
    share: "Compartilhar",
    copyLink: "Copiar link",
    copied: "Link copiado!",
  },
  legal: {
    privacidade: "Privacidade",
    cookies: "Cookies",
    termos: "Termos de uso",
  },
  consent: {
    message:
      "Usamos cookies para melhorar sua experiência. Você pode aceitar ou recusar cookies analíticos.",
    accept: "Aceitar",
    reject: "Recusar",
  },
  theme: {
    toggleLight: "Modo claro",
    toggleDark: "Modo escuro",
  },
  notFound: {
    title: "Página não encontrada",
    description:
      "O endereço pode estar incorreto ou o conteúdo não está mais disponível.",
    backHome: "Voltar ao início",
  },
  error: {
    title: "Não foi possível carregar",
    description: "Tente novamente em instantes.",
    retry: "Tentar novamente",
  },
  poweredByLabel: "Fornecido por",
  poweredBy: "Desenvolvido por Equilibrium Tecnologia",
} as const;

export type CopyPtBr = typeof copyPtBr;
