# PoweredByEquilibrium

Assinatura reutilizável da Equilibrium para projetos React 18+ e Next.js. A pasta é autocontida: não usa CSS externo, Tailwind, `next/image` nem pacote adicional.

## Instalação

Copie esta pasta inteira para:

```text
src/components/PoweredByEquilibrium
```

Importe pelo arquivo `index.ts`:

```tsx
import { PoweredByEquilibrium } from "@/components/PoweredByEquilibrium";
```

Se o projeto não possuir o alias `@`, use um caminho relativo equivalente.

## Rodapé recomendado — automático

Use sem a propriedade `theme`. O padrão é `auto`: o componente calcula o fundo real, inclusive camadas transparentes, e troca tanto o logo quanto o texto entre preto e branco.

```tsx
<div style={{ display: "flex", justifyContent: "center", paddingBlock: 20 }}>
  <PoweredByEquilibrium variant="footer" showTextFallback={false} />
</div>
```

Esta é a opção indicada quando o site possui tema claro/escuro, paletas ou fundos que podem mudar.

## Rodapé sempre escuro

`theme` descreve o fundo. Em fundo escuro, o componente usa a versão branca:

```tsx
<div style={{ display: "flex", justifyContent: "center", paddingBlock: 20 }}>
  <PoweredByEquilibrium
    variant="footer"
    theme="dark"
    showTextFallback={false}
  />
</div>
```

## Rodapé sempre claro

Em fundo claro, o componente usa a versão preta:

```tsx
<div style={{ display: "flex", justifyContent: "center", paddingBlock: 20 }}>
  <PoweredByEquilibrium
    variant="footer"
    theme="light"
    showTextFallback={false}
  />
</div>
```

## Uso mínimo

```tsx
<PoweredByEquilibrium variant="minimal" logo="icon" showTextFallback={false} />
```

Variantes disponíveis: `footer`, `login`, `menu`, `badge` e `minimal`.

Logos disponíveis: `compact`, `horizontal`, `square`, `icon` e `icon2`.

Os arquivos de imagem são carregados de `https://assets.equilibriumtecnologia.com.br`. Se o projeto possuir uma Content Security Policy restritiva, permita esse domínio em `img-src`.

`showTextFallback` exibe “Equilibrium Tecnologia” apenas se a imagem não carregar. Use `textOnly` para mostrar somente o texto.

O modo automático acompanha mudanças de classe/style nos ancestrais, redimensionamento, preferência do sistema e transições ou animações CSS. Gradientes e imagens de fundo não expõem uma cor computada única ao navegador; nesses casos, use explicitamente `theme="dark"` ou `theme="light"` conforme o fundo visual.

## Atualização de componentes antigos

1. Exclua o arquivo antigo `PoweredByEquilibrium.tsx`.
2. Cole esta pasta em `src/components/PoweredByEquilibrium`.
3. Atualize o import para `@/components/PoweredByEquilibrium`.
4. Em fundos dinâmicos, remova `theme="light"` ou `theme="dark"` para ativar o padrão automático.

O teste do cálculo de contraste pode ser executado com Node.js 24+:

```bash
node --test src/components/PoweredByEquilibrium/css-background-contrast.test.cjs
```
