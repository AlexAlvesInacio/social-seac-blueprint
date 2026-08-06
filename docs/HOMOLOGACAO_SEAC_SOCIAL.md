# Homologação — SEAC Social

Documento oficial de homologação do sistema SEAC Social antes da
publicação. Registra o que já foi validado, as regras principais e as
observações relevantes de cada área do MVP.

> Regra de trabalho: toda nova alteração deve respeitar as telas e
> regras aqui homologadas. Antes de alterar uma tela já aprovada,
> verificar este documento. Se uma regra aprovada for alterada,
> registrar o motivo e atualizar este documento.

---

## 1. Login / Auth (`/auth`)

- **Status:** Homologado
- **Validado:** login do administrador, mensagem para usuários pendentes
  e inativos, saída do sistema, identificação do usuário logado no topo.
- **Regras principais:** primeiro usuário vira admin automaticamente;
  demais usuários ficam pendentes até liberação; pendente e inativo
  não acessam o sistema.
- **Observações:** confirmação por e-mail desativada na homologação.
- **Pendências não bloqueantes:** revisar mensagens de erro amigáveis
  em cenários raros (usuário sem profile, sessão expirada).

## 2. Painel (`/painel`)

- **Status:** Homologado
- **Validado:** KPIs principais, perfil do público atendido, gráficos
  (Atendimentos por dia, Entregas por benefício, Famílias por status),
  cards de últimas entregas, últimas movimentações, alertas de estoque,
  aguardando avaliação e contato necessário 90+ com deep-links.
- **Regras principais:** o painel usa dados reais de Famílias,
  Atendimento, Estoque, Relatórios e Auditoria — sem contagens
  paralelas. O responsável da família conta como morador. Contato 90+
  é apenas informativo.
- **Observações:** paleta de gráficos oficial azul + laranja
  (`#1E5AA8`, `#E8712A`, `#4C8FD1`, `#F4A96B`). Cores semânticas de
  status mantidas no gráfico "Famílias por status".
- **Pendências não bloqueantes:** ver PENDENCIAS_PUBLICACAO.

## 3. Famílias (`/familias`)

- **Status:** Homologado
- **Validado:** listagem, filtros por foco (avaliar / contato90),
  contadores oficiais (total, definitivos, extras, avaliar, 90+,
  bloqueadas/inativas), abertura do detalhe pelo ID.
- **Regras principais:** contadores refletem o total real de famílias;
  acompanhamento (45 e 90 dias) é informativo.
- **Observações:** filtros pré-aplicados via URL suportados
  (`?foco=avaliar` e `?foco=contato90`).
- **Pendências não bloqueantes:** filtros de nome/CPF/telefone/bairro
  na barra superior podem ser ativados em fase posterior.

## 4. Detalhe da família (`/familias/:id`)

- **Status:** Homologado
- **Validado:** dados da família, endereço, contadores, assistidos,
  membros familiares, histórico de entregas, observações sociais,
  edição da família, adicionar/editar assistido e membro.
- **Regras principais:** responsável conta como morador; assistidos e
  membros são deduplicados por documento.
- **Observações:** homologado originalmente sobre o store local
  `familias-store`; desde 2026-07-30 a tela é Supabase-only (o store
  local foi removido — ver `07_STATUS_IMPLEMENTACAO.md`).
- **Pendências não bloqueantes:** anexos e documentos digitalizados
  ficam para fase posterior.

## 5. Atendimento (`/atendimento`)

- **Status:** Homologado
- **Validado:** busca por documento, nome e telefone; exibição dos
  dados do assistido, família, endereço, última retirada, próxima
  data permitida; entrega liberada, entrega bloqueada por prazo,
  entrega bloqueada por estoque; liberação excepcional pelo admin;
  pré-cadastro (com e sem entrega de Cesta Extra); progresso 1/3,
  2/3, 3/3 da Cesta Extra.
- **Regras principais:** regra dos 25 dias, apenas admin libera
  excepcionalmente, motivo obrigatório na liberação, baixa automática
  de estoque, histórico + auditoria em toda tentativa.
- **Observações:** função central `verificarElegibilidadeAtendimento`
  concentra as regras.
- **Pendências não bloqueantes:** validação por QR/foto do assistido
  fica para fase futura.

## 6. Estoque (`/estoque`)

- **Status:** Homologado
- **Validado:** saldos atuais, aba Movimentações, entrada, saída,
  ajuste, baixa automática (via entrega), alertas de estoque baixo,
  filtro `foco=alertas` via URL, valor total estimado.
- **Regras principais:** entrega baixa automaticamente 1 unidade do
  benefício; itens abaixo do mínimo aparecem como atenção; zerados
  como sem estoque.
- **Observações:** deep-links do Painel funcionam
  (`?tab=mov`, `?tab=saldos&foco=alertas`).
- **Pendências não bloqueantes:** controle por lote e validade fica
  para fase futura.

## 7. Recebimentos (`/recebimentos`)

- **Status:** Homologado
- **Validado:** registro de entrada de alimentos, origem (doação,
  compra, investimento próprio, ajuste), doador/fornecedor, valor,
  observação e usuário responsável.
- **Regras principais:** entrada de recebimento aumenta o estoque e
  gera movimentação; doações, compras e investimentos aparecem nos
  relatórios correspondentes.
- **Observações:** anexo de nota fiscal/comprovante é opcional.
- **Pendências não bloqueantes:** integração automática com nota
  fiscal eletrônica fica para fase futura.

## 8. Itens e composição (`/composicao-cesta`)

- **Status:** Homologado
- **Validado:** cadastro dos itens que compõem cada benefício
  (Cesta Padrão, Cesta Extra, Kit Gestante), quantidade por item,
  atualização da composição.
- **Regras principais:** montagem de cesta baixa os itens da
  composição e aumenta o benefício pronto; sem saldo, montagem
  bloqueada.
- **Observações:** entrega ao assistido baixa o benefício pronto,
  não os itens individuais. Desde 2026-08-06 a tela abre na aba
  **Estoque de itens**, que mostra os saldos do estoque físico, permite
  entrada/saída/ajuste por item e exibe o ledger `movimentacoes_itens`
  (antes invisível na aplicação).
- **Pendências não bloqueantes:** custo estimado por cesta a partir
  do valor médio dos itens.

## 9. Configurações (`/configuracoes`)

- **Status:** Homologado
- **Validado:** cadastro de itens, unidades, categorias, benefícios,
  doadores, fornecedores e parâmetros do sistema (intervalos,
  alertas).
- **Regras principais:** excluir e inativar são ações distintas; se
  houver vínculo, exclusão é bloqueada e o sistema oferece
  inativação; tentativa bloqueada é registrada em auditoria.
- **Observações:** acesso restrito ao perfil Administrador.
- **Pendências não bloqueantes:** exportar configurações para backup
  manual.

## 10. Relatórios com CSV (`/relatorios`)

- **Status:** Homologado
- **Validado:** 10 tipos de relatório com dados reais, filtros
  combinados (período, bairro, benefício, item, usuário, status),
  visualização em tabela, exportação CSV (UTF-8 com BOM, separador
  `;`, cabeçalhos em português), abertura correta em Excel e
  Power BI.
- **Regras principais:** CSV é a exportação oficial nesta fase;
  botões PDF e Excel nativo foram removidos.
- **Observações:** deep-link `?tipo=entregas` funciona a partir do
  Painel.
- **Pendências não bloqueantes:** PDF e Excel nativo ficam como
  melhorias futuras.

## 11. Auditoria (`/auditoria`)

- **Status:** Homologado
- **Validado:** registro de entregas, baixas automáticas de estoque,
  tentativas bloqueadas (prazo/estoque), liberações excepcionais,
  alterações de cadastro, exclusões bloqueadas, alterações em
  configurações, geração e exportação de relatórios.
- **Regras principais:** cada evento registra usuário, data/hora,
  ação, módulo, registro afetado e observação/motivo quando existir.
  Sem duplicação de registros.
- **Observações:** disponível para admin.
- **Pendências não bloqueantes:** exportação da auditoria como CSV
  em fase posterior.