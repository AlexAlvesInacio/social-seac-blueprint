# Limpar o logo: sem fundo cinza e sem a palavra "SEAC"

O fundo cinza claro e a palavra "SEAC" fazem parte do próprio arquivo PNG do logo — não vêm de CSS. Preciso gerar uma nova versão da imagem.

## Passos

1. Usar `imagegen--edit_image` sobre `/mnt/user-uploads/image-5.png` com prompt para:
   - Remover a palavra "SEAC" (o retângulo azul-marinho com o texto)
   - Manter apenas a casinha (telhado com chaminé) e as 4 figuras coloridas de pessoas (azul, laranja, amarelo, vermelho)
   - Fundo totalmente transparente (sem o retângulo cinza/branco arredondado)
   - Salvar em `/tmp/seac-logo-clean.png`
2. Subir a nova imagem para o CDN via `lovable-assets create`, sobrescrevendo `src/assets/seac-logo.png.asset.json`.
3. Nada no CSS muda — a sidebar e a tela de login continuam apontando para `seacLogo.url` e passam a exibir apenas a casinha com as pessoas, sem fundo e sem texto.

## O que não muda

- Layout, tamanhos e posições das telas.
- Imagem institucional grande do SEAC no lado direito da tela de login (continua igual).

Confirma?
