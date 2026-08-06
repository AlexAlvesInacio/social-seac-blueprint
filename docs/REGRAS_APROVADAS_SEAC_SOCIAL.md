# Regras aprovadas — SEAC Social

Regras oficiais de negócio já homologadas. Toda alteração no sistema
deve respeitar este documento. Alterações em regra aprovada exigem
registro do motivo neste arquivo.

## 1. Família e moradores

- O responsável da família conta como morador.
- Contagem de moradores = responsável + assistidos + membros
  familiares.
- Evitar duplicidade por CPF, RG ou documento.
- Assistido é quem pode receber benefício.
- Membro familiar compõe a família, mas não necessariamente recebe
  benefício.
- Ao cadastrar a família, o **responsável é criado também como
  assistido**, do tipo escolhido pelo operador (Definitivo → Cesta
  Padrão / Extra → Avaliação). Documento (CPF/RG) do responsável
  continua obrigatório.
  - **Alteração registrada em 2026-07-27 (homologação, issue #43).**
    Motivo: no fluxo real o responsável quase sempre é o beneficiário;
    antes ele nascia só como membro e exigia um segundo cadastro manual
    para poder ser atendido. A criação passou a ser transacional
    (família + responsável + assistido) na RPC
    `criar_familia_com_responsavel`. Adicionar demais membros/assistidos
    segue sendo explícito, na tela de detalhe da família.

## 2. Atendimento

- Busca por CPF, RG, documento, nome ou telefone.
- Entrega permitida somente para assistido ativo e elegível.
- Intervalo mínimo para nova retirada: 25 dias (**padrão**).
  - O intervalo e o limite de extras são **parametrizáveis** em Configurações
    (`configuracoes.intervalo_minimo_dias` / `limite_extra`), autoritativos tanto
    no servidor quanto na tela de atendimento. `intervalo_minimo_dias = 0`
    desliga o bloqueio por prazo (sem espera). Registrado em 2026-07-28
    (homologação #43): o frontend passou a ler esses valores da tabela em vez de
    constantes fixas, e o CHECK do intervalo foi relaxado de `> 0` para `>= 0`.
- Antes do prazo configurado, a entrega fica bloqueada.
- Bloqueio por prazo deve registrar tentativa bloqueada.
- Liberação excepcional somente para Administrador.
- Liberação excepcional exige motivo/observação obrigatória.
- Entrega confirmada registra histórico da família, movimentação de
  estoque e auditoria.

## 3. Cesta Extra

- Cadastro em avaliação recebe Cesta Extra.
- Limite de 3 retiradas extras (progresso 1/3, 2/3, 3/3).
- Após a 3ª retirada, exibir aviso para avaliar cadastro definitivo.
- Após avaliação definitiva aprovada, assistido passa a receber
  Cesta Padrão.
- Não converter automaticamente para definitivo.
- A avaliação é **manual**, feita no atendimento (estado "Extra
  completou") por **administrador ou atendente** ativo, com duas
  saídas:
  - **Aprovar** — RPC `aprovar_assistido_definitivo` (Extra →
    Definitivo, benefício passa a Cesta Padrão).
  - **Negar** — RPC `inativar_assistido` (assistido vira inativo,
    deixa de receber e sai da busca de atendimento).
  - **Registrado em 2026-07-28 (homologação #43).** Motivo: o estado
    "Extra completou" não tinha ação de avaliação; faltava permitir a
    decisão manual que a própria regra prevê ("não converter
    automaticamente").

## 4. Acompanhamento

- Alerta após 45 dias sem retirada: apenas informativo.
- Contato necessário após 90 dias sem retirada: apenas informativo.
- Não bloquear entrega automaticamente.
- Não tornar família inativa automaticamente.
- Não gerar tarefa automática.

## 5. Estoque

- Entrega baixa automaticamente o estoque do benefício entregue.
- Entrada, saída, ajuste e baixa automática aparecem nas
  movimentações.
- Itens abaixo do mínimo aparecem como atenção.
- Itens zerados aparecem como sem estoque.
- O estoque físico de itens tem tela própria (Itens e composição →
  Estoque de itens), com entrada, saída e ajuste. O motivo é
  obrigatório no ajuste — é o que identifica o inventário no ledger.
  Aprovado em 2026-08-06.

## 5.1 Benefícios adicionais na entrega (aprovado em 2026-08-06)

- Todo benefício ativo aparece como caixa de seleção na tela de
  entrega, além da cesta decidida pelo tipo de cadastro.
- Cada marcado gera entrega e baixa próprias, na mesma transação.
- O adicional nunca sai sozinho e herda o prazo de 25 dias da cesta.
- Sem saldo do adicional, a entrega inteira é bloqueada.
- 1 por família é o padrão; acima disso exige administrador,
  justificativa e gera auditoria.

## 6. Configurações

- Itens, unidades, categorias, benefícios, doadores, fornecedores e
  parâmetros são funcionais.
- Excluir e inativar são ações diferentes.
- Se houver vínculo, a exclusão deve ser bloqueada e o sistema deve
  oferecer inativação.
- Tentativa bloqueada é registrada na auditoria.

## 7. Relatórios

- Relatórios devem gerar visualização em tela.
- Exportação CSV deve funcionar (UTF-8 com BOM, separador `;`,
  cabeçalhos em português).
- Botão Excel direto removido nesta fase.
- PDF não é obrigatório nesta fase.
- CSV é o formato oficial para Excel e Power BI.

## 8. Auditoria

- Registrar alterações de cadastro.
- Registrar entregas.
- Registrar baixas automáticas de estoque.
- Registrar tentativas bloqueadas (prazo e estoque).
- Registrar liberação excepcional (com motivo).
- Registrar exclusões bloqueadas.
- Registrar alterações em configurações.
- Sem duplicidade de registros.

## 9. Perfis de acesso

- Perfis oficiais: `admin`, `atendente`, `estoque`, `pendente`.
- Admin acessa tudo, inclusive `/usuarios` e liberação excepcional.
- Atendente: painel, atendimento, famílias, assistidos, membros,
  entregas.
- Estoque: painel, estoque, recebimentos, movimentações.
- Pendente/inativo não acessam o sistema.

## 10. Painel — dashboard operacional

- Painel usa dados reais das telas Famílias, Atendimento, Estoque,
  Relatórios e Auditoria; não cria contagens paralelas.
- Gráficos só exibem itens com valor real (dias com atendimento e
  benefícios com entrega).
- Status de famílias no gráfico segue as cores oficiais: Liberado
  verde, Bloqueado vermelho, Avaliar laranja (`#E8712A`), Inativo
  cinza.
- Paleta oficial dos gráficos: azul `#1E5AA8`, laranja `#E8712A`,
  azul claro `#4C8FD1`, laranja claro `#F4A96B`.