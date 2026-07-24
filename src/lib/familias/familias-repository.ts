import type { PostgrestError } from "@supabase/supabase-js";

import { mapFamiliaFromSupabase, mapFamiliasFromSupabase } from "@/lib/familias/familias-mapper";
import type {
  AssistidoBuscaResultado,
  AssistidoSupabaseRow,
  AssistidoTipoCadastroSupabase,
  AtualizarFamiliaResult,
  BeneficioEstoque,
  EntregaPainel,
  MovimentacaoEstoque,
  RegistrarMovimentacaoResult,
  AtualizarResponsavelResult,
  CriarAssistidoResult,
  CriarFamiliaResult,
  CriarMembroResult,
  CriarObservacaoResult,
  FamiliaStatusSupabase,
  ObservacaoSocialTipoSupabase,
  FamiliaSupabaseId,
  FamiliaSupabaseReadModel,
  FamiliaSupabaseRow,
  FamiliasSupabaseReadOperation,
  FamiliasSupabaseReadResult,
  FamiliasSupabaseWriteResult,
  MembroFamiliarSupabaseRow,
  ObservacaoSocialSupabaseRow,
  PessoaSupabaseRow,
  PessoaTipoDocumentoSupabase,
  RegistrarEntregaResult,
  RegistrarTentativaResult,
  ResumoAtendimentoAssistido,
} from "@/lib/familias/familias-supabase-types";
import {
  toFamiliasSupabaseReadError,
  toFamiliasSupabaseWriteError,
  toUnexpectedFamiliasSupabaseReadError,
  toUnexpectedFamiliasSupabaseWriteError,
} from "@/lib/familias/familias-supabase-types";
import { getSupabaseClient } from "@/lib/supabase/client";

const familiaColumns =
  "id, nome_referencia, endereco, numero, complemento, bairro, cidade, uf, cep, status, acompanhamento, criado_em, atualizado_em, criado_por, atualizado_por";

const pessoaColumns =
  "id, nome, tipo_documento, documento, documento_normalizado, telefone, nascimento, pcd, observacoes, criado_em, atualizado_em, criado_por, atualizado_por";

const membroColumns =
  "id, familia_id, pessoa_id, parentesco, responsavel_principal, gestante, status, criado_em, atualizado_em, criado_por, atualizado_por";

const assistidoColumns =
  "id, familia_id, pessoa_id, membro_familiar_id, tipo_cadastro, beneficio, status, observacoes, criado_em, atualizado_em, criado_por, atualizado_por";

const observacaoColumns =
  "id, familia_id, pessoa_id, assistido_id, tipo, texto, criado_em, criado_por";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RowsResult<T> = { data: T[]; error: null } | { data: null; error: PostgrestError };

interface RelatedRows {
  membros: MembroFamiliarSupabaseRow[];
  assistidos: AssistidoSupabaseRow[];
  observacoes: ObservacaoSocialSupabaseRow[];
  pessoas: PessoaSupabaseRow[];
}

function failure<T>(
  operation: FamiliasSupabaseReadOperation,
  error: PostgrestError,
): FamiliasSupabaseReadResult<T> {
  return { data: null, error: toFamiliasSupabaseReadError(operation, error) };
}

function unexpectedFailure<T>(
  operation: FamiliasSupabaseReadOperation,
  error: unknown,
): FamiliasSupabaseReadResult<T> {
  return { data: null, error: toUnexpectedFamiliasSupabaseReadError(operation, error) };
}

function uniqueIds(ids: Array<string | null>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

async function listRelatedRows(
  familiaIds: FamiliaSupabaseId[],
): Promise<FamiliasSupabaseReadResult<RelatedRows>> {
  if (familiaIds.length === 0) {
    return {
      data: { membros: [], assistidos: [], observacoes: [], pessoas: [] },
      error: null,
    };
  }

  const client = getSupabaseClient();

  // As FKs compostas de assistidos podem exigir nomes de relacionamento
  // específicos no PostgREST. Consultas separadas mantêm esta fundação
  // previsível e tipada sem depender dessa inferência automática. Como não há
  // snapshot transacional entre SELECTs, a tela só deve ser conectada após a
  // estratégia de atualização/invalidação ser homologada.
  const [membrosResult, assistidosResult, observacoesResult] = await Promise.all([
    client.from("membros_familiares").select(membroColumns).in("familia_id", familiaIds),
    client.from("assistidos").select(assistidoColumns).in("familia_id", familiaIds),
    client
      .from("observacoes_sociais")
      .select(observacaoColumns)
      .in("familia_id", familiaIds)
      .order("criado_em", { ascending: false }),
  ]);

  if (membrosResult.error) {
    return failure("listar_membros", membrosResult.error);
  }
  if (assistidosResult.error) {
    return failure("listar_assistidos", assistidosResult.error);
  }
  if (observacoesResult.error) {
    return failure("listar_observacoes", observacoesResult.error);
  }

  const membros = (membrosResult.data ?? []) as MembroFamiliarSupabaseRow[];
  const assistidos = (assistidosResult.data ?? []) as AssistidoSupabaseRow[];
  const observacoes = (observacoesResult.data ?? []) as ObservacaoSocialSupabaseRow[];
  const pessoaIds = uniqueIds([
    ...membros.map((row) => row.pessoa_id),
    ...assistidos.map((row) => row.pessoa_id),
    ...observacoes.map((row) => row.pessoa_id),
  ]);

  let pessoas: PessoaSupabaseRow[] = [];
  if (pessoaIds.length > 0) {
    const pessoasResult = await client.from("pessoas").select(pessoaColumns).in("id", pessoaIds);

    if (pessoasResult.error) {
      return failure("listar_pessoas", pessoasResult.error);
    }

    pessoas = (pessoasResult.data ?? []) as PessoaSupabaseRow[];
  }

  return { data: { membros, assistidos, observacoes, pessoas }, error: null };
}

async function listFamilias(): Promise<FamiliasSupabaseReadResult<FamiliaSupabaseReadModel[]>> {
  const { data, error } = (await getSupabaseClient()
    .from("familias")
    .select(familiaColumns)
    .order("criado_em", { ascending: false })) as RowsResult<FamiliaSupabaseRow>;

  if (error) return failure("listar_familias", error);

  const relatedResult = await listRelatedRows(data.map((familia) => familia.id));
  if (relatedResult.error) return relatedResult;

  return {
    data: mapFamiliasFromSupabase(
      data,
      relatedResult.data.pessoas,
      relatedResult.data.membros,
      relatedResult.data.assistidos,
      relatedResult.data.observacoes,
    ),
    error: null,
  };
}

/**
 * Lê o agregado completo em consultas separadas. Antes de conectar uma tela,
 * a listagem deverá receber paginação/resumo próprios: grandes coleções podem
 * atingir limites de linhas ou de URL do Data API. Um array vazio também pode
 * significar que a RLS não tornou registros visíveis ao perfil atual.
 */
export async function listFamiliasFromSupabase(): Promise<
  FamiliasSupabaseReadResult<FamiliaSupabaseReadModel[]>
> {
  try {
    return await listFamilias();
  } catch (error) {
    return unexpectedFailure("listar_familias", error);
  }
}

async function getFamiliaById(
  id: string,
): Promise<FamiliasSupabaseReadResult<FamiliaSupabaseReadModel | null>> {
  const normalizedId = id.trim();

  if (!uuidPattern.test(normalizedId)) {
    return {
      data: null,
      error: {
        operation: "buscar_familia",
        code: "INVALID_FAMILY_ID",
        message: "Informe um UUID válido para a família.",
        details: null,
        hint: null,
      },
    };
  }

  const { data, error } = await getSupabaseClient()
    .from("familias")
    .select(familiaColumns)
    .eq("id", normalizedId)
    .maybeSingle();

  if (error) return failure("buscar_familia", error);
  if (!data) return { data: null, error: null };

  const familia = data as FamiliaSupabaseRow;
  const relatedResult = await listRelatedRows([familia.id]);
  if (relatedResult.error) return relatedResult;

  return {
    data: mapFamiliaFromSupabase({
      familia,
      pessoas: relatedResult.data.pessoas,
      membros: relatedResult.data.membros,
      assistidos: relatedResult.data.assistidos,
      observacoes: relatedResult.data.observacoes,
    }),
    error: null,
  };
}

/**
 * `data: null` sem erro significa que o registro não existe ou não ficou
 * visível pelas policies RLS para o perfil autenticado.
 */
export async function getFamiliaFromSupabaseById(
  id: string,
): Promise<FamiliasSupabaseReadResult<FamiliaSupabaseReadModel | null>> {
  try {
    return await getFamiliaById(id);
  } catch (error) {
    return unexpectedFailure("buscar_familia", error);
  }
}

/* ============ Escrita via RPCs transacionais ============ */

// As RPCs normalizam e recusam vazios, mas enviamos null para os opcionais
// em branco para não gravar strings vazias em colunas anuláveis.
function nullableParam(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export interface CriarFamiliaInput {
  nomeReferencia: string;
  responsavelNome: string;
  responsavelTipoDocumento: PessoaTipoDocumentoSupabase;
  responsavelDocumento: string;
  responsavelTelefone?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

export interface CriarAssistidoInput {
  familiaId: string;
  nome: string;
  tipoDocumento: PessoaTipoDocumentoSupabase;
  documento: string;
  tipoCadastro: AssistidoTipoCadastroSupabase;
  parentesco?: string;
  telefone?: string;
  nascimento?: string;
  pcd?: boolean;
  gestante?: boolean;
}

export interface CriarMembroInput {
  familiaId: string;
  nome: string;
  tipoDocumento: PessoaTipoDocumentoSupabase;
  documento: string;
  parentesco?: string;
  telefone?: string;
  nascimento?: string;
  pcd?: boolean;
  gestante?: boolean;
}

export interface AtualizarFamiliaInput {
  familiaId: string;
  nomeReferencia: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  status?: FamiliaStatusSupabase;
}

export interface CriarObservacaoInput {
  familiaId: string;
  tipo: ObservacaoSocialTipoSupabase;
  texto: string;
}

export interface AtualizarResponsavelInput {
  familiaId: string;
  nome: string;
  tipoDocumento: PessoaTipoDocumentoSupabase;
  documento: string;
  telefone?: string;
}

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  return (data as T) ?? null;
}

async function criarFamilia(
  input: CriarFamiliaInput,
): Promise<FamiliasSupabaseWriteResult<CriarFamiliaResult>> {
  const { data, error } = await getSupabaseClient().rpc("criar_familia_com_responsavel", {
    p_nome_referencia: input.nomeReferencia.trim(),
    p_responsavel_nome: input.responsavelNome.trim(),
    p_responsavel_tipo_documento: input.responsavelTipoDocumento,
    p_responsavel_documento: input.responsavelDocumento.trim(),
    p_responsavel_telefone: nullableParam(input.responsavelTelefone),
    p_endereco: nullableParam(input.endereco),
    p_numero: nullableParam(input.numero),
    p_complemento: nullableParam(input.complemento),
    p_bairro: nullableParam(input.bairro),
    p_cidade: nullableParam(input.cidade),
    p_uf: nullableParam(input.uf),
    p_cep: nullableParam(input.cep),
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("criar_familia", error) };
  }

  const row = firstRow<CriarFamiliaResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "criar_familia",
        code: "EMPTY_RESULT",
        message: "A criação da família não retornou identificadores.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function criarFamiliaComResponsavelNoSupabase(
  input: CriarFamiliaInput,
): Promise<FamiliasSupabaseWriteResult<CriarFamiliaResult>> {
  try {
    return await criarFamilia(input);
  } catch (error) {
    return { data: null, error: toUnexpectedFamiliasSupabaseWriteError("criar_familia", error) };
  }
}

async function criarAssistido(
  input: CriarAssistidoInput,
): Promise<FamiliasSupabaseWriteResult<CriarAssistidoResult>> {
  const { data, error } = await getSupabaseClient().rpc("criar_assistido_em_familia", {
    p_familia_id: input.familiaId,
    p_nome: input.nome.trim(),
    p_tipo_documento: input.tipoDocumento,
    p_documento: input.documento.trim(),
    p_tipo_cadastro: input.tipoCadastro,
    p_parentesco: nullableParam(input.parentesco),
    p_telefone: nullableParam(input.telefone),
    p_nascimento: nullableParam(input.nascimento),
    p_pcd: input.pcd ?? false,
    p_gestante: input.gestante ?? false,
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("criar_assistido", error) };
  }

  const row = firstRow<CriarAssistidoResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "criar_assistido",
        code: "EMPTY_RESULT",
        message: "A criação do assistido não retornou identificadores.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function criarAssistidoEmFamiliaNoSupabase(
  input: CriarAssistidoInput,
): Promise<FamiliasSupabaseWriteResult<CriarAssistidoResult>> {
  try {
    return await criarAssistido(input);
  } catch (error) {
    return { data: null, error: toUnexpectedFamiliasSupabaseWriteError("criar_assistido", error) };
  }
}

async function criarMembro(
  input: CriarMembroInput,
): Promise<FamiliasSupabaseWriteResult<CriarMembroResult>> {
  const { data, error } = await getSupabaseClient().rpc("criar_membro_em_familia", {
    p_familia_id: input.familiaId,
    p_nome: input.nome.trim(),
    p_tipo_documento: input.tipoDocumento,
    p_documento: input.documento.trim(),
    p_parentesco: nullableParam(input.parentesco),
    p_telefone: nullableParam(input.telefone),
    p_nascimento: nullableParam(input.nascimento),
    p_pcd: input.pcd ?? false,
    p_gestante: input.gestante ?? false,
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("criar_membro", error) };
  }

  const row = firstRow<CriarMembroResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "criar_membro",
        code: "EMPTY_RESULT",
        message: "A criação do membro não retornou identificadores.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function criarMembroEmFamiliaNoSupabase(
  input: CriarMembroInput,
): Promise<FamiliasSupabaseWriteResult<CriarMembroResult>> {
  try {
    return await criarMembro(input);
  } catch (error) {
    return { data: null, error: toUnexpectedFamiliasSupabaseWriteError("criar_membro", error) };
  }
}

async function atualizarFamilia(
  input: AtualizarFamiliaInput,
): Promise<FamiliasSupabaseWriteResult<AtualizarFamiliaResult>> {
  const { data, error } = await getSupabaseClient().rpc("atualizar_familia", {
    p_familia_id: input.familiaId,
    p_nome_referencia: input.nomeReferencia.trim(),
    p_endereco: nullableParam(input.endereco),
    p_numero: nullableParam(input.numero),
    p_complemento: nullableParam(input.complemento),
    p_bairro: nullableParam(input.bairro),
    p_cidade: nullableParam(input.cidade),
    p_uf: nullableParam(input.uf),
    p_cep: nullableParam(input.cep),
    p_status: input.status ?? null,
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("atualizar_familia", error) };
  }

  const row = firstRow<AtualizarFamiliaResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "atualizar_familia",
        code: "EMPTY_RESULT",
        message: "A atualização da família não retornou identificador.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function atualizarFamiliaNoSupabase(
  input: AtualizarFamiliaInput,
): Promise<FamiliasSupabaseWriteResult<AtualizarFamiliaResult>> {
  try {
    return await atualizarFamilia(input);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("atualizar_familia", error),
    };
  }
}

// Observação social é um INSERT de tabela única, gravado direto pela camada de
// serviço: a policy "Equipe ativa insere observações sociais" já restringe a
// escrita e o trigger observacoes_sociais_definir_autoria define criado_por.
async function criarObservacao(
  input: CriarObservacaoInput,
): Promise<FamiliasSupabaseWriteResult<CriarObservacaoResult>> {
  const { data, error } = await getSupabaseClient()
    .from("observacoes_sociais")
    .insert({
      familia_id: input.familiaId,
      tipo: input.tipo,
      texto: input.texto.trim(),
    })
    .select("id")
    .single();

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("criar_observacao", error) };
  }

  const row = firstRow<CriarObservacaoResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "criar_observacao",
        code: "EMPTY_RESULT",
        message: "O registro da observação não retornou identificador.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function criarObservacaoSocialNoSupabase(
  input: CriarObservacaoInput,
): Promise<FamiliasSupabaseWriteResult<CriarObservacaoResult>> {
  try {
    return await criarObservacao(input);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("criar_observacao", error),
    };
  }
}

async function atualizarResponsavel(
  input: AtualizarResponsavelInput,
): Promise<FamiliasSupabaseWriteResult<AtualizarResponsavelResult>> {
  const { data, error } = await getSupabaseClient().rpc("atualizar_responsavel_familia", {
    p_familia_id: input.familiaId,
    p_nome: input.nome.trim(),
    p_tipo_documento: input.tipoDocumento,
    p_documento: input.documento.trim(),
    p_telefone: nullableParam(input.telefone),
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("atualizar_responsavel", error) };
  }

  const row = firstRow<AtualizarResponsavelResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "atualizar_responsavel",
        code: "EMPTY_RESULT",
        message: "A atualização do responsável não retornou identificadores.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function atualizarResponsavelFamiliaNoSupabase(
  input: AtualizarResponsavelInput,
): Promise<FamiliasSupabaseWriteResult<AtualizarResponsavelResult>> {
  try {
    return await atualizarResponsavel(input);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("atualizar_responsavel", error),
    };
  }
}

/* ============ Atendimento: entregas e tentativas ============ */

export interface RegistrarEntregaInput {
  assistidoId: string;
  /** Apenas para invalidação de cache; não é enviado à RPC. */
  familiaId: string;
  excepcional?: boolean;
  observacao?: string;
}

export interface RegistrarTentativaInput {
  assistidoId: string;
  familiaId: string;
  motivo: "prazo" | "estoque";
  observacao?: string;
}

async function registrarEntrega(
  input: RegistrarEntregaInput,
): Promise<FamiliasSupabaseWriteResult<RegistrarEntregaResult>> {
  const { data, error } = await getSupabaseClient().rpc("registrar_entrega_atendimento", {
    p_assistido_id: input.assistidoId,
    p_excepcional: input.excepcional ?? false,
    p_observacao: nullableParam(input.observacao),
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("registrar_entrega", error) };
  }

  const row = firstRow<RegistrarEntregaResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "registrar_entrega",
        code: "EMPTY_RESULT",
        message: "O registro da entrega não retornou identificadores.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function registrarEntregaAtendimentoNoSupabase(
  input: RegistrarEntregaInput,
): Promise<FamiliasSupabaseWriteResult<RegistrarEntregaResult>> {
  try {
    return await registrarEntrega(input);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("registrar_entrega", error),
    };
  }
}

async function registrarTentativa(
  input: RegistrarTentativaInput,
): Promise<FamiliasSupabaseWriteResult<RegistrarTentativaResult>> {
  const { data, error } = await getSupabaseClient().rpc("registrar_tentativa_bloqueada", {
    p_assistido_id: input.assistidoId,
    p_motivo: input.motivo,
    p_observacao: nullableParam(input.observacao),
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("registrar_tentativa", error) };
  }

  const row = firstRow<RegistrarTentativaResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "registrar_tentativa",
        code: "EMPTY_RESULT",
        message: "O registro da tentativa não retornou identificador.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function registrarTentativaBloqueadaNoSupabase(
  input: RegistrarTentativaInput,
): Promise<FamiliasSupabaseWriteResult<RegistrarTentativaResult>> {
  try {
    return await registrarTentativa(input);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("registrar_tentativa", error),
    };
  }
}

const BENEFICIO_PADRAO = "Cesta Padrão";
const BENEFICIO_EXTRA = "Cesta Extra";

type EntregaResumoRow = { criado_em: string; beneficio_id: string };
type BeneficioSaldoRow = { id: string; nome: string; saldo: number };

async function getResumoAtendimento(
  assistidoId: string,
): Promise<FamiliasSupabaseReadResult<ResumoAtendimentoAssistido>> {
  const client = getSupabaseClient();

  // Sem join embutido do PostgREST: buscamos beneficio_id nas entregas e
  // mapeamos pelo id via a consulta de benefícios (mais previsível e tipado).
  const [entregasResult, beneficiosResult] = await Promise.all([
    client
      .from("entregas")
      .select("criado_em, beneficio_id")
      .eq("assistido_id", assistidoId)
      .order("criado_em", { ascending: false }),
    client
      .from("beneficios")
      .select("id, nome, saldo")
      .in("nome", [BENEFICIO_PADRAO, BENEFICIO_EXTRA]),
  ]);

  if (entregasResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("resumo_atendimento", entregasResult.error),
    };
  }
  if (beneficiosResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("resumo_atendimento", beneficiosResult.error),
    };
  }

  const entregas = (entregasResult.data ?? []) as EntregaResumoRow[];
  const beneficios = (beneficiosResult.data ?? []) as BeneficioSaldoRow[];

  const extraId = beneficios.find((b) => b.nome === BENEFICIO_EXTRA)?.id;
  const ultimaRetiradaISO = entregas[0] ? entregas[0].criado_em.slice(0, 10) : null;
  const retiradasExtras = extraId ? entregas.filter((e) => e.beneficio_id === extraId).length : 0;
  const saldoDe = (nome: string) => beneficios.find((b) => b.nome === nome)?.saldo ?? 0;

  return {
    data: {
      ultimaRetiradaISO,
      retiradasExtras,
      saldoPadrao: saldoDe(BENEFICIO_PADRAO),
      saldoExtra: saldoDe(BENEFICIO_EXTRA),
    },
    error: null,
  };
}

/** Insumos para a UI calcular o cenário de elegibilidade (enforcement é da RPC). */
export async function getResumoAtendimentoAssistido(
  assistidoId: string,
): Promise<FamiliasSupabaseReadResult<ResumoAtendimentoAssistido>> {
  try {
    return await getResumoAtendimento(assistidoId);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseReadError("resumo_atendimento", error),
    };
  }
}

// Normalização oficial do documento (igual ao trigger private.normalizar_documento_pessoa):
// remove tudo que não é alfanumérico e converte para maiúsculas.
function normalizarDocumento(termo: string): string {
  return termo.replace(/[^0-9a-z]/gi, "").toUpperCase();
}

type PessoaBuscaRow = { id: string; nome: string; documento: string; telefone: string | null };
type AssistidoBuscaRow = {
  id: string;
  familia_id: string;
  pessoa_id: string;
  tipo_cadastro: AssistidoTipoCadastroSupabase;
};

async function buscarAssistidos(
  termo: string,
): Promise<FamiliasSupabaseReadResult<AssistidoBuscaResultado[]>> {
  const client = getSupabaseClient();
  const t = termo.trim();
  // Sanitiza para o filtro .or do PostgREST (vírgula/parênteses quebram a sintaxe).
  const seguro = t.replace(/[(),*]/g, " ").trim();
  const docNorm = normalizarDocumento(t);
  const digitos = t.replace(/\D/g, "");

  const orParts: string[] = [];
  if (docNorm) orParts.push(`documento_normalizado.eq.${docNorm}`);
  if (seguro) orParts.push(`nome.ilike.%${seguro}%`);
  if (digitos) orParts.push(`telefone.ilike.%${digitos}%`);

  const pessoasResult = await client
    .from("pessoas")
    .select("id, nome, documento, telefone")
    .or(orParts.join(","))
    .limit(20);

  if (pessoasResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("buscar_assistidos", pessoasResult.error),
    };
  }

  const pessoas = (pessoasResult.data ?? []) as PessoaBuscaRow[];
  if (pessoas.length === 0) return { data: [], error: null };

  const pessoaById = new Map(pessoas.map((p) => [p.id, p]));
  const assistidosResult = await client
    .from("assistidos")
    .select("id, familia_id, pessoa_id, tipo_cadastro")
    .eq("status", "ativo")
    .in(
      "pessoa_id",
      pessoas.map((p) => p.id),
    );

  if (assistidosResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("buscar_assistidos", assistidosResult.error),
    };
  }

  const assistidos = (assistidosResult.data ?? []) as AssistidoBuscaRow[];
  if (assistidos.length === 0) return { data: [], error: null };

  const familiaIds = [...new Set(assistidos.map((a) => a.familia_id))];
  const familiasResult = await client
    .from("familias")
    .select("id, nome_referencia")
    .in("id", familiaIds);

  if (familiasResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("buscar_assistidos", familiasResult.error),
    };
  }

  const familiaNomeById = new Map(
    ((familiasResult.data ?? []) as { id: string; nome_referencia: string | null }[]).map((f) => [
      f.id,
      f.nome_referencia ?? "",
    ]),
  );

  const data: AssistidoBuscaResultado[] = assistidos.flatMap((a) => {
    const pessoa = pessoaById.get(a.pessoa_id);
    if (!pessoa) return [];
    return [
      {
        assistidoId: a.id,
        familiaId: a.familia_id,
        pessoaId: a.pessoa_id,
        nome: pessoa.nome,
        documento: pessoa.documento,
        telefone: pessoa.telefone ?? undefined,
        tipoCadastro: a.tipo_cadastro,
        familiaNome: familiaNomeById.get(a.familia_id) ?? "",
      },
    ];
  });

  return { data, error: null };
}

/** Busca assistidos ativos por documento (normalizado), nome ou telefone. */
export async function buscarAssistidosAtivosNoSupabase(
  termo: string,
): Promise<FamiliasSupabaseReadResult<AssistidoBuscaResultado[]>> {
  try {
    return await buscarAssistidos(termo);
  } catch (error) {
    return { data: null, error: toUnexpectedFamiliasSupabaseReadError("buscar_assistidos", error) };
  }
}

/* ============ Estoque de benefícios ============ */

type BeneficioEstoqueRow = {
  id: string;
  nome: string;
  saldo: number;
  minimo: number;
  controla_estoque: boolean;
  ativo: boolean;
};

async function listarBeneficios(): Promise<FamiliasSupabaseReadResult<BeneficioEstoque[]>> {
  const { data, error } = await getSupabaseClient()
    .from("beneficios")
    .select("id, nome, saldo, minimo, controla_estoque, ativo")
    .order("nome");

  if (error) return { data: null, error: toFamiliasSupabaseReadError("listar_beneficios", error) };

  const rows = (data ?? []) as BeneficioEstoqueRow[];
  return {
    data: rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      saldo: r.saldo,
      minimo: r.minimo,
      controlaEstoque: r.controla_estoque,
      ativo: r.ativo,
    })),
    error: null,
  };
}

export async function listarBeneficiosNoSupabase(): Promise<
  FamiliasSupabaseReadResult<BeneficioEstoque[]>
> {
  try {
    return await listarBeneficios();
  } catch (error) {
    return { data: null, error: toUnexpectedFamiliasSupabaseReadError("listar_beneficios", error) };
  }
}

type MovimentacaoRow = {
  id: string;
  beneficio_id: string;
  tipo: "entrada" | "saida" | "ajuste";
  quantidade: number;
  saldo_resultante: number;
  motivo: string | null;
  criado_em: string;
};
type EntregaMovRow = { id: string; beneficio_id: string; criado_em: string; excepcional: boolean };

const LIMITE_MOVIMENTACOES = 100;

async function listarMovimentacoesEstoque(): Promise<
  FamiliasSupabaseReadResult<MovimentacaoEstoque[]>
> {
  const client = getSupabaseClient();

  const [movResult, entregasResult, beneficiosResult] = await Promise.all([
    client
      .from("movimentacoes_estoque")
      .select("id, beneficio_id, tipo, quantidade, saldo_resultante, motivo, criado_em")
      .order("criado_em", { ascending: false })
      .limit(LIMITE_MOVIMENTACOES),
    client
      .from("entregas")
      .select("id, beneficio_id, criado_em, excepcional")
      .order("criado_em", { ascending: false })
      .limit(LIMITE_MOVIMENTACOES),
    client.from("beneficios").select("id, nome"),
  ]);

  if (movResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("listar_movimentacoes", movResult.error),
    };
  }
  if (entregasResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("listar_movimentacoes", entregasResult.error),
    };
  }
  if (beneficiosResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("listar_movimentacoes", beneficiosResult.error),
    };
  }

  const nomePorId = new Map(
    ((beneficiosResult.data ?? []) as { id: string; nome: string }[]).map((b) => [b.id, b.nome]),
  );

  const manuais: MovimentacaoEstoque[] = ((movResult.data ?? []) as MovimentacaoRow[]).map((m) => ({
    id: m.id,
    beneficioNome: nomePorId.get(m.beneficio_id) ?? "—",
    tipo: m.tipo,
    quantidade: m.quantidade,
    saldoResultante: m.saldo_resultante,
    motivo: m.motivo ?? undefined,
    criadoEm: m.criado_em,
    origem: "manual",
  }));

  const baixas: MovimentacaoEstoque[] = ((entregasResult.data ?? []) as EntregaMovRow[]).map(
    (e) => ({
      id: e.id,
      beneficioNome: nomePorId.get(e.beneficio_id) ?? "—",
      tipo: "baixa",
      quantidade: -1,
      saldoResultante: null,
      motivo: e.excepcional ? "Entrega excepcional" : "Entrega realizada",
      criadoEm: e.criado_em,
      origem: "entrega",
    }),
  );

  const combinado = [...manuais, ...baixas]
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .slice(0, LIMITE_MOVIMENTACOES);

  return { data: combinado, error: null };
}

export async function listarMovimentacoesEstoqueNoSupabase(): Promise<
  FamiliasSupabaseReadResult<MovimentacaoEstoque[]>
> {
  try {
    return await listarMovimentacoesEstoque();
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseReadError("listar_movimentacoes", error),
    };
  }
}

export interface RegistrarMovimentacaoInput {
  beneficioId: string;
  tipo: "entrada" | "saida" | "ajuste";
  quantidade: number;
  motivo?: string;
  observacao?: string;
}

async function registrarMovimentacao(
  input: RegistrarMovimentacaoInput,
): Promise<FamiliasSupabaseWriteResult<RegistrarMovimentacaoResult>> {
  const { data, error } = await getSupabaseClient().rpc("registrar_movimentacao_estoque", {
    p_beneficio_id: input.beneficioId,
    p_tipo: input.tipo,
    p_quantidade: input.quantidade,
    p_motivo: nullableParam(input.motivo),
    p_observacao: nullableParam(input.observacao),
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("registrar_movimentacao", error) };
  }

  const row = firstRow<RegistrarMovimentacaoResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "registrar_movimentacao",
        code: "EMPTY_RESULT",
        message: "A movimentação não retornou identificadores.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function registrarMovimentacaoEstoqueNoSupabase(
  input: RegistrarMovimentacaoInput,
): Promise<FamiliasSupabaseWriteResult<RegistrarMovimentacaoResult>> {
  try {
    return await registrarMovimentacao(input);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("registrar_movimentacao", error),
    };
  }
}

/* ============ Painel: entregas recentes com nomes ============ */

type EntregaPainelRow = {
  id: string;
  criado_em: string;
  familia_id: string;
  beneficio_id: string;
  assistido_id: string;
  excepcional: boolean;
};

async function listarEntregasRecentes(
  diasJanela: number,
  limite: number,
): Promise<FamiliasSupabaseReadResult<EntregaPainel[]>> {
  const client = getSupabaseClient();
  const desde = new Date(Date.now() - diasJanela * 86400000).toISOString();

  const entregasResult = await client
    .from("entregas")
    .select("id, criado_em, familia_id, beneficio_id, assistido_id, excepcional")
    .gte("criado_em", desde)
    .order("criado_em", { ascending: false })
    .limit(limite);

  if (entregasResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("listar_entregas_painel", entregasResult.error),
    };
  }

  const entregas = (entregasResult.data ?? []) as EntregaPainelRow[];
  if (entregas.length === 0) return { data: [], error: null };

  const beneficioIds = uniqueIds(entregas.map((e) => e.beneficio_id));
  const assistidoIds = uniqueIds(entregas.map((e) => e.assistido_id));
  const familiaIds = uniqueIds(entregas.map((e) => e.familia_id));

  const [beneficiosResult, assistidosResult, familiasResult] = await Promise.all([
    client.from("beneficios").select("id, nome").in("id", beneficioIds),
    client.from("assistidos").select("id, pessoa_id").in("id", assistidoIds),
    client.from("familias").select("id, nome_referencia").in("id", familiaIds),
  ]);

  if (beneficiosResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("listar_entregas_painel", beneficiosResult.error),
    };
  }
  if (assistidosResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("listar_entregas_painel", assistidosResult.error),
    };
  }
  if (familiasResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("listar_entregas_painel", familiasResult.error),
    };
  }

  const assistidos = (assistidosResult.data ?? []) as { id: string; pessoa_id: string }[];
  const pessoaPorAssistido = new Map(assistidos.map((a) => [a.id, a.pessoa_id]));
  const pessoaIds = uniqueIds(assistidos.map((a) => a.pessoa_id));

  let nomePorPessoa = new Map<string, string>();
  if (pessoaIds.length > 0) {
    const pessoasResult = await client.from("pessoas").select("id, nome").in("id", pessoaIds);
    if (pessoasResult.error) {
      return {
        data: null,
        error: toFamiliasSupabaseReadError("listar_entregas_painel", pessoasResult.error),
      };
    }
    nomePorPessoa = new Map(
      ((pessoasResult.data ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]),
    );
  }

  const nomeBeneficio = new Map(
    ((beneficiosResult.data ?? []) as { id: string; nome: string }[]).map((b) => [b.id, b.nome]),
  );
  const nomeFamilia = new Map(
    ((familiasResult.data ?? []) as { id: string; nome_referencia: string | null }[]).map((f) => [
      f.id,
      f.nome_referencia ?? "",
    ]),
  );

  const data: EntregaPainel[] = entregas.map((e) => {
    const pessoaId = pessoaPorAssistido.get(e.assistido_id);
    return {
      id: e.id,
      criadoEm: e.criado_em,
      familiaId: e.familia_id,
      familiaNome: nomeFamilia.get(e.familia_id) ?? "—",
      assistidoNome: (pessoaId && nomePorPessoa.get(pessoaId)) || "Assistido",
      beneficioNome: nomeBeneficio.get(e.beneficio_id) ?? "—",
      excepcional: e.excepcional,
    };
  });

  return { data, error: null };
}

export async function listarEntregasRecentesNoSupabase(
  diasJanela = 60,
  limite = 500,
): Promise<FamiliasSupabaseReadResult<EntregaPainel[]>> {
  try {
    return await listarEntregasRecentes(diasJanela, limite);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseReadError("listar_entregas_painel", error),
    };
  }
}
