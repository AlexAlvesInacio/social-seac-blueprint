import { describe, expect, test } from "bun:test";

import {
  atendeAosFiltros,
  calcularPaginacao,
  FILTROS_VAZIOS,
  type FamiliaListaItem,
} from "@/lib/familias/filtro-lista";

const FAMILIA: FamiliaListaItem = {
  id: "f-1",
  nome: "Família Conceição",
  responsavel: "MARIA DA CONCEIÇÃO SOUZA",
  documento: "12.345.678-9",
  telefone: "(11) 98888-7777",
  bairro: "Centro",
  tipoCadastro: "definitivo",
  acompanhamento: "em_dia",
  status: "liberado",
};

const com = (parcial: Partial<typeof FILTROS_VAZIOS>) => ({ ...FILTROS_VAZIOS, ...parcial });

describe("filtro da lista de famílias", () => {
  test("sem filtro, tudo passa", () => {
    expect(atendeAosFiltros(FAMILIA, FILTROS_VAZIOS)).toBe(true);
  });

  test("nome ignora acento e caixa", () => {
    expect(atendeAosFiltros(FAMILIA, com({ nome: "conceicao" }))).toBe(true);
    expect(atendeAosFiltros(FAMILIA, com({ nome: "CONCEIÇÃO" }))).toBe(true);
  });

  test("busca também pelo nome do responsável", () => {
    expect(atendeAosFiltros(FAMILIA, com({ nome: "souza" }))).toBe(true);
  });

  test("nome que não existe não passa", () => {
    expect(atendeAosFiltros(FAMILIA, com({ nome: "oliveira" }))).toBe(false);
  });

  test("documento encontra com e sem pontuação", () => {
    expect(atendeAosFiltros(FAMILIA, com({ documento: "123456789" }))).toBe(true);
    expect(atendeAosFiltros(FAMILIA, com({ documento: "12.345" }))).toBe(true);
  });

  test("documento aceita RG com letra", () => {
    const comX = { ...FAMILIA, documento: "14686864X" };
    expect(atendeAosFiltros(comX, com({ documento: "14686864x" }))).toBe(true);
  });

  test("telefone compara só os dígitos", () => {
    expect(atendeAosFiltros(FAMILIA, com({ telefone: "988887777" }))).toBe(true);
    expect(atendeAosFiltros(FAMILIA, com({ telefone: "(11)" }))).toBe(true);
  });

  test("bairro e status filtram por igualdade", () => {
    expect(atendeAosFiltros(FAMILIA, com({ bairro: "Centro" }))).toBe(true);
    expect(atendeAosFiltros(FAMILIA, com({ bairro: "Outro" }))).toBe(false);
    expect(atendeAosFiltros(FAMILIA, com({ status: "liberado" }))).toBe(true);
    expect(atendeAosFiltros(FAMILIA, com({ status: "inativo" }))).toBe(false);
  });

  test("filtros se combinam — todos precisam bater", () => {
    expect(atendeAosFiltros(FAMILIA, com({ nome: "maria", status: "liberado" }))).toBe(true);
    expect(atendeAosFiltros(FAMILIA, com({ nome: "maria", status: "inativo" }))).toBe(false);
  });

  test("espaço em branco não filtra nada", () => {
    expect(atendeAosFiltros(FAMILIA, com({ nome: "   " }))).toBe(true);
  });
});

describe("calcularPaginacao", () => {
  test("lista vazia continua tendo uma página", () => {
    expect(calcularPaginacao(0, 1)).toEqual({ paginaAtual: 1, totalPaginas: 1, primeiro: 0 });
  });

  test("1.018 famílias em páginas de 50 dão 21 páginas", () => {
    const { totalPaginas } = calcularPaginacao(1018, 1);
    expect(totalPaginas).toBe(21);
  });

  test("a última página começa no item certo", () => {
    expect(calcularPaginacao(1018, 21).primeiro).toBe(1000);
  });

  test("página além do fim volta para a última", () => {
    // O caso real: estar na página 12 e filtrar para 3 resultados.
    const { paginaAtual, primeiro } = calcularPaginacao(3, 12);
    expect(paginaAtual).toBe(1);
    expect(primeiro).toBe(0);
  });

  test("página zero ou negativa vira a primeira", () => {
    expect(calcularPaginacao(100, 0).paginaAtual).toBe(1);
    expect(calcularPaginacao(100, -5).paginaAtual).toBe(1);
  });

  test("total exatamente múltiplo não cria página vazia", () => {
    expect(calcularPaginacao(100, 1, 50).totalPaginas).toBe(2);
  });
});
