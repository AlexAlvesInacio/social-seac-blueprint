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
