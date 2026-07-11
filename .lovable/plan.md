## Diagnóstico

Os registros duplicados de "Tentativa bloqueada por prazo" às 20:42:50 e 20:35:56 vistos na tela são **dados antigos** persistidos em `localStorage` (chave `seac.auditoria.v1`), gravados antes da correção anterior — que removeu o `useEffect` de auto-auditoria no bloco de bloqueio por prazo.

Como o store é persistente, os eventos antigos continuam aparecendo mesmo depois da correção do código. Além disso, hoje não existe nenhuma proteção no store contra duplicidade acidental (React Strict Mode em dev, cliques repetidos, re-renderizações), então vale reforçar a proteção para o futuro.

## Ajustes propostos

### 1. `src/lib/auditoria-store.ts` — dedup no ponto de gravação
- No método `registrar`, antes de inserir o evento, comparar com o evento mais recente da lista.
- Se `usuario`, `acao`, `modulo`, `registro` e `observacao` forem iguais **e** a diferença de tempo for menor que 3 segundos, ignorar a inserção.
- Regra vale para toda ação (entrega, baixa, tentativa bloqueada, etc.) sem alterar o formato dos eventos.

### 2. `src/lib/atendimento-store.ts` — dedup em `registrarBloqueio`
- Mesmo padrão: se o último bloqueio tem `documento + motivo` iguais dentro de 3 segundos, não duplicar.
- Impede que dois cliques rápidos em "Registrar tentativa bloqueada" gerem duas linhas.

### 3. `src/routes/auditoria.tsx` — botão "Limpar histórico"
- Adicionar botão discreto ao lado de "Limpar filtros", visível apenas para o perfil Administrador.
- Ao clicar, abre um `AlertDialog` de confirmação e chama `useAuditoria().limpar()`.
- Permite ao usuário remover de uma vez os registros duplicados legados sem precisar mexer no armazenamento do navegador.
- Layout, cores, cards, menu lateral e topo permanecem intactos.

## O que **não** muda

- Layout visual aprovado da tela de Auditoria e da tela de Atendimento.
- Menu lateral, topo, paleta, cards e estrutura de colunas.
- Regras de entrega, estoque, 25 dias e liberação excepcional.
- Formato dos eventos de auditoria já registrados.

## Validação

1. Abrir /auditoria e usar o novo botão "Limpar histórico" para remover as linhas duplicadas legadas.
2. Buscar Alex Alves Inacio em /atendimento (bloqueado por prazo) — nenhum novo evento deve ser criado só por renderizar.
3. Clicar em "Registrar tentativa bloqueada" em um cenário sem estoque duas vezes seguidas — apenas 1 linha em /auditoria.
4. Entregar uma cesta — 1 "Entrega realizada" + 1 "Baixa automática", sem duplicatas.
5. Liberação excepcional — 1 "Liberação excepcional" + 1 "Entrega realizada" + 1 "Baixa automática".
