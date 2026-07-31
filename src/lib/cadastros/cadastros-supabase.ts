import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Cadastros auxiliares (unidades, categorias, doadores, fornecedores) no
 * Supabase — substitui os stores em localStorage do config-store. Itens e
 * benefícios seguem em itens_estoque/beneficios (fatia própria).
 */

export type CadastroStatus = "ativo" | "inativo";

export interface UnidadeCadastro {
  id: string;
  codigo: string;
  nome: string;
  sigla: string;
  usadaEstoque: boolean;
  status: CadastroStatus;
}

export interface CategoriaCadastro {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  status: CadastroStatus;
}

export type DoadorTipo = "Pessoa física" | "Empresa" | "Anônimo";

export interface DoadorCadastro {
  id: string;
  nome: string;
  tipo: DoadorTipo;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  observacao: string;
  ultimaDoacao: string | null;
  status: CadastroStatus;
}

export interface FornecedorCadastro {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  categoria: string;
  observacao: string;
  status: CadastroStatus;
}

export class CadastrosSupabaseError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "CadastrosSupabaseError";
    this.code = code;
  }
}

export const cadastrosQueryKeys = {
  unidades: ["cadastros", "unidades"] as const,
  categorias: ["cadastros", "categorias"] as const,
  doadores: ["cadastros", "doadores"] as const,
  fornecedores: ["cadastros", "fornecedores"] as const,
};

function statusDeAtivo(ativo: boolean): CadastroStatus {
  return ativo ? "ativo" : "inativo";
}

function lancarErro(error: { message: string; code?: string }): never {
  if (error.code === "23505") {
    throw new CadastrosSupabaseError("Já existe um cadastro com este código.", error.code);
  }
  if (error.code === "42501") {
    throw new CadastrosSupabaseError(
      "Apenas administrador ativo pode alterar cadastros auxiliares.",
      error.code,
    );
  }
  throw new CadastrosSupabaseError(error.message, error.code);
}

/* ---------- Unidades ---------- */

type UnidadeRow = {
  id: string;
  codigo: string;
  nome: string;
  sigla: string;
  usada_estoque: boolean;
  ativo: boolean;
};

const UNIDADE_COLUNAS = "id, codigo, nome, sigla, usada_estoque, ativo";

function mapUnidade(row: UnidadeRow): UnidadeCadastro {
  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    sigla: row.sigla,
    usadaEstoque: row.usada_estoque,
    status: statusDeAtivo(row.ativo),
  };
}

export interface UnidadeCadastroInput {
  codigo: string;
  nome: string;
  sigla: string;
  usadaEstoque: boolean;
  status: CadastroStatus;
}

async function listarUnidades(): Promise<UnidadeCadastro[]> {
  const { data, error } = await getSupabaseClient()
    .from("unidades")
    .select(UNIDADE_COLUNAS)
    .order("codigo");
  if (error) lancarErro(error);
  return ((data ?? []) as UnidadeRow[]).map(mapUnidade);
}

async function salvarUnidade(input: UnidadeCadastroInput & { id?: string }): Promise<void> {
  const payload = {
    codigo: input.codigo.trim(),
    nome: input.nome.trim(),
    sigla: input.sigla.trim(),
    usada_estoque: input.usadaEstoque,
    ativo: input.status === "ativo",
  };
  const client = getSupabaseClient();
  const { error } = input.id
    ? await client.from("unidades").update(payload).eq("id", input.id)
    : await client.from("unidades").insert(payload);
  if (error) lancarErro(error);
}

/* ---------- Categorias ---------- */

type CategoriaRow = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
};

const CATEGORIA_COLUNAS = "id, codigo, nome, descricao, ativo";

function mapCategoria(row: CategoriaRow): CategoriaCadastro {
  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    descricao: row.descricao ?? "",
    status: statusDeAtivo(row.ativo),
  };
}

export interface CategoriaCadastroInput {
  codigo: string;
  nome: string;
  descricao: string;
  status: CadastroStatus;
}

async function listarCategorias(): Promise<CategoriaCadastro[]> {
  const { data, error } = await getSupabaseClient()
    .from("categorias")
    .select(CATEGORIA_COLUNAS)
    .order("codigo");
  if (error) lancarErro(error);
  return ((data ?? []) as CategoriaRow[]).map(mapCategoria);
}

async function salvarCategoria(input: CategoriaCadastroInput & { id?: string }): Promise<void> {
  const payload = {
    codigo: input.codigo.trim(),
    nome: input.nome.trim(),
    descricao: input.descricao.trim() || null,
    ativo: input.status === "ativo",
  };
  const client = getSupabaseClient();
  const { error } = input.id
    ? await client.from("categorias").update(payload).eq("id", input.id)
    : await client.from("categorias").insert(payload);
  if (error) lancarErro(error);
}

/* ---------- Doadores ---------- */

type DoadorRow = {
  id: string;
  nome: string;
  tipo: DoadorTipo;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  observacao: string | null;
  ultima_doacao: string | null;
  ativo: boolean;
};

const DOADOR_COLUNAS =
  "id, nome, tipo, documento, telefone, email, endereco, observacao, ultima_doacao, ativo";

function mapDoador(row: DoadorRow): DoadorCadastro {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    documento: row.documento ?? "",
    telefone: row.telefone ?? "",
    email: row.email ?? "",
    endereco: row.endereco ?? "",
    observacao: row.observacao ?? "",
    ultimaDoacao: row.ultima_doacao,
    status: statusDeAtivo(row.ativo),
  };
}

export interface DoadorCadastroInput {
  nome: string;
  tipo: DoadorTipo;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  observacao: string;
  status: CadastroStatus;
}

async function listarDoadores(): Promise<DoadorCadastro[]> {
  const { data, error } = await getSupabaseClient()
    .from("doadores")
    .select(DOADOR_COLUNAS)
    .order("nome");
  if (error) lancarErro(error);
  return ((data ?? []) as DoadorRow[]).map(mapDoador);
}

async function salvarDoador(input: DoadorCadastroInput & { id?: string }): Promise<void> {
  const payload = {
    nome: input.nome.trim(),
    tipo: input.tipo,
    documento: input.documento.trim() || null,
    telefone: input.telefone.trim() || null,
    email: input.email.trim() || null,
    endereco: input.endereco.trim() || null,
    observacao: input.observacao.trim() || null,
    ativo: input.status === "ativo",
  };
  const client = getSupabaseClient();
  const { error } = input.id
    ? await client.from("doadores").update(payload).eq("id", input.id)
    : await client.from("doadores").insert(payload);
  if (error) lancarErro(error);
}

/* ---------- Fornecedores ---------- */

type FornecedorRow = {
  id: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  categoria: string;
  observacao: string | null;
  ativo: boolean;
};

const FORNECEDOR_COLUNAS = "id, nome, documento, telefone, email, categoria, observacao, ativo";

function mapFornecedor(row: FornecedorRow): FornecedorCadastro {
  return {
    id: row.id,
    nome: row.nome,
    documento: row.documento ?? "",
    telefone: row.telefone ?? "",
    email: row.email ?? "",
    categoria: row.categoria,
    observacao: row.observacao ?? "",
    status: statusDeAtivo(row.ativo),
  };
}

export interface FornecedorCadastroInput {
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  categoria: string;
  observacao: string;
  status: CadastroStatus;
}

async function listarFornecedores(): Promise<FornecedorCadastro[]> {
  const { data, error } = await getSupabaseClient()
    .from("fornecedores")
    .select(FORNECEDOR_COLUNAS)
    .order("nome");
  if (error) lancarErro(error);
  return ((data ?? []) as FornecedorRow[]).map(mapFornecedor);
}

async function salvarFornecedor(input: FornecedorCadastroInput & { id?: string }): Promise<void> {
  const payload = {
    nome: input.nome.trim(),
    documento: input.documento.trim() || null,
    telefone: input.telefone.trim() || null,
    email: input.email.trim() || null,
    categoria: input.categoria.trim(),
    observacao: input.observacao.trim() || null,
    ativo: input.status === "ativo",
  };
  const client = getSupabaseClient();
  const { error } = input.id
    ? await client.from("fornecedores").update(payload).eq("id", input.id)
    : await client.from("fornecedores").insert(payload);
  if (error) lancarErro(error);
}

/* ---------- Operações comuns ---------- */

type CadastroTabela = "unidades" | "categorias" | "doadores" | "fornecedores";

async function definirStatusCadastro(
  tabela: CadastroTabela,
  id: string,
  status: CadastroStatus,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from(tabela)
    .update({ ativo: status === "ativo" })
    .eq("id", id);
  if (error) lancarErro(error);
}

async function excluirCadastro(tabela: CadastroTabela, id: string): Promise<void> {
  const { error } = await getSupabaseClient().from(tabela).delete().eq("id", id);
  if (error) lancarErro(error);
}

/* ---------- Hooks ---------- */

const QUERY_KEY_POR_TABELA = {
  unidades: cadastrosQueryKeys.unidades,
  categorias: cadastrosQueryKeys.categorias,
  doadores: cadastrosQueryKeys.doadores,
  fornecedores: cadastrosQueryKeys.fornecedores,
} as const;

function useInvalidarCadastro(tabela: CadastroTabela) {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY_POR_TABELA[tabela] });
}

export function useUnidadesSupabase() {
  return useQuery({ queryKey: cadastrosQueryKeys.unidades, queryFn: listarUnidades });
}

export function useCategoriasSupabase() {
  return useQuery({ queryKey: cadastrosQueryKeys.categorias, queryFn: listarCategorias });
}

export function useDoadoresSupabase() {
  return useQuery({ queryKey: cadastrosQueryKeys.doadores, queryFn: listarDoadores });
}

export function useFornecedoresSupabase() {
  return useQuery({ queryKey: cadastrosQueryKeys.fornecedores, queryFn: listarFornecedores });
}

export function useSalvarUnidade() {
  const invalidar = useInvalidarCadastro("unidades");
  return useMutation({ mutationFn: salvarUnidade, onSuccess: invalidar });
}

export function useSalvarCategoria() {
  const invalidar = useInvalidarCadastro("categorias");
  return useMutation({ mutationFn: salvarCategoria, onSuccess: invalidar });
}

export function useSalvarDoador() {
  const invalidar = useInvalidarCadastro("doadores");
  return useMutation({ mutationFn: salvarDoador, onSuccess: invalidar });
}

export function useSalvarFornecedor() {
  const invalidar = useInvalidarCadastro("fornecedores");
  return useMutation({ mutationFn: salvarFornecedor, onSuccess: invalidar });
}

export function useDefinirStatusCadastro(tabela: CadastroTabela) {
  const invalidar = useInvalidarCadastro(tabela);
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CadastroStatus }) =>
      definirStatusCadastro(tabela, id, status),
    onSuccess: invalidar,
  });
}

export function useExcluirCadastro(tabela: CadastroTabela) {
  const invalidar = useInvalidarCadastro(tabela);
  return useMutation({
    mutationFn: ({ id }: { id: string }) => excluirCadastro(tabela, id),
    onSuccess: invalidar,
  });
}
