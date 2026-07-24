import type { PostgrestError } from "@supabase/supabase-js";

export type FamiliaSupabaseId = string;
export type PessoaSupabaseId = string;
export type MembroFamiliarSupabaseId = string;
export type AssistidoSupabaseId = string;
export type ObservacaoSocialSupabaseId = string;

export type FamiliaStatusSupabase = "liberado" | "bloqueado" | "inativo" | "avaliar";

export type FamiliaAcompanhamentoSupabase =
  | "em_dia"
  | "atencao_45"
  | "atencao_60"
  | "sem_retirada_90"
  | "inativo";

export type PessoaTipoDocumentoSupabase = "cpf" | "rg" | "outro";
export type MembroFamiliarStatusSupabase = "ativo" | "inativo";
export type AssistidoTipoCadastroSupabase = "definitivo" | "extra";
export type AssistidoStatusSupabase = "ativo" | "inativo" | "bloqueado";

export type ObservacaoSocialTipoSupabase =
  | "social"
  | "atendimento"
  | "documento"
  | "endereco"
  | "saude_pcd"
  | "outro";

export type ObservacaoSocialTipoLocal =
  | "Social"
  | "Atendimento"
  | "Documento"
  | "Endereço"
  | "Saúde/PCD"
  | "Outro";

export interface FamiliaSupabaseRow {
  id: FamiliaSupabaseId;
  nome_referencia: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  status: FamiliaStatusSupabase;
  acompanhamento: FamiliaAcompanhamentoSupabase;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
  atualizado_por: string;
}

export interface PessoaSupabaseRow {
  id: PessoaSupabaseId;
  nome: string;
  tipo_documento: PessoaTipoDocumentoSupabase;
  documento: string;
  documento_normalizado: string;
  telefone: string | null;
  nascimento: string | null;
  pcd: boolean;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
  atualizado_por: string;
}

export interface MembroFamiliarSupabaseRow {
  id: MembroFamiliarSupabaseId;
  familia_id: FamiliaSupabaseId;
  pessoa_id: PessoaSupabaseId;
  parentesco: string | null;
  responsavel_principal: boolean;
  gestante: boolean;
  status: MembroFamiliarStatusSupabase;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
  atualizado_por: string;
}

export interface AssistidoSupabaseRow {
  id: AssistidoSupabaseId;
  familia_id: FamiliaSupabaseId;
  pessoa_id: PessoaSupabaseId;
  membro_familiar_id: MembroFamiliarSupabaseId;
  tipo_cadastro: AssistidoTipoCadastroSupabase;
  beneficio: string | null;
  status: AssistidoStatusSupabase;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
  criado_por: string;
  atualizado_por: string;
}

export interface ObservacaoSocialSupabaseRow {
  id: ObservacaoSocialSupabaseId;
  familia_id: FamiliaSupabaseId;
  pessoa_id: PessoaSupabaseId | null;
  assistido_id: AssistidoSupabaseId | null;
  tipo: ObservacaoSocialTipoSupabase;
  texto: string;
  criado_em: string;
  criado_por: string;
}

export interface PessoaSupabaseReadModel {
  id: PessoaSupabaseId;
  nome: string;
  tipoDocumento: PessoaTipoDocumentoSupabase;
  documento: string;
  documentoNormalizado: string;
  telefone?: string;
  nascimento?: string;
  pcd: boolean;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * Espelha os nomes usados pelo frontend local sempre que a semântica coincide.
 * `familiaId` permanece UUID e, por isso, este tipo não é atribuível ao tipo
 * `Assistido` do store Zustand, cujo vínculo ainda é numérico.
 */
export interface AssistidoSupabaseReadModel {
  id: AssistidoSupabaseId;
  familiaId: FamiliaSupabaseId;
  pessoaId: PessoaSupabaseId;
  membroFamiliarId: MembroFamiliarSupabaseId;
  nome: string;
  documento: string;
  telefone?: string;
  nascimento?: string;
  tipoCadastro: AssistidoTipoCadastroSupabase;
  beneficio?: string;
  status: AssistidoStatusSupabase;
  pcd: boolean;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * Mantém os marcadores etários esperados pelo detalhe atual, mas eles são
 * calculados em leitura a partir de `nascimento`, nunca persistidos no banco.
 */
export interface MembroFamiliarSupabaseReadModel {
  id: MembroFamiliarSupabaseId;
  familiaId: FamiliaSupabaseId;
  pessoaId: PessoaSupabaseId;
  nome: string;
  parentesco: string;
  documento: string;
  tipoDocumento: PessoaTipoDocumentoSupabase;
  telefone?: string;
  nascimento?: string;
  crianca: boolean;
  adolescente: boolean;
  idoso: boolean;
  gestante: boolean;
  pcd: boolean;
  observacoes?: string;
  responsavelPrincipal: boolean;
  status: MembroFamiliarStatusSupabase;
  assistidoId?: AssistidoSupabaseId;
  assistidos: AssistidoSupabaseReadModel[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface ObservacaoSocialSupabaseReadModel {
  id: ObservacaoSocialSupabaseId;
  familiaId: FamiliaSupabaseId;
  pessoaId?: PessoaSupabaseId;
  assistidoId?: AssistidoSupabaseId;
  tipo: ObservacaoSocialTipoLocal;
  texto: string;
  data: string;
  /** UUID do profile autor; a leitura atual não consulta dados de auth.users. */
  usuario: string;
}

/**
 * Modelo de leitura compatível com os campos básicos exibidos hoje.
 *
 * Ele é intencionalmente separado de `Familia` do store local: IDs remotos são
 * UUIDs e `tipoCadastro`, `progressoExtra`, última retirada e próxima data não
 * pertencem a `familias` ou dependem de Entregas, módulo ainda local.
 */
export interface FamiliaSupabaseReadModel {
  id: FamiliaSupabaseId;
  nome: string;
  responsavel: string;
  documento: string;
  telefone: string;
  bairro: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  status: FamiliaStatusSupabase;
  acompanhamento: FamiliaAcompanhamentoSupabase;
  responsavelPrincipal: MembroFamiliarSupabaseReadModel | null;
  membros: MembroFamiliarSupabaseReadModel[];
  assistidos: AssistidoSupabaseReadModel[];
  observacoes: ObservacaoSocialSupabaseReadModel[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface FamiliaSupabaseAggregateRows {
  familia: FamiliaSupabaseRow;
  pessoas: PessoaSupabaseRow[];
  membros: MembroFamiliarSupabaseRow[];
  assistidos: AssistidoSupabaseRow[];
  observacoes: ObservacaoSocialSupabaseRow[];
}

export type FamiliasSupabaseReadOperation =
  | "configurar_cliente"
  | "listar_familias"
  | "buscar_familia"
  | "listar_membros"
  | "listar_assistidos"
  | "listar_observacoes"
  | "listar_pessoas"
  | "resumo_atendimento"
  | "buscar_assistidos"
  | "listar_beneficios"
  | "listar_movimentacoes"
  | "listar_entregas_painel"
  | "listar_recebimentos"
  | "listar_tentativas"
  | "listar_itens_estoque"
  | "listar_composicao"
  | "mapear_dados";

export interface FamiliasSupabaseReadError {
  operation: FamiliasSupabaseReadOperation;
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
}

export type FamiliasSupabaseReadResult<T> =
  | { data: T; error: null }
  | { data: null; error: FamiliasSupabaseReadError };

export function toFamiliasSupabaseReadError(
  operation: FamiliasSupabaseReadOperation,
  error: PostgrestError,
): FamiliasSupabaseReadError {
  return {
    operation,
    code: error.code,
    message: error.message,
    details: error.details || null,
    hint: error.hint || null,
  };
}

export class FamiliasSupabaseIntegrityError extends Error {
  readonly code = "INCOMPLETE_RELATION_DATA";

  constructor(message: string) {
    super(message);
    this.name = "FamiliasSupabaseIntegrityError";
  }
}

export function toUnexpectedFamiliasSupabaseReadError(
  operation: FamiliasSupabaseReadOperation,
  error: unknown,
): FamiliasSupabaseReadError {
  if (error instanceof FamiliasSupabaseIntegrityError) {
    return {
      operation: "mapear_dados",
      code: error.code,
      message: error.message,
      details: null,
      hint: "Repita a leitura e verifique limites de paginação e integridade das relações.",
    };
  }

  return {
    operation,
    code: "SUPABASE_READ_ERROR",
    message: error instanceof Error ? error.message : "Falha inesperada na leitura do Supabase.",
    details: null,
    hint: null,
  };
}

export class FamiliasSupabaseQueryError extends Error {
  readonly operation: FamiliasSupabaseReadOperation;
  readonly code: string;
  readonly details: string | null;
  readonly hint: string | null;

  constructor(error: FamiliasSupabaseReadError) {
    super(error.message);
    this.name = "FamiliasSupabaseQueryError";
    this.operation = error.operation;
    this.code = error.code;
    this.details = error.details;
    this.hint = error.hint;
  }
}

/* ============ Escrita (RPCs transacionais) ============ */

export type FamiliasSupabaseWriteOperation =
  | "criar_familia"
  | "criar_assistido"
  | "criar_membro"
  | "atualizar_familia"
  | "criar_observacao"
  | "atualizar_responsavel"
  | "registrar_entrega"
  | "registrar_tentativa"
  | "registrar_movimentacao"
  | "criar_recebimento"
  | "registrar_movimentacao_item"
  | "definir_composicao"
  | "montar_cesta";

export interface FamiliasSupabaseWriteError {
  operation: FamiliasSupabaseWriteOperation;
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
}

export type FamiliasSupabaseWriteResult<T> =
  | { data: T; error: null }
  | { data: null; error: FamiliasSupabaseWriteError };

/** Retorno de `public.criar_familia_com_responsavel`. */
export interface CriarFamiliaResult {
  familia_id: FamiliaSupabaseId;
  pessoa_id: PessoaSupabaseId;
  membro_familiar_id: MembroFamiliarSupabaseId;
}

/** Retorno de `public.criar_assistido_em_familia`. */
export interface CriarAssistidoResult {
  familia_id: FamiliaSupabaseId;
  pessoa_id: PessoaSupabaseId;
  membro_familiar_id: MembroFamiliarSupabaseId;
  assistido_id: AssistidoSupabaseId;
}

/** Retorno de `public.criar_membro_em_familia`. */
export interface CriarMembroResult {
  familia_id: FamiliaSupabaseId;
  pessoa_id: PessoaSupabaseId;
  membro_familiar_id: MembroFamiliarSupabaseId;
}

/** Retorno de `public.atualizar_familia`. */
export interface AtualizarFamiliaResult {
  familia_id: FamiliaSupabaseId;
}

/** Retorno do insert em `observacoes_sociais`. */
export interface CriarObservacaoResult {
  id: ObservacaoSocialSupabaseId;
}

/** Retorno de `public.atualizar_responsavel_familia`. */
export interface AtualizarResponsavelResult {
  familia_id: FamiliaSupabaseId;
  pessoa_id: PessoaSupabaseId;
}

/** Retorno de `public.registrar_entrega_atendimento`. */
export interface RegistrarEntregaResult {
  entrega_id: string;
  beneficio: string;
  saldo_resultante: number;
}

/** Retorno de `public.registrar_tentativa_bloqueada`. */
export interface RegistrarTentativaResult {
  tentativa_id: string;
}

/**
 * Insumos de leitura para calcular a elegibilidade no cliente (exibição) com
 * `verificarElegibilidadeAtendimento`. O enforcement real é da RPC.
 */
export interface ResumoAtendimentoAssistido {
  ultimaRetiradaISO: string | null;
  retiradasExtras: number;
  saldoPadrao: number;
  saldoExtra: number;
}

/**
 * Campos mínimos que o fluxo de entrega precisa de um assistido. Compatível
 * estruturalmente com `AssistidoSupabaseReadModel` (detalhe da família) e usado
 * também pela tela de atendimento (que mapeia o resultado da busca).
 */
export interface AssistidoParaEntrega {
  id: AssistidoSupabaseId;
  familiaId: FamiliaSupabaseId;
  nome: string;
  documento: string;
  telefone?: string;
  tipoCadastro: AssistidoTipoCadastroSupabase;
}

/** Benefício com saldo de estoque. */
export interface BeneficioEstoque {
  id: string;
  nome: string;
  saldo: number;
  minimo: number;
  controlaEstoque: boolean;
  ativo: boolean;
}

export type MovimentacaoEstoqueTipo = "entrada" | "saida" | "ajuste" | "baixa";

/** Linha unificada da visão de movimentações (manuais + baixas de entregas). */
export interface MovimentacaoEstoque {
  id: string;
  beneficioNome: string;
  tipo: MovimentacaoEstoqueTipo;
  quantidade: number;
  saldoResultante: number | null;
  motivo?: string;
  criadoEm: string;
  origem: "manual" | "entrega";
}

export type RecebimentoOrigem = "doacao" | "compra" | "investimento" | "ajuste";
export type RecebimentoStatus = "registrado" | "pendente" | "cancelado";

/** Recebimento (cabeçalho) com contagem de itens. */
export interface Recebimento {
  id: string;
  data: string;
  origem: RecebimentoOrigem;
  parte: string;
  documento?: string;
  valor: number;
  status: RecebimentoStatus;
  observacao?: string;
  itensCount: number;
}

/** Retorno de `public.criar_recebimento`. */
export interface CriarRecebimentoResult {
  recebimento_id: string;
}

/** Entrega recente para agregações do painel e relatórios (nomes resolvidos). */
export interface EntregaPainel {
  id: string;
  criadoEm: string;
  familiaId: string;
  familiaNome: string;
  familiaBairro: string;
  assistidoId: string;
  assistidoNome: string;
  documento?: string;
  beneficioNome: string;
  excepcional: boolean;
  observacao?: string;
}

/** Tentativa bloqueada para relatórios (nomes resolvidos). */
export interface TentativaBloqueadaPainel {
  id: string;
  criadoEm: string;
  familiaNome: string;
  assistidoNome: string;
  documento?: string;
  beneficioNome: string;
  motivo: "prazo" | "estoque";
  observacao?: string;
}

/** Retorno de `public.registrar_movimentacao_estoque`. */
export interface RegistrarMovimentacaoResult {
  movimentacao_id: string;
  saldo_resultante: number;
}

/** Item do catálogo de estoque (alimento/higiene) com saldo próprio. */
export interface ItemEstoque {
  id: string;
  nome: string;
  categoria?: string;
  unidade: string;
  saldo: number;
  minimo: number;
  valor: number;
  ativo: boolean;
}

/** Item dentro da composição de um benefício (nome/unidade/valor resolvidos). */
export interface ComposicaoItem {
  itemId: string;
  itemNome: string;
  unidade: string;
  quantidade: number;
  valor: number;
}

/** Composição de um benefício: conjunto de itens x quantidade por unidade. */
export interface ComposicaoBeneficio {
  beneficioId: string;
  itens: ComposicaoItem[];
}

/** Retorno de `public.registrar_movimentacao_item`. */
export interface RegistrarMovimentacaoItemResult {
  movimentacao_id: string;
  saldo_resultante: number;
}

/** Retorno de `public.definir_composicao_beneficio`. */
export interface DefinirComposicaoResult {
  total_itens: number;
}

/** Retorno de `public.montar_cesta`. */
export interface MontarCestaResult {
  beneficio_saldo: number;
  itens_consumidos: number;
}

/** Resultado da busca de assistidos ativos para atendimento. */
export interface AssistidoBuscaResultado {
  assistidoId: AssistidoSupabaseId;
  familiaId: FamiliaSupabaseId;
  pessoaId: PessoaSupabaseId;
  nome: string;
  documento: string;
  telefone?: string;
  tipoCadastro: AssistidoTipoCadastroSupabase;
  familiaNome: string;
}

// Mensagens amigáveis para os errcode que as RPCs lançam explicitamente.
const mensagemPorCodigoDeEscrita: Record<string, string> = {
  "42501":
    "Você não tem permissão para esta ação. É necessário um perfil de administrador ou atendente ativo.",
  "22023": "Preencha todos os campos obrigatórios.",
  "23505": "Já existe um cadastro com este documento.",
  // Bloqueios de elegibilidade lançados pela RPC de entrega.
  SEAC1: "Cadastro extra já completou o limite de retiradas; aguardar avaliação.",
  SEAC2: "Entrega bloqueada: intervalo mínimo de 25 dias não cumprido.",
  SEAC3: "Entrega bloqueada por falta de estoque.",
  SEAE1: "Saldo insuficiente para a saída.",
  SEAI1: "Saldo de item insuficiente para montar a quantidade de cestas informada.",
};

export function toFamiliasSupabaseWriteError(
  operation: FamiliasSupabaseWriteOperation,
  error: PostgrestError,
): FamiliasSupabaseWriteError {
  return {
    operation,
    code: error.code,
    message: mensagemPorCodigoDeEscrita[error.code] ?? error.message,
    details: error.details || null,
    hint: error.hint || null,
  };
}

export function toUnexpectedFamiliasSupabaseWriteError(
  operation: FamiliasSupabaseWriteOperation,
  error: unknown,
): FamiliasSupabaseWriteError {
  return {
    operation,
    code: "SUPABASE_WRITE_ERROR",
    message: error instanceof Error ? error.message : "Falha inesperada na gravação do Supabase.",
    details: null,
    hint: null,
  };
}

export class FamiliasSupabaseWriteQueryError extends Error {
  readonly operation: FamiliasSupabaseWriteOperation;
  readonly code: string;
  readonly details: string | null;
  readonly hint: string | null;

  constructor(error: FamiliasSupabaseWriteError) {
    super(error.message);
    this.name = "FamiliasSupabaseWriteQueryError";
    this.operation = error.operation;
    this.code = error.code;
    this.details = error.details;
    this.hint = error.hint;
  }
}
