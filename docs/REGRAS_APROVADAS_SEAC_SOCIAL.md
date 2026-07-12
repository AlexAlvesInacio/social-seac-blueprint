# Regras aprovadas — SEAC Social

Consolidação das regras de negócio já aprovadas e em vigor no sistema.
Este documento complementa `REGRAS_ATENDIMENTO_SEAC.md` e
`HOMOLOGACAO_SEAC_SOCIAL.md`.

## Parâmetros oficiais

| Parâmetro | Valor |
| --- | --- |
| Prazo mínimo para nova retirada | 25 dias |
| Alerta após liberação sem retirada | 45 dias |
| Contato necessário por inatividade | 90 dias |
| Limite de Cesta Extra | 3 retiradas |
| Após limite de retirada extra | Avaliar cadastro definitivo |
| Liberação excepcional | Apenas Administrador |
| Observação obrigatória na liberação excepcional | Sim |
| Bloqueio por falta de estoque | Sim |
| Baixa automática no estoque após entrega | Sim |
| Registrar auditoria de alterações | Sim |

## Atendimento

- Assistido só pode receber nova cesta após 25 dias da última retirada.
- Bloqueio antes do prazo exibe próxima data permitida.
- Cadastro definitivo recebe **Cesta Padrão** respeitando os 25 dias.
- Cadastro em avaliação recebe **Cesta Extra**, limitado a 3 retiradas
  (progresso 1/3, 2/3, 3/3). Após a 3ª, exibir alerta para avaliação de
  cadastro definitivo. Não converter automaticamente.
- Liberação excepcional apenas para Administrador, com observação
  obrigatória. Nunca liberar quando o bloqueio for falta de estoque.
- Falta de estoque bloqueia entrega e permite apenas registrar tentativa
  bloqueada.
- Toda tentativa gera histórico: entrega realizada, bloqueio por prazo,
  bloqueio por estoque, liberação excepcional, pré-cadastro criado, e
  pré-cadastro com entrega de Cesta Extra.

## Relatórios

- Tela `/relatorios` é somente leitura. Nenhum relatório cria, edita,
  exclui, inativa ou altera dados do sistema.
- Motor central: `src/lib/relatorios-store.ts` → `gerarRelatorio(tipo,
  filtros)`. Consome os mesmos stores das telas homologadas.
- Filtros combinados: período, bairro, benefício, item, usuário e
  status. Cada relatório aplica apenas os filtros compatíveis com sua
  fonte de dados.
- Geração explícita: nada é gerado ao abrir a tela. É preciso selecionar
  um card e clicar em "Gerar relatório".
- Exportação oficial nesta fase: CSV (UTF-8 com BOM, separador `;`,
  cabeçalhos em português, datas em dd/mm/aaaa, valores em BRL). Nome do
  arquivo: `seac-social-relatorio-[tipo]-[YYYY-MM-DD].csv`. CSV atende
  Excel e Power BI.
- Os botões PDF e Excel nativo foram removidos da tela nesta fase para
  evitar botão sem função. Voltam quando a exportação nativa for
  implementada.
- Toda geração e toda exportação CSV é registrada em Auditoria
  (ação `Relatório gerado` / `Relatório exportado CSV`, módulo
  `Relatórios`, com filtros aplicados e total de registros).

## Família

- Detalhe da família carregado pelo ID da URL.
- Responsável conta como morador.
- Moradores = responsável + assistidos + membros familiares, sem
  duplicidade por documento.
- Assistido pode receber benefício; membro familiar compõe a família.
- Histórico de entregas exibe apenas as entregas da própria família.

## Estoque

- Baixa automática ao confirmar entrega no atendimento.
- Movimentação registrada com: data/hora, item/benefício, tipo,
  quantidade, saldo após, usuário, origem, observação.
- Origem “Entrega realizada” vincula assistido, família, usuário e
  data/hora.
- Fonte única de saldos — a mesma usada em `/estoque`.

## Auditoria

- Registra usuário, data/hora, ação, módulo, registro afetado e
  observação/motivo quando existir.
- Deduplicação por 3 segundos para o mesmo evento evita registros
  repetidos por re-render ou cliques rápidos.
- Botão “Limpar histórico” disponível para Administrador.

## Configurações

- CRUD nas abas Itens, Unidades, Categorias, Benefícios, Doadores,
  Fornecedores e Parâmetros.
- Inativar ≠ excluir. Excluir só é permitido sem vínculos; com vínculo,
  bloquear e orientar inativação.
- Alterações relevantes são auditadas.

## Perfis

- Perfis oficiais: admin, atendente, estoque, pendente.
- Admin acessa tudo, inclusive `/usuarios` e liberação excepcional.
- Atendente: painel, atendimento, famílias, assistidos, membros,
  entregas.
- Estoque: painel, estoque, recebimentos, movimentações.
- Pendente/inativo não acessam o sistema.

## Painel — dashboard operacional

- Painel usa dados reais das telas Famílias, Atendimento, Estoque,
  Relatórios e Auditoria; não cria contagens paralelas.
- Contadores alinhados: Famílias cadastradas, Assistidos ativos,
  Entregas hoje e no mês, Cestas em estoque, Aguardando avaliação
  (`status = avaliar`), Contato necessário 90+
  (`acompanhamento = sem_retirada_90`).
- Responsável da família conta como morador no perfil do público
  atendido; assistidos e membros são deduplicados por documento.
- Gráficos só exibem itens com valor real (dias com atendimento,
  benefícios com entrega).
- Status de famílias no gráfico segue as cores oficiais do sistema:
  Liberado verde, Bloqueado vermelho, Avaliar laranja, Inativo cinza.
- Contato necessário 90+ é apenas informativo: não bloqueia entregas,
  não altera status da família automaticamente.

## Paleta oficial dos gráficos do Painel

- Azul principal: `#1E5AA8`
- Laranja principal: `#E8712A`
- Azul claro: `#4C8FD1`
- Laranja claro: `#F4A96B`
- Usada em: "Atendimentos por dia", "Entregas por benefício" e
  cor "Avaliar" do gráfico "Famílias por status".
- Cores semânticas de status (verde liberado, vermelho bloqueado,
  cinza inativo) permanecem, mantendo consistência com os chips de
  /familias.