# Substituir ícone de coração pelo logo SEAC

O ícone `Heart` (coração) usado como logo da marca aparece em 2 lugares:

1. **Sidebar** (`src/components/app-sidebar.tsx`, linha 86) — quadradinho verde com coração no topo do menu lateral, ao lado de "SEAC Social".
2. **Tela de login** (`src/routes/auth.tsx`, linha 30) — quadradinho verde com coração acima do título "Acesse o SEAC Social".

Observação: os ícones `HandHeart` e `HeartHandshake` NÃO serão alterados — eles representam ações (Atendimento, Doações) e não a marca.

## Passos

1. Fazer upload do logo SEAC (image-5.png — casinha com famílias e "SEAC") como asset CDN via `lovable-assets`, salvando em `src/assets/seac-logo.png.asset.json`.
2. Em `src/components/app-sidebar.tsx`:
   - Substituir o bloco `<div className="...bg-primary..."><Heart /></div>` por `<img src={seacLogo.url} alt="SEAC Social" />` mantendo o mesmo tamanho (~40px) e cantos arredondados, sem fundo verde (o logo já tem identidade própria).
   - Remover import `Heart`.
3. Em `src/routes/auth.tsx`:
   - Substituir o bloco `<div className="...bg-primary..."><Heart /></div>` acima do título por `<img src={seacLogo.url} alt="SEAC Social" />` com tamanho ~56px.
   - Remover import `Heart`.

## O que NÃO muda

- Layout, cores, tipografia, cards, textos e demais ícones.
- A imagem grande do SEAC no lado direito da tela de login continua igual.
- `HandHeart` no menu (Atendimento) e `HeartHandshake` em Doações/Configurações/Famílias permanecem.

Confirma que quer aplicar assim?
