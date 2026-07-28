import type { PostgrestError } from "@supabase/supabase-js";

import { mapFamiliaFromSupabase, mapFamiliasFromSupabase } from "@/lib/familias/familias-mapper";
import type {
  AssistidoBuscaResultado,
  AssistidoSupabaseRow,
  AssistidoTipoCadastroSupabase,
  AtualizarFamiliaResult,
  BeneficioEstoque,
  ComposicaoBeneficio,
  ComposicaoItem,
  CriarRecebimentoResult,
  DefinirComposicaoResult,
  EntregaPainel,
  ItemEstoque,
  MontarCestaResult,
  MovimentacaoEstoque,
  RegistrarMovimentacaoItemResult,
  Recebimento,
  RecebimentoOrigem,
  RegistrarMovimentacaoResult,
  TentativaBloqueadaPainel,
  AprovarAssistidoResult,
  InativarAssistidoResult,
  ReativarAssistidoResult,
  AtualizarMembroResult,
  AtualizarResponsavelResult,
  CriarAssistidoResult,
  CriarFamiliaResult,
  CriarMembroResult,
  CriarObservacaoResult,
  CriarPreCadastroResult,
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
  PessoaExistente,
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

  const modelo = mapFamiliaFromSupabase({
    familia,
    pessoas: relatedResult.data.pessoas,
    membros: relatedResult.data.membros,
    assistidos: relatedResult.data.assistidos,
    observacoes: relatedResult.data.observacoes,
  });

  // Resolve o nome do autor das observações (o mapper deixa o UUID de criado_por);
  // best-effort — mantém o UUID se o perfil não for legível.
  modelo.observacoes = await resolverNomesAutores(modelo.observacoes);

  return { data: modelo, error: null };
}

/** Substitui o UUID em `usuario` pelo nome do perfil (profiles.nome_completo). */
async function resolverNomesAutores<T extends { usuario: string }>(itens: T[]): Promise<T[]> {
  const autorIds = [...new Set(itens.map((i) => i.usuario))].filter((id): id is string =>
    uuidPattern.test(id),
  );
  if (autorIds.length === 0) return itens;

  const { data, error } = await getSupabaseClient()
    .from("profiles")
    .select("id, nome_completo")
    .in("id", autorIds);
  if (error) return itens;

  const nomePorId = new Map(
    ((data ?? []) as { id: string; nome_completo: string }[]).map((p) => [p.id, p.nome_completo]),
  );
  return itens.map((i) => ({ ...i, usuario: nomePorId.get(i.usuario) ?? i.usuario }));
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
  /** Tipo de cadastro do assistido do responsável (definitivo/extra). */
  tipoCadastro: AssistidoTipoCadastroSupabase;
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
  /** Reutiliza uma pessoa existente em vez de criar nova. */
  pessoaId?: string;
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
  /** Reutiliza uma pessoa existente em vez de criar nova. */
  pessoaId?: string;
}

export interface AtualizarMembroInput {
  membroFamiliarId: string;
  nome: string;
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
    p_tipo_cadastro: input.tipoCadastro,
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
    p_pessoa_id: nullableParam(input.pessoaId),
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

async function aprovarAssistido(
  assistidoId: string,
): Promise<FamiliasSupabaseWriteResult<AprovarAssistidoResult>> {
  const { data, error } = await getSupabaseClient().rpc("aprovar_assistido_definitivo", {
    p_assistido_id: assistidoId,
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("aprovar_assistido", error) };
  }

  const row = firstRow<AprovarAssistidoResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "aprovar_assistido",
        code: "EMPTY_RESULT",
        message: "A aprovação do cadastro não retornou identificadores.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function aprovarAssistidoDefinitivoNoSupabase(
  assistidoId: string,
): Promise<FamiliasSupabaseWriteResult<AprovarAssistidoResult>> {
  try {
    return await aprovarAssistido(assistidoId);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("aprovar_assistido", error),
    };
  }
}

async function inativarAssistido(
  assistidoId: string,
): Promise<FamiliasSupabaseWriteResult<InativarAssistidoResult>> {
  const { data, error } = await getSupabaseClient().rpc("inativar_assistido", {
    p_assistido_id: assistidoId,
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("inativar_assistido", error) };
  }

  const row = firstRow<InativarAssistidoResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "inativar_assistido",
        code: "EMPTY_RESULT",
        message: "A inativação do assistido não retornou identificadores.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function inativarAssistidoNoSupabase(
  assistidoId: string,
): Promise<FamiliasSupabaseWriteResult<InativarAssistidoResult>> {
  try {
    return await inativarAssistido(assistidoId);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("inativar_assistido", error),
    };
  }
}

async function reativarAssistido(
  assistidoId: string,
): Promise<FamiliasSupabaseWriteResult<ReativarAssistidoResult>> {
  const { data, error } = await getSupabaseClient().rpc("reativar_assistido", {
    p_assistido_id: assistidoId,
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("reativar_assistido", error) };
  }

  const row = firstRow<ReativarAssistidoResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "reativar_assistido",
        code: "EMPTY_RESULT",
        message: "A reativação do assistido não retornou identificadores.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function reativarAssistidoNoSupabase(
  assistidoId: string,
): Promise<FamiliasSupabaseWriteResult<ReativarAssistidoResult>> {
  try {
    return await reativarAssistido(assistidoId);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("reativar_assistido", error),
    };
  }
}

async function atualizarMembro(
  input: AtualizarMembroInput,
): Promise<FamiliasSupabaseWriteResult<AtualizarMembroResult>> {
  const { data, error } = await getSupabaseClient().rpc("atualizar_membro_familiar", {
    p_membro_familiar_id: input.membroFamiliarId,
    p_nome: input.nome.trim(),
    p_parentesco: nullableParam(input.parentesco),
    p_telefone: nullableParam(input.telefone),
    p_nascimento: nullableParam(input.nascimento),
    p_pcd: input.pcd ?? false,
    p_gestante: input.gestante ?? false,
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("atualizar_membro", error) };
  }

  const row = firstRow<AtualizarMembroResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "atualizar_membro",
        code: "EMPTY_RESULT",
        message: "A atualização do membro não retornou identificadores.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function atualizarMembroFamiliarNoSupabase(
  input: AtualizarMembroInput,
): Promise<FamiliasSupabaseWriteResult<AtualizarMembroResult>> {
  try {
    return await atualizarMembro(input);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("atualizar_membro", error),
    };
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
    p_pessoa_id: nullableParam(input.pessoaId),
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
  motivo: "prazo" | "estoque" | "extra";
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

type PessoaExistenteRow = {
  pessoa_id: string;
  nome: string;
  documento: string;
  telefone: string | null;
  familia_ativa_id: string | null;
  familia_ativa_nome: string | null;
};

/** Localiza uma pessoa pelo documento (best-effort; retorna null em erro/ausência). */
export async function buscarPessoaPorDocumentoNoSupabase(
  documento: string,
): Promise<PessoaExistente | null> {
  try {
    const { data, error } = await getSupabaseClient().rpc("buscar_pessoa_por_documento", {
      p_documento: documento,
    });
    if (error) return null;
    const row = firstRow<PessoaExistenteRow>(data);
    if (!row) return null;
    return {
      pessoaId: row.pessoa_id,
      nome: row.nome,
      documento: row.documento,
      telefone: row.telefone ?? undefined,
      familiaAtivaId: row.familia_ativa_id ?? undefined,
      familiaAtivaNome: row.familia_ativa_nome ?? undefined,
    };
  } catch {
    return null;
  }
}

export interface CriarPreCadastroInput {
  nome: string;
  tipoDocumento: PessoaTipoDocumentoSupabase;
  documento: string;
  telefone?: string;
  nascimento?: string;
  pcd?: boolean;
  /** true = já entregar Cesta Extra no pré-cadastro. */
  entregar: boolean;
  observacao?: string;
  /** Reutiliza uma pessoa existente em vez de criar nova. */
  pessoaId?: string;
}

async function criarPreCadastro(
  input: CriarPreCadastroInput,
): Promise<FamiliasSupabaseWriteResult<CriarPreCadastroResult>> {
  const { data, error } = await getSupabaseClient().rpc("criar_pre_cadastro", {
    p_nome: input.nome.trim(),
    p_tipo_documento: input.tipoDocumento,
    p_documento: input.documento.trim(),
    p_telefone: nullableParam(input.telefone),
    p_nascimento: input.nascimento ? input.nascimento : null,
    p_pcd: input.pcd ?? false,
    p_entregar: input.entregar,
    p_observacao: nullableParam(input.observacao),
    p_pessoa_id: nullableParam(input.pessoaId),
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("criar_pre_cadastro", error) };
  }

  const row = firstRow<CriarPreCadastroResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "criar_pre_cadastro",
        code: "EMPTY_RESULT",
        message: "O pré-cadastro não retornou identificadores.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function criarPreCadastroNoSupabase(
  input: CriarPreCadastroInput,
): Promise<FamiliasSupabaseWriteResult<CriarPreCadastroResult>> {
  try {
    return await criarPreCadastro(input);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("criar_pre_cadastro", error),
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
  entrega_id: string | null;
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
      .select("id, beneficio_id, tipo, quantidade, saldo_resultante, motivo, criado_em, entrega_id")
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

  const movRows = (movResult.data ?? []) as MovimentacaoRow[];

  // Linhas do ledger. A baixa automática da entrega grava entrega_id (desde a
  // migration 20260724220332); exibimos essas como "baixa"/"entrega" — agora com
  // saldo_resultante real —, e as demais como movimentação manual.
  const doLedger: MovimentacaoEstoque[] = movRows.map((m) => {
    const ehBaixaEntrega = m.entrega_id !== null;
    return {
      id: m.id,
      beneficioNome: nomePorId.get(m.beneficio_id) ?? "—",
      tipo: ehBaixaEntrega ? "baixa" : m.tipo,
      quantidade: m.quantidade,
      saldoResultante: m.saldo_resultante,
      motivo: m.motivo ?? undefined,
      criadoEm: m.criado_em,
      origem: ehBaixaEntrega ? "entrega" : "manual",
    };
  });

  // Entregas anteriores a essa migration não têm linha no ledger; sintetizamos a
  // baixa a partir de `entregas` apenas para elas (evita duplicar as que já têm
  // linha no ledger).
  const entregasComLedger = new Set(
    movRows.map((m) => m.entrega_id).filter((id): id is string => id !== null),
  );
  const baixas: MovimentacaoEstoque[] = ((entregasResult.data ?? []) as EntregaMovRow[])
    .filter((e) => !entregasComLedger.has(e.id))
    .map((e) => ({
      id: e.id,
      beneficioNome: nomePorId.get(e.beneficio_id) ?? "—",
      tipo: "baixa",
      quantidade: -1,
      saldoResultante: null,
      motivo: e.excepcional ? "Entrega excepcional" : "Entrega realizada",
      criadoEm: e.criado_em,
      origem: "entrega",
    }));

  const combinado = [...doLedger, ...baixas]
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
  observacao: string | null;
};

// Filtro comum às consultas de entregas: por janela de tempo (painel) ou por
// família (histórico do detalhe da família), sempre limitado.
type EntregasFiltro = { familiaId?: string; desde?: string; limite: number };

async function consultarEntregas(
  filtro: EntregasFiltro,
): Promise<FamiliasSupabaseReadResult<EntregaPainel[]>> {
  const client = getSupabaseClient();

  let query = client
    .from("entregas")
    .select("id, criado_em, familia_id, beneficio_id, assistido_id, excepcional, observacao")
    .order("criado_em", { ascending: false })
    .limit(filtro.limite);

  if (filtro.familiaId) query = query.eq("familia_id", filtro.familiaId);
  if (filtro.desde) query = query.gte("criado_em", filtro.desde);

  const entregasResult = await query;

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
    client.from("familias").select("id, nome_referencia, bairro").in("id", familiaIds),
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

  let pessoaInfo = new Map<string, { nome: string; documento: string }>();
  if (pessoaIds.length > 0) {
    const pessoasResult = await client
      .from("pessoas")
      .select("id, nome, documento")
      .in("id", pessoaIds);
    if (pessoasResult.error) {
      return {
        data: null,
        error: toFamiliasSupabaseReadError("listar_entregas_painel", pessoasResult.error),
      };
    }
    pessoaInfo = new Map(
      ((pessoasResult.data ?? []) as { id: string; nome: string; documento: string }[]).map((p) => [
        p.id,
        { nome: p.nome, documento: p.documento },
      ]),
    );
  }

  const nomeBeneficio = new Map(
    ((beneficiosResult.data ?? []) as { id: string; nome: string }[]).map((b) => [b.id, b.nome]),
  );
  const familiaInfo = new Map(
    (
      (familiasResult.data ?? []) as {
        id: string;
        nome_referencia: string | null;
        bairro: string | null;
      }[]
    ).map((f) => [f.id, { nome: f.nome_referencia ?? "", bairro: f.bairro ?? "" }]),
  );

  const data: EntregaPainel[] = entregas.map((e) => {
    const pessoaId = pessoaPorAssistido.get(e.assistido_id);
    const pessoa = pessoaId ? pessoaInfo.get(pessoaId) : undefined;
    const familia = familiaInfo.get(e.familia_id);
    return {
      id: e.id,
      criadoEm: e.criado_em,
      familiaId: e.familia_id,
      familiaNome: familia?.nome || "—",
      familiaBairro: familia?.bairro ?? "",
      assistidoId: e.assistido_id,
      assistidoNome: pessoa?.nome || "Assistido",
      documento: pessoa?.documento,
      beneficioNome: nomeBeneficio.get(e.beneficio_id) ?? "—",
      excepcional: e.excepcional,
      observacao: e.observacao ?? undefined,
    };
  });

  return { data, error: null };
}

export async function listarEntregasRecentesNoSupabase(
  diasJanela = 60,
  limite = 500,
): Promise<FamiliasSupabaseReadResult<EntregaPainel[]>> {
  try {
    const desde = new Date(Date.now() - diasJanela * 86400000).toISOString();
    return await consultarEntregas({ desde, limite });
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseReadError("listar_entregas_painel", error),
    };
  }
}

/** Histórico completo de entregas de uma família (todas as datas). */
export async function listarEntregasFamiliaNoSupabase(
  familiaId: string,
  limite = 500,
): Promise<FamiliasSupabaseReadResult<EntregaPainel[]>> {
  try {
    return await consultarEntregas({ familiaId, limite });
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseReadError("listar_entregas_painel", error),
    };
  }
}

type TentativaRow = {
  id: string;
  criado_em: string;
  familia_id: string;
  pessoa_id: string;
  beneficio_id: string | null;
  motivo: "prazo" | "estoque" | "extra";
  observacao: string | null;
};

type TentativasFiltro = { familiaId?: string; desde?: string; limite: number };

async function consultarTentativas(
  filtro: TentativasFiltro,
): Promise<FamiliasSupabaseReadResult<TentativaBloqueadaPainel[]>> {
  const client = getSupabaseClient();

  let query = client
    .from("tentativas_bloqueadas")
    .select("id, criado_em, familia_id, pessoa_id, beneficio_id, motivo, observacao")
    .order("criado_em", { ascending: false })
    .limit(filtro.limite);

  if (filtro.familiaId) query = query.eq("familia_id", filtro.familiaId);
  if (filtro.desde) query = query.gte("criado_em", filtro.desde);

  const tentativasResult = await query;

  if (tentativasResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("listar_tentativas", tentativasResult.error),
    };
  }

  const tentativas = (tentativasResult.data ?? []) as TentativaRow[];
  if (tentativas.length === 0) return { data: [], error: null };

  const pessoaIds = uniqueIds(tentativas.map((t) => t.pessoa_id));
  const familiaIds = uniqueIds(tentativas.map((t) => t.familia_id));
  const beneficioIds = uniqueIds(tentativas.map((t) => t.beneficio_id));

  const [pessoasResult, familiasResult, beneficiosResult] = await Promise.all([
    client.from("pessoas").select("id, nome, documento").in("id", pessoaIds),
    client.from("familias").select("id, nome_referencia").in("id", familiaIds),
    beneficioIds.length > 0
      ? client.from("beneficios").select("id, nome").in("id", beneficioIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (pessoasResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("listar_tentativas", pessoasResult.error),
    };
  }
  if (familiasResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("listar_tentativas", familiasResult.error),
    };
  }
  if (beneficiosResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("listar_tentativas", beneficiosResult.error),
    };
  }

  const pessoaInfo = new Map(
    ((pessoasResult.data ?? []) as { id: string; nome: string; documento: string }[]).map((p) => [
      p.id,
      { nome: p.nome, documento: p.documento },
    ]),
  );
  const nomeFamilia = new Map(
    ((familiasResult.data ?? []) as { id: string; nome_referencia: string | null }[]).map((f) => [
      f.id,
      f.nome_referencia ?? "",
    ]),
  );
  const nomeBeneficio = new Map(
    ((beneficiosResult.data ?? []) as { id: string; nome: string }[]).map((b) => [b.id, b.nome]),
  );

  const data: TentativaBloqueadaPainel[] = tentativas.map((t) => {
    const pessoa = pessoaInfo.get(t.pessoa_id);
    return {
      id: t.id,
      criadoEm: t.criado_em,
      familiaNome: nomeFamilia.get(t.familia_id) ?? "—",
      assistidoNome: pessoa?.nome || "Assistido",
      documento: pessoa?.documento,
      beneficioNome: (t.beneficio_id && nomeBeneficio.get(t.beneficio_id)) || "—",
      motivo: t.motivo,
      observacao: t.observacao ?? undefined,
    };
  });

  return { data, error: null };
}

export async function listarTentativasBloqueadasNoSupabase(
  diasJanela = 3650,
  limite = 500,
): Promise<FamiliasSupabaseReadResult<TentativaBloqueadaPainel[]>> {
  try {
    const desde = new Date(Date.now() - diasJanela * 86400000).toISOString();
    return await consultarTentativas({ desde, limite });
  } catch (error) {
    return { data: null, error: toUnexpectedFamiliasSupabaseReadError("listar_tentativas", error) };
  }
}

/** Histórico completo de tentativas bloqueadas de uma família (todas as datas). */
export async function listarTentativasFamiliaNoSupabase(
  familiaId: string,
  limite = 500,
): Promise<FamiliasSupabaseReadResult<TentativaBloqueadaPainel[]>> {
  try {
    return await consultarTentativas({ familiaId, limite });
  } catch (error) {
    return { data: null, error: toUnexpectedFamiliasSupabaseReadError("listar_tentativas", error) };
  }
}

/* ============ Recebimentos ============ */

export interface RecebimentoItemInput {
  nome: string;
  quantidade: number;
  unidade?: string;
  valorUnitario?: number;
  valorTotal?: number;
  /** Item do catálogo vinculado; gera entrada no estoque quando presente. */
  itemId?: string;
}

export interface CriarRecebimentoInput {
  data: string;
  origem: RecebimentoOrigem;
  parte: string;
  documento?: string;
  valor: number;
  observacao?: string;
  itens: RecebimentoItemInput[];
}

async function criarRecebimento(
  input: CriarRecebimentoInput,
): Promise<FamiliasSupabaseWriteResult<CriarRecebimentoResult>> {
  const itens = input.itens.map((i) => ({
    nome: i.nome.trim(),
    quantidade: i.quantidade,
    unidade: i.unidade?.trim() || null,
    valor_unitario: i.valorUnitario ?? null,
    valor_total: i.valorTotal ?? null,
    item_id: i.itemId ?? null,
  }));

  const { data, error } = await getSupabaseClient().rpc("criar_recebimento", {
    p_data: input.data,
    p_origem: input.origem,
    p_parte: input.parte.trim(),
    p_documento: nullableParam(input.documento),
    p_valor: input.valor,
    p_observacao: nullableParam(input.observacao),
    p_itens: itens,
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("criar_recebimento", error) };
  }

  const row = firstRow<CriarRecebimentoResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "criar_recebimento",
        code: "EMPTY_RESULT",
        message: "O registro do recebimento não retornou identificador.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function criarRecebimentoNoSupabase(
  input: CriarRecebimentoInput,
): Promise<FamiliasSupabaseWriteResult<CriarRecebimentoResult>> {
  try {
    return await criarRecebimento(input);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("criar_recebimento", error),
    };
  }
}

type RecebimentoRow = {
  id: string;
  data: string;
  origem: RecebimentoOrigem;
  parte: string;
  documento: string | null;
  valor: number;
  status: Recebimento["status"];
  observacao: string | null;
};

async function listarRecebimentos(): Promise<FamiliasSupabaseReadResult<Recebimento[]>> {
  const client = getSupabaseClient();

  const recebimentosResult = await client
    .from("recebimentos")
    .select("id, data, origem, parte, documento, valor, status, observacao")
    .order("data", { ascending: false })
    .limit(200);

  if (recebimentosResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("listar_recebimentos", recebimentosResult.error),
    };
  }

  const recebimentos = (recebimentosResult.data ?? []) as RecebimentoRow[];
  if (recebimentos.length === 0) return { data: [], error: null };

  const itensResult = await client
    .from("recebimento_itens")
    .select("recebimento_id")
    .in(
      "recebimento_id",
      recebimentos.map((r) => r.id),
    );

  if (itensResult.error) {
    return {
      data: null,
      error: toFamiliasSupabaseReadError("listar_recebimentos", itensResult.error),
    };
  }

  const contagem = new Map<string, number>();
  for (const item of (itensResult.data ?? []) as { recebimento_id: string }[]) {
    contagem.set(item.recebimento_id, (contagem.get(item.recebimento_id) ?? 0) + 1);
  }

  return {
    data: recebimentos.map((r) => ({
      id: r.id,
      data: r.data,
      origem: r.origem,
      parte: r.parte,
      documento: r.documento ?? undefined,
      valor: Number(r.valor),
      status: r.status,
      observacao: r.observacao ?? undefined,
      itensCount: contagem.get(r.id) ?? 0,
    })),
    error: null,
  };
}

export async function listarRecebimentosNoSupabase(): Promise<
  FamiliasSupabaseReadResult<Recebimento[]>
> {
  try {
    return await listarRecebimentos();
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseReadError("listar_recebimentos", error),
    };
  }
}

/* ============ Itens de estoque, composição e montagem ============ */

type ItemEstoqueRow = {
  id: string;
  nome: string;
  categoria: string | null;
  unidade: string;
  saldo: number;
  minimo: number;
  valor: number;
  ativo: boolean;
};

async function listarItensEstoque(): Promise<FamiliasSupabaseReadResult<ItemEstoque[]>> {
  const { data, error } = await getSupabaseClient()
    .from("itens_estoque")
    .select("id, nome, categoria, unidade, saldo, minimo, valor, ativo")
    .order("nome");

  if (error) {
    return { data: null, error: toFamiliasSupabaseReadError("listar_itens_estoque", error) };
  }

  const rows = (data ?? []) as ItemEstoqueRow[];
  return {
    data: rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      categoria: r.categoria ?? undefined,
      unidade: r.unidade,
      saldo: r.saldo,
      minimo: r.minimo,
      valor: r.valor,
      ativo: r.ativo,
    })),
    error: null,
  };
}

export async function listarItensEstoqueNoSupabase(): Promise<
  FamiliasSupabaseReadResult<ItemEstoque[]>
> {
  try {
    return await listarItensEstoque();
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseReadError("listar_itens_estoque", error),
    };
  }
}

type ComposicaoRow = {
  beneficio_id: string;
  item_id: string;
  quantidade: number;
};

// Lê toda a composição e resolve os itens em passo separado (mesmo padrão
// anti-embedding do restante do repositório), agrupando por benefício.
async function listarComposicoes(): Promise<FamiliasSupabaseReadResult<ComposicaoBeneficio[]>> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("composicao_beneficio")
    .select("beneficio_id, item_id, quantidade");

  if (error) {
    return { data: null, error: toFamiliasSupabaseReadError("listar_composicao", error) };
  }

  const rows = (data ?? []) as ComposicaoRow[];
  const itemIds = uniqueIds(rows.map((r) => r.item_id));

  const itemInfo = new Map<string, { nome: string; unidade: string; valor: number }>();
  if (itemIds.length > 0) {
    const itensResult = await client
      .from("itens_estoque")
      .select("id, nome, unidade, valor")
      .in("id", itemIds);

    if (itensResult.error) {
      return {
        data: null,
        error: toFamiliasSupabaseReadError("listar_composicao", itensResult.error),
      };
    }

    for (const it of (itensResult.data ?? []) as {
      id: string;
      nome: string;
      unidade: string;
      valor: number;
    }[]) {
      itemInfo.set(it.id, { nome: it.nome, unidade: it.unidade, valor: it.valor });
    }
  }

  const porBeneficio = new Map<string, ComposicaoItem[]>();
  for (const r of rows) {
    const info = itemInfo.get(r.item_id);
    const lista = porBeneficio.get(r.beneficio_id) ?? [];
    lista.push({
      itemId: r.item_id,
      itemNome: info?.nome ?? "—",
      unidade: info?.unidade ?? "",
      quantidade: r.quantidade,
      valor: info?.valor ?? 0,
    });
    porBeneficio.set(r.beneficio_id, lista);
  }

  const composicoes: ComposicaoBeneficio[] = [...porBeneficio.entries()].map(
    ([beneficioId, itens]) => ({
      beneficioId,
      itens: itens.sort((a, b) => a.itemNome.localeCompare(b.itemNome)),
    }),
  );

  return { data: composicoes, error: null };
}

export async function listarComposicoesNoSupabase(): Promise<
  FamiliasSupabaseReadResult<ComposicaoBeneficio[]>
> {
  try {
    return await listarComposicoes();
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseReadError("listar_composicao", error),
    };
  }
}

export interface RegistrarMovimentacaoItemInput {
  itemId: string;
  tipo: "entrada" | "saida" | "ajuste";
  quantidade: number;
  motivo?: string;
  observacao?: string;
}

async function registrarMovimentacaoItem(
  input: RegistrarMovimentacaoItemInput,
): Promise<FamiliasSupabaseWriteResult<RegistrarMovimentacaoItemResult>> {
  const { data, error } = await getSupabaseClient().rpc("registrar_movimentacao_item", {
    p_item_id: input.itemId,
    p_tipo: input.tipo,
    p_quantidade: input.quantidade,
    p_motivo: nullableParam(input.motivo),
    p_observacao: nullableParam(input.observacao),
  });

  if (error) {
    return {
      data: null,
      error: toFamiliasSupabaseWriteError("registrar_movimentacao_item", error),
    };
  }

  const row = firstRow<RegistrarMovimentacaoItemResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "registrar_movimentacao_item",
        code: "EMPTY_RESULT",
        message: "A movimentação não retornou identificadores.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function registrarMovimentacaoItemNoSupabase(
  input: RegistrarMovimentacaoItemInput,
): Promise<FamiliasSupabaseWriteResult<RegistrarMovimentacaoItemResult>> {
  try {
    return await registrarMovimentacaoItem(input);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("registrar_movimentacao_item", error),
    };
  }
}

export interface DefinirComposicaoInput {
  beneficioId: string;
  itens: { itemId: string; quantidade: number }[];
}

async function definirComposicaoBeneficio(
  input: DefinirComposicaoInput,
): Promise<FamiliasSupabaseWriteResult<DefinirComposicaoResult>> {
  const { data, error } = await getSupabaseClient().rpc("definir_composicao_beneficio", {
    p_beneficio_id: input.beneficioId,
    p_itens: input.itens.map((i) => ({ item_id: i.itemId, quantidade: i.quantidade })),
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("definir_composicao", error) };
  }

  const row = firstRow<DefinirComposicaoResult>(data);
  return { data: row ?? { total_itens: input.itens.length }, error: null };
}

export async function definirComposicaoBeneficioNoSupabase(
  input: DefinirComposicaoInput,
): Promise<FamiliasSupabaseWriteResult<DefinirComposicaoResult>> {
  try {
    return await definirComposicaoBeneficio(input);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("definir_composicao", error),
    };
  }
}

export interface MontarCestaInput {
  beneficioId: string;
  quantidade: number;
}

async function montarCesta(
  input: MontarCestaInput,
): Promise<FamiliasSupabaseWriteResult<MontarCestaResult>> {
  const { data, error } = await getSupabaseClient().rpc("montar_cesta", {
    p_beneficio_id: input.beneficioId,
    p_quantidade: input.quantidade,
  });

  if (error) {
    return { data: null, error: toFamiliasSupabaseWriteError("montar_cesta", error) };
  }

  const row = firstRow<MontarCestaResult>(data);
  if (!row) {
    return {
      data: null,
      error: {
        operation: "montar_cesta",
        code: "EMPTY_RESULT",
        message: "A montagem não retornou o saldo resultante.",
        details: null,
        hint: null,
      },
    };
  }

  return { data: row, error: null };
}

export async function montarCestaNoSupabase(
  input: MontarCestaInput,
): Promise<FamiliasSupabaseWriteResult<MontarCestaResult>> {
  try {
    return await montarCesta(input);
  } catch (error) {
    return {
      data: null,
      error: toUnexpectedFamiliasSupabaseWriteError("montar_cesta", error),
    };
  }
}
