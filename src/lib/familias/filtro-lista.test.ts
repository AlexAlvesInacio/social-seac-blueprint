import { describe, expect, test } from "bun:test";

import {
  atendeAosFiltros,
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
