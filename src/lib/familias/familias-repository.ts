import type { PostgrestError } from "@supabase/supabase-js";

import { mapFamiliaFromSupabase, mapFamiliasFromSupabase } from "@/lib/familias/familias-mapper";
import type {
  AssistidoSupabaseRow,
  FamiliaSupabaseId,
  FamiliaSupabaseReadModel,
  FamiliaSupabaseRow,
  FamiliasSupabaseReadOperation,
  FamiliasSupabaseReadResult,
  MembroFamiliarSupabaseRow,
  ObservacaoSocialSupabaseRow,
  PessoaSupabaseRow,
} from "@/lib/familias/familias-supabase-types";
import {
  toFamiliasSupabaseReadError,
  toUnexpectedFamiliasSupabaseReadError,
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
