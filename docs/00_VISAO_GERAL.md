# Visão geral — SEAC Social

## Problema

O SEAC precisa acompanhar famílias, pessoas atendidas, retiradas e estoque sem
depender de registros desconectados. O sistema reduz duplicidades, aplica as
regras de entrega e cria rastreabilidade operacional.

## Objetivo do MVP

Disponibilizar um fluxo único para cadastro, atendimento, entrega, estoque,
auditoria, relatórios e acompanhamento gerencial. O MVP atual valida a
experiência e parte das regras com dados locais; produção exige persistência,
autenticação e segurança reais.

## Usuários

- Administrador: gestão completa, usuários, configurações e exceções.
- Atendente: famílias, pessoas, atendimentos e entregas autorizadas.
- Estoque: saldos, entradas, saídas, ajustes e recebimentos.
- Usuário pendente ou inativo: sem acesso ao sistema operacional.

## Módulos

Painel, Famílias, detalhe da família, Atendimento, Estoque, Recebimentos,
Composição de benefícios, Relatórios, Auditoria, Usuários e Configurações.

## Fluxo operacional de domingo

1. Equipe confere estoque e benefícios disponíveis.
2. Atendente localiza o assistido por documento, nome ou telefone.
3. Sistema recupera família, cadastro e histórico.
4. Regra central verifica prazo, tipo de cadastro, limite de Cesta Extra e saldo.
5. Entrega liberada é confirmada e vinculada ao responsável pela ação.
6. Benefício é baixado do estoque e a ação entra no histórico e na auditoria.
7. Bloqueios por prazo ou estoque são registrados mesmo sem entrega.
8. Painel e relatórios consolidam o movimento para acompanhamento.

## Escopo atual

- Interface completa dos módulos principais.
- Regras centrais de elegibilidade e registros locais.
- Persistência local em Zustand/localStorage para parte dos módulos.
- Exportação CSV de relatórios locais.
- Fundação de cliente e serviço Supabase ainda desacoplada das telas.

## Fora do escopo atual

- Banco remoto e migrations aplicadas.
- Autenticação e autorização reais.
- RLS e auditoria imutável no banco.
- Storage funcional para documentos e comprovantes.
- Migração dos stores locais.
- Lotes, validade, nota fiscal eletrônica, PDF e Excel nativo.

## Critérios gerais para produção

- Autenticação real, recuperação de acesso e gestão administrativa de usuários.
- Banco versionado, backup testado e políticas RLS revisadas.
- Dados pessoais fora do localStorage e protegidos segundo a LGPD.
- Operações críticas transacionais e auditáveis.
- Testes automatizados das regras e dos fluxos principais.
- Homologação funcional com usuários reais e plano de recuperação.
- Lint/build controlados e observabilidade de falhas.

