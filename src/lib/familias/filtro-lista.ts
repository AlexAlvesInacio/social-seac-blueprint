import type { FamiliaSupabaseReadModel } from "@/lib/familias/familias-supabase-types";

/** Item da listagem de famílias, já achatado para a tabela. */
export type FamiliaListaItem = {
  id: string;
  nome: string;
  responsavel: string;
  documento: string;
  telefone: string;
  bairro: string;
  tipoCadastro: "definitivo" | "extra" | "misto" | null;
  acompanhamento: FamiliaSupabaseReadModel["acompanhamento"];
  status: FamiliaSupabaseReadModel["status"];
};

export const FILTROS_VAZIOS = {
  nome: "",
  documento: "",
  telefone: "",
  bairro: "all",
  status: "all",
};

type Filtros = typeof FILTROS_VAZIOS;

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const soDigitos = (texto: string) => texto.replace(/\D/g, "");

const soAlnum = (texto: string) => texto.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();

/**
 * Filtragem no cliente: a tela já carrega a lista inteira, então filtrar aqui
 * é imediato e não gera ida ao servidor. Vale enquanto o volume couber na
 * memória — a paginação no servidor está registrada como follow-up.
 */
export function atendeAosFiltros(familia: FamiliaListaItem, filtros: Filtros): boolean {
  if (filtros.nome.trim()) {
    // Busca no nome da família e no do responsável: quem atende costuma
    // lembrar de um ou de outro, e ignorar acento evita busca frustrada.
    const alvo = semAcento(`${familia.nome} ${familia.responsavel}`);
    if (!alvo.includes(semAcento(filtros.nome.trim()))) return false;
  }
  if (filtros.documento.trim()) {
    // Compara sem pontuação: o documento pode estar gravado com ou sem ela,
    // e o RG aceita letra (termina em X em alguns estados).
    if (!soAlnum(familia.documento).includes(soAlnum(filtros.documento))) return false;
  }
  if (filtros.telefone.trim()) {
    const buscado = soDigitos(filtros.telefone);
    if (buscado && !soDigitos(familia.telefone).includes(buscado)) return false;
  }
  if (filtros.bairro !== "all" && familia.bairro !== filtros.bairro) return false;
  if (filtros.status !== "all" && familia.status !== filtros.status) return false;
  return true;
}

/** Famílias por página na listagem. */
export const POR_PAGINA = 50;

export type Paginacao = {
  paginaAtual: number;
  totalPaginas: number;
  primeiro: number;
};

/**
 * Calcula a fatia visível. Existe separado porque é onde moram os erros de
 * fronteira: filtrar encurta a lista, e quem estava numa página alta veria
 * uma tela vazia em vez do resultado da busca.
 */
export function calcularPaginacao(
  totalItens: number,
  paginaDesejada: number,
  porPagina = POR_PAGINA,
): Paginacao {
  const totalPaginas = Math.max(1, Math.ceil(totalItens / porPagina));
  const paginaAtual = Math.min(Math.max(1, paginaDesejada), totalPaginas);
  return { paginaAtual, totalPaginas, primeiro: (paginaAtual - 1) * porPagina };
}
