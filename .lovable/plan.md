# Finalizar tela /configuracoes — SEAC Social

Tornar a tela de Configurações totalmente funcional (criar, editar, inativar, excluir com trava, auditoria) mantendo o layout visual atual aprovado (abas em cards, tabelas, botão verde de novo, badges de status, cores e menu).

## Escopo mantido (não muda)

- Menu lateral, topo, logo, cores e tipografia
- Estrutura de 7 abas em cards: Itens, Unidades, Categorias, Benefícios, Doadores, Fornecedores, Parâmetros
- Estilo das tabelas, botão verde “Novo …” no topo direito, ícones de editar/excluir na última coluna
- Layout atual da aba Parâmetros em grid de cards
- Dados de exemplo já existentes (preservados como seed inicial)

## Estado e persistência

Como o objetivo é homologação visual funcional, o estado das 7 abas passa a viver em um store local do módulo (Zustand + `persist` em `localStorage`, chave `seac.configuracoes.v1`), inicializado com os dados de exemplo atuais. Isso permite criar/editar/inativar sem depender de backend agora, e deixa a camada pronta para ser trocada por Lovable Cloud depois sem alterar as telas.

Também é criado um store leve de **auditoria** (`seac.auditoria.v1`) que registra cada ação (módulo, tipo, registro afetado, usuário atual, data/hora, observação). A tela `/auditoria` já existente passa a ler desse store para exibir os eventos gerados por Configurações — sem alterar seu layout.

## Comportamento comum a todas as abas de cadastro

- **Novo**: abre um `Sheet` lateral (mesmo componente já usado em Itens) com o formulário da entidade.
- **Editar**: abre o mesmo `Sheet` preenchido.
- **Excluir**: `AlertDialog` de confirmação.
  - Se o registro tem vínculo (ver “Trava de exclusão” abaixo), o botão “Excluir” fica desabilitado e o diálogo oferece apenas **Inativar**, explicando o motivo (“Registro já usado em … Por integridade, apenas é possível inativar.”).
- **Status**: badge Ativo/Inativo. Registros inativos ficam visíveis na tela de Configurações (com badge cinza) mas são filtrados dos selects operacionais nas demais telas.
- **Busca / filtro**: mantém os campos já presentes; passam a filtrar de verdade a tabela.
- **Auditoria**: toda ação (criar / editar / inativar / reativar / excluir / alterar parâmetro) chama `registrarAuditoria(...)`.

### Trava de exclusão (integridade)

Função `temVinculo(entidade, id)` consulta:

- Itens → composição de benefício, movimentações de estoque, recebimentos
- Unidades / Categorias → qualquer item que as use
- Benefícios → composição, entregas em `/atendimento`, estoque
- Doadores → recebimentos do tipo Doação
- Fornecedores → recebimentos do tipo Compra

Se houver vínculo → apenas inativar. Sem vínculo → excluir de fato.

Para o MVP visual, essa checagem é feita contra os stores locais existentes (estoque, recebimentos, composição, atendimento). Onde ainda não houver store, a função retorna `false` (permite excluir) e um TODO fica marcado.

## Validações (Zod, por formulário)

- Código: obrigatório, único dentro da entidade, sem espaços.
- Nome: obrigatório, trim, 1–120 chars.
- Status: obrigatório (default Ativo).
- Item: categoria e unidade padrão obrigatórias; estoque mínimo inteiro ≥ 0.
- Benefício: tipo obrigatório; `controlaEstoque` boolean.
- Doador/Fornecedor: documento opcional; se preenchido, aceita CPF (11) ou CNPJ (14) — validação de formato apenas, sem cálculo de dígito.
- Erros exibidos inline abaixo do campo, no padrão shadcn já usado.

## Abas — conteúdo específico

Cada aba passa a ter:

- Formulário completo no `Sheet` (Novo/Editar) com os campos listados no pedido.
- Ações “Editar” e “Excluir/Inativar” funcionais na última coluna.
- Botão verde “Novo …” no canto superior direito (já existe visualmente).
- Filtro/busca funcional quando já existe no layout.

**Benefícios** — corrigido: “Comida de Rua” substitui qualquer referência a “Marmita” como benefício principal (o dado inicial já está correto; a mudança é reforçada no seed e no select de tipo).

**Parâmetros** — o card grid atual vira editável:

- Campos de texto viram `Input` (com sufixo “dias”, “retiradas” etc.).
- Regras Sim/Não continuam como `Switch`.
- “Liberação excepcional” vira `Select` (Apenas Administrador / Admin + Atendente).
- Botão **Salvar parâmetros** persiste no store `seac.parametros.v1`, mostra `toast` de sucesso e registra auditoria (uma entrada por parâmetro alterado).
- `src/lib/atendimento-regras.ts` passa a ler os valores desse store (com fallback para os defaults atuais), para que a mudança em Configurações reflita de verdade em `/atendimento`. A assinatura da função `verificarElegibilidadeAtendimento` não muda — só a fonte dos números.

## Integrações internas (selects que passam a filtrar por Ativo)

- `/estoque` e `/recebimentos`: selects de item e unidade → só ativos.
- Composição por benefício: itens ativos + benefícios ativos.
- `/atendimento`: benefícios ativos.
- `/recebimentos` tipo Doação: doadores ativos. Tipo Compra: fornecedores ativos.

Essas telas passam a importar os mesmos stores do módulo de Configurações (helpers `getItensAtivos()`, `getUnidadesAtivas()`, etc.), sem mudar layout dessas telas.

## Detalhes técnicos

Arquivos:

- `src/lib/config-store.ts` — Zustand stores (`useItens`, `useUnidades`, `useCategorias`, `useBeneficios`, `useDoadores`, `useFornecedores`, `useParametros`) com `persist` e seed inicial idêntico aos dados de exemplo atuais.
- `src/lib/auditoria-store.ts` — store de auditoria + `registrarAuditoria({ modulo, tipo, registro, observacao? })`.
- `src/lib/config-schemas.ts` — schemas Zod por entidade.
- `src/lib/config-vinculos.ts` — `temVinculo(entidade, id)` consultando os stores existentes.
- `src/routes/configuracoes.tsx` — refatorado para consumir os stores; formulários por entidade em `Sheet`; `AlertDialog` de exclusão; filtros funcionais; aba Parâmetros editável e persistente. Layout atual preservado 1:1.
- `src/lib/atendimento-regras.ts` — passa a ler `useParametros` (fallback para defaults).
- `src/routes/auditoria.tsx` — passa a listar eventos do store; layout inalterado.
- `src/routes/estoque.tsx`, `src/routes/recebimentos.tsx`, `src/routes/composicao-cesta.tsx`, `src/routes/atendimento.tsx` — apenas trocam as fontes dos selects para as helpers de “ativos”; nenhum ajuste visual.

Dependência nova: `zustand` (já compatível com o stack).

## Fora do escopo

- Nenhuma alteração no menu lateral, topo, logo, cores ou estrutura das outras telas além dos selects citados.
- Nenhuma migração de banco (persistência é local por enquanto, conforme foco de homologação visual).
- Nenhum novo módulo além do que está pedido.
