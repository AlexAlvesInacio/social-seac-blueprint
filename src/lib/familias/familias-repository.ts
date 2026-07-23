import type { PostgrestError } from "@supabase/supabase-js";

import { mapFamiliaFromSupabase, mapFamiliasFromSupabase } from "@/lib/familias/familias-mapper";
import type {
  AssistidoSupabaseRow,
  AssistidoTipoCadastroSupabase,
  AtualizarFamiliaResult,
  CriarAssistidoResult,
  CriarFamiliaResult,
  CriarMembroResult,
  FamiliaStatusSupabase,
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
