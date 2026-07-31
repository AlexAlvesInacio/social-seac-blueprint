import type {
  BeneficioEstoque,
  ComposicaoBeneficio,
  ComposicaoItem,
  DefinirComposicaoResult,
  FamiliasSupabaseReadResult,
  FamiliasSupabaseWriteResult,
  ItemEstoque,
  MontarCestaResult,
  MovimentacaoEstoque,
  RegistrarMovimentacaoItemResult,
  RegistrarMovimentacaoResult,
} from "@/lib/familias/familias-supabase-types";
import {
  toFamiliasSupabaseReadError,
  toFamiliasSupabaseWriteError,
  toUnexpectedFamiliasSupabaseReadError,
  toUnexpectedFamiliasSupabaseWriteError,
} from "@/lib/familias/familias-supabase-types";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Repositório do domínio de estoque (benefícios, itens, movimentações,
 * composição e montagem de cestas). Extraído do catch-all
 * familias-repository.ts; os tipos de leitura/erro continuam em
 * familias-supabase-types.ts por serem compartilhados com atendimento.
 */

function nullableParam(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  return (data as T) ?? null;
}

function uniqueIds(ids: Array<string | null>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

/* ============ Benefícios ============ */

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

/* ============ Movimentações do ledger de benefícios ============ */

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

/* ============ Itens de estoque ============ */

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

/* ============ Composição de benefícios ============ */

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
