## Contexto

Nos gráficos do /painel as barras e o pie estão saindo pretos (screenshot enviado) porque `hsl(var(--primary))` não resolve com o token atual em `oklch`, e as cores fixas do pie (`hsl(160 60% 45%)`, `hsl(280 60% 55%)`) fogem da identidade SEAC.

Azul + laranja é uma combinação forte: azul transmite confiança (mesma família do SEAC) e laranja destaca ação/urgência, com bom contraste sem visual carnavalesco.

## Proposta de paleta para gráficos

- Azul principal: `#1E5AA8` (SEAC azul institucional)
- Azul claro: `#4C8FD1`
- Laranja principal: `#E8712A`
- Laranja claro: `#F4A96B`

Definir como tokens em `src/styles.css`:

```
--chart-1: #1E5AA8;  /* azul */
--chart-2: #E8712A;  /* laranja */
--chart-3: #4C8FD1;  /* azul claro */
--chart-4: #F4A96B;  /* laranja claro */
```

## Aplicação em `src/routes/painel.tsx`

1. **Atendimentos por dia (30 dias)** — barra em azul (`--chart-1`).
2. **Entregas por benefício (mês)** — pie alternando azul/laranja/azul claro/laranja claro; remove os verdes/roxos atuais.
3. **Famílias por status** — mantém as cores semânticas de status (verde/vermelho/laranja/cinza) porque o requisito homologado exige consistência com os chips de /familias. O laranja de "Avaliar" passa a usar `--chart-2` para ficar alinhado com a nova paleta.
4. Substituir todos os `hsl(var(--primary))` dos charts por `var(--chart-1)` para garantir que a cor renderize (o problema do preto some).

## Guardrails

- Não altera menu, topo, logo, cards superiores nem bloco "Perfil do público".
- Não altera a paleta global do sistema — só os tokens de chart.
- Registrar a nova paleta de gráficos em `docs/REGRAS_APROVADAS_SEAC_SOCIAL.md` e `docs/HOMOLOGACAO_SEAC_SOCIAL.md`.

Confirma que posso seguir com esses tons de azul e laranja? Se preferir outro tom (ex.: azul mais escuro tipo `#0F3D7A` ou laranja mais queimado tipo `#C85A1E`), me diga antes de eu implementar.