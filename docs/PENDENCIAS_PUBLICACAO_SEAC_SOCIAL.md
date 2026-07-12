# Pendências para publicação — SEAC Social

Lista de itens que precisam ser validados/resolvidos antes de publicar o
sistema. Enquanto houver pendências abertas, tratar como versão de
homologação.

## 1. Pré-cadastro pelo atendimento
- Ação “Criar pré-cadastro”.
- Ação “Criar pré-cadastro e entregar Cesta Extra”.
- Garantir criação da família quando necessário.
- Garantir criação do assistido em avaliação.
- Garantir baixa de estoque quando houver entrega junto.
- Garantir histórico da família e registro na auditoria.

## 2. Liberação excepcional
- Exigir perfil Administrador.
- Exigir observação obrigatória.
- Registrar auditoria (usuário, motivo, assistido, benefício).
- Não permitir quando o bloqueio for falta de estoque.

## 3. Relatórios
- Motor central `gerarRelatorio` já usa os stores reais de Famílias,
  Atendimento, Estoque e Auditoria.
- CSV homologado como exportação inicial (UTF-8 + BOM, `;`, dd/mm/aaaa)
  para uso em Excel e Power BI.
- Pendências:
  - Exportação PDF nativa (botão removido da tela até estar pronto).
  - Exportação Excel nativa `.xlsx` (botão removido da tela até estar
    pronto; CSV atende Excel e Power BI nesta fase).
  - Recebimentos com store real (hoje o relatório usa espelho da tela).
  - Validar cobertura de todos os filtros com dados reais.

## 4. Painel
- Validar se todos os indicadores usam dados reais:
  famílias cadastradas, assistidos ativos, cestas em estoque, entregas
  hoje, entregas no mês, alertas de estoque baixo, últimas entregas,
  últimas movimentações.

## 5. Recebimentos
- Definir regra oficial:
  - registrar apenas a origem, ou
  - registrar origem **e** gerar entrada no estoque.
- Após a definição, aplicar a regra de forma consistente em
  `/recebimentos`, `/estoque` e relatórios.

## 6. Publicação
- Validar persistência real dos dados (não apenas localStorage/mock).
- Validar banco/Supabase e migrações.
- Validar permissões de usuário por perfil.
- Validar acesso do perfil Administrador.
- Validar segurança básica (RLS, políticas, SECURITY DEFINER controlado).
- Confirmar que nenhum dado crítico depende apenas de mock/localStorage.

---

Ao concluir qualquer item, mover a descrição correspondente para
`HOMOLOGACAO_SEAC_SOCIAL.md` como homologado e registrar em
`REGRAS_APROVADAS_SEAC_SOCIAL.md` se gerar regra nova.