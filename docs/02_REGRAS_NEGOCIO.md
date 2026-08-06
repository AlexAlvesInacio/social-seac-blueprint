# Regras de negócio — SEAC Social

> `REGRAS_ATENDIMENTO_SEAC.md` continua sendo a fonte oficial específica do
> fluxo de atendimento. Em divergência, ela prevalece nesse domínio.

## Família e moradores

- O responsável integra a contagem de moradores.
- Contagem considera responsável, assistidos e membros, sem duplicar documento.
- Família pode ter vários assistidos e membros.
- Acompanhamento de 45 e 90 dias é informativo.
- O sistema não inativa família automaticamente por ausência de retirada.

## Assistidos e membros

- Assistido é quem pode receber benefício.
- Membro familiar compõe o núcleo, mas pode não receber benefício.
- Tornar um membro assistido exige cadastro explícito.
- Assistido inativo ou bloqueado não deve receber entrega regular.

## Documentos e duplicidade

- Busca aceita CPF, RG, documento, nome ou telefone.
- CPF, RG e outros documentos devem ser normalizados para comparação.
- Evitar duplicidade de responsável, assistido ou membro pelo documento.
- Registros sem documento exigem cuidado adicional de identificação.

## Cadastro definitivo

- Cadastro definitivo aprovado recebe Cesta Padrão.
- Está sujeito ao prazo mínimo e à disponibilidade de estoque.

## Cadastro extra

- Cadastro novo, provisório ou em avaliação recebe Cesta Extra.
- São permitidas até três retiradas acompanhadas.
- Exibir progresso 1/3, 2/3 e 3/3.
- Após a terceira retirada, sinalizar avaliação.
- Nunca converter automaticamente para definitivo.

## Regra dos 25 dias

- Nova retirada somente após 25 dias da última.
- Antes do prazo, bloquear e informar próxima data e dias restantes.
- Vale para Cesta Padrão e Cesta Extra.

## Estados da tela de Atendimento

- Estado inicial, antes de buscar: **“Nenhuma busca realizada”**.
- Busca sem resultado: **“Nenhum assistido encontrado para os dados
  informados.”**
- Busca elegível de cadastro definitivo: liberar Cesta Padrão.
- Busca elegível de cadastro extra: liberar Cesta Extra e exibir progresso 1/3,
  2/3 ou 3/3.
- Busca bloqueada por prazo: informar próxima data permitida e dias restantes.
- Busca bloqueada por estoque: impedir entrega e permitir somente o registro da
  tentativa bloqueada.
- Cadastro extra no limite: informar que as três retiradas foram concluídas e
  aguardar avaliação, sem conversão automática.

As ações disponíveis sem cadastro encontrado são criar pré-cadastro e criar
pré-cadastro com entrega de Cesta Extra, se houver estoque. O pré-cadastro pode
criar uma nova família ou adicionar um novo assistido a uma família aplicável.

No estado atual do código, os botões de pré-cadastro da busca sem resultado
apenas exibem mensagens e não persistem dados. A implementação futura deverá
gravar os dados cadastrais necessários e, no registro operacional: documento
pesquisado, tipo de pré-cadastro, data/hora, usuário responsável, motivo ou
contexto e vínculo com família ou pessoa quando aplicável.

## Função central de elegibilidade

`verificarElegibilidadeAtendimento(assistido, estoque)` é a função oficial que
controla o cenário da tela:

- `liberado_padrao`: cadastro definitivo elegível, com Cesta Padrão.
- `liberado_extra`: cadastro extra elegível, com Cesta Extra e progresso.
- `bloqueio_25dias`: prazo ainda não cumprido, com próxima data e dias restantes.
- `bloqueio_estoque`: benefício sem saldo suficiente.
- `extra_completou`: três retiradas extras concluídas; aguardar avaliação.

O accordion “Regras e fluxo” da tela é apenas explicativo. Seu texto não executa
nem substitui a função central de elegibilidade.

## Estoque e entregas

- Saldo insuficiente bloqueia a entrega.
- Falta de estoque nunca admite liberação excepcional.
- Entrega confirmada baixa automaticamente uma unidade do benefício pronto.
- O movimento deve ter tipo **“Baixa automática”** e origem **“Entrega
  realizada”**.
- A baixa é consequência direta da confirmação da entrega e registra assistido,
  família, usuário responsável e data/hora.
- Montagem de cesta baixa os itens da composição e aumenta o benefício pronto;
  a entrega baixa o benefício, não novamente seus itens.

## Benefícios adicionais na mesma visita

Homologado em 2026-08-06. A cesta do assistido continua sendo decidida pelo tipo
de cadastro (definitivo → Cesta Padrão, extra → Cesta Extra). Além dela, a tela
de entrega lista **todo benefício ativo** como caixa de seleção, para o que mais
sair naquela visita: Kit Gestante, Ovo de Páscoa, Cesta de Natal, Dia das
Crianças.

- Cada benefício marcado gera **sua própria entrega** e **sua própria baixa** de
  estoque, na mesma transação da cesta.
- O benefício adicional **nunca sai sozinho** — é sempre marcado junto de uma
  cesta liberada. Por isso ele **herda o prazo de 25 dias** da cesta e não tem
  contador próprio.
- **Falta de saldo bloqueia a entrega inteira**, cesta incluída. A tela
  desabilita a caixa quando o saldo é zero, de modo que isso só dispara se o
  estoque acabar entre abrir a tela e confirmar.
- **1 por família** é o padrão. Acima disso exige **administrador** e
  **justificativa**, mesmo desenho da liberação excepcional de prazo, e gera
  evento de auditoria com o benefício, a quantidade e quem autorizou.
- Todo benefício precisa de itens e composição para ser montado; sem montagem
  não há saldo, e sem saldo a caixa fica desabilitada.

## Tentativas bloqueadas

- Bloqueio por prazo deve ser registrado.
- Bloqueio por estoque deve ser registrado.
- Registrar tentativa não produz entrega nem baixa de estoque.

## Registros de pré-cadastro

- Registrar **“Pré-cadastro criado”** quando houver criação sem entrega.
- Registrar **“Pré-cadastro criado com entrega de Cesta Extra”** quando houver
  criação e entrega válida.
- Cada registro inclui documento pesquisado, tipo de pré-cadastro, data/hora,
  usuário responsável, motivo ou contexto e vínculo com família ou pessoa,
  quando aplicável.
- O segundo caso também gera entrega, baixa automática e auditoria; falta de
  estoque impede a entrega, mas não o registro coerente da tentativa.

## Liberação excepcional

- Somente administrador pode liberar entrega antes do prazo.
- Motivo/observação é obrigatório.
- Deve gerar entrega, movimentação e evento de auditoria identificados como
  excepcionais.

## Auditoria

- Registrar alterações cadastrais, entregas, baixas automáticas, bloqueios,
  liberações excepcionais, exclusões bloqueadas e configurações.
- Cada evento inclui usuário, data/hora, ação, módulo, registro e observação.
- Evitar duplicidade de eventos.

## Exclusão e inativação

- Excluir e inativar são ações diferentes.
- Registro com vínculo histórico não deve ser excluído; oferecer inativação.
- A tentativa de exclusão bloqueada deve ser auditada.
