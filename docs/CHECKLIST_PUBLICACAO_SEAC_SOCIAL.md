# Checklist de publicação — SEAC Social

Checklist final a ser validado antes do Publish. Marcar cada item
conforme for verificado no ambiente de homologação.

## Parâmetros de atendimento (Configurações)

**Confira estes antes de tudo.** Eles não quebram nada quando estão
errados — apenas desligam regras em silêncio, e nenhum teste acusa. Em
2026-08-02 o intervalo mínimo estava em 0 na produção, deixado assim
durante a homologação para permitir retiradas seguidas (issue #92).

- [ ] Intervalo mínimo entre retiradas = **25 dias** (0 desliga a regra)
- [ ] Limite de Cesta Extra = **3**
- [ ] Liberação excepcional restrita a **administrador**
- [ ] Observação obrigatória na liberação excepcional **ligada**
- [ ] Bloqueio sem estoque **ligado**
- [ ] Baixa automática **ligada**
- [ ] Auditoria **ligada**
- [ ] Alerta de liberado sem retirada e inatividade conferidos com a SEAC

## Login

- [ ] Login com administrador funcionando
- [ ] Sair funcionando
- [ ] Usuário administrador identificado no topo

## Famílias

- [ ] Criar nova família
- [ ] Abrir família correta pelo ID
- [ ] Editar família
- [ ] Adicionar assistido
- [ ] Adicionar membro familiar
- [ ] Registrar observação social
- [ ] Responsável conta como morador
- [ ] Contadores da família atualizam corretamente
- [ ] Promover um membro já cadastrado a assistido
- [ ] Observação vinculada a um membro específico aparece com o nome dele
- [ ] Observação sem vínculo aparece como "Toda a família"

## Transferência entre famílias

- [ ] Administrador vê a opção ao cadastrar alguém ativo em outra família
- [ ] Atendente **não** vê a opção e entende o motivo
- [ ] Motivo é obrigatório (confirmação bloqueada com texto curto)
- [ ] Após transferir, a pessoa some da família de origem
- [ ] Após transferir, ela pode ser cadastrada como assistida no destino
- [ ] Quem é responsável principal **não** pode ser transferido
- [ ] Prazo e limite de extras **continuam valendo** depois da transferência
- [ ] A transferência aparece na auditoria com o motivo

## Atendimento

- [ ] Buscar assistido por documento
- [ ] Buscar assistido por nome
- [ ] Buscar assistido por telefone
- [ ] Entregar benefício quando liberado
- [ ] Bloquear antes dos 25 dias
- [ ] Registrar tentativa bloqueada
- [ ] Liberação excepcional exige administrador
- [ ] Liberação excepcional exige motivo

## Estoque

- [ ] Entrega baixa estoque
- [ ] Entrada funciona
- [ ] Saída funciona
- [ ] Ajuste funciona
- [ ] Movimentações aparecem
- [ ] Alertas de estoque baixo aparecem

## Relatórios

- [ ] Gerar relatório de famílias
- [ ] Gerar relatório de assistidos
- [ ] Gerar relatório de entregas
- [ ] Gerar relatório de bloqueios
- [ ] Gerar relatório de estoque
- [ ] Baixar CSV
- [ ] Abrir CSV no Excel

## Auditoria

- [ ] Entrega registrada
- [ ] Baixa de estoque registrada
- [ ] Tentativa bloqueada registrada
- [ ] Alteração de cadastro registrada
- [ ] Configuração registrada

## Painel

- [ ] Indicadores carregam
- [ ] Perfil do público atendido carrega
- [ ] Gráficos carregam
- [ ] Últimas entregas aparecem
- [ ] Últimas movimentações aparecem
- [ ] Alertas aparecem

## Proteções de segurança (verificadas no banco em 2026-08-02)

Reconfirmar pela interface, porque a correção foi no banco e o
comportamento visível é o que a equipe vai encontrar:

- [ ] Criar item no catálogo nasce com saldo 0
- [ ] Renomear Cesta Padrão ou Cesta Extra é recusado com mensagem clara
- [ ] Excluir esses benefícios é recusado
- [ ] CSV exportado abre no Excel sem executar fórmula (testar com um
      cadastro de nome `=1+1`, que deve aparecer como texto)

## Usuários

- [ ] Aprovar um cadastro pendente
- [ ] Alterar papel de um usuário
- [ ] Inativar e reativar
- [ ] Usuário inativo não consegue entrar

## Recebimentos

- [ ] Registrar recebimento com itens do catálogo
- [ ] Itens vinculados geram entrada no estoque

## Publicação

- [ ] Revisar telas principais
- [ ] Revisar responsividade básica
- [ ] Confirmar que não há erro de página
- [ ] Confirmar que rotas principais abrem
- [ ] Publicar versão