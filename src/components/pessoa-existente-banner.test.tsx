import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { TransferirPessoaInput } from "@/lib/familias/familias-repository";
import type { PessoaExistente } from "@/lib/familias/familias-supabase-types";

// Estado controlado pelos testes; os mocks abaixo apenas o leem.
let pessoa: PessoaExistente | undefined;
let papel: string;
const transferirMutate = mock((_input: TransferirPessoaInput) => {});

mock.module("@/lib/familias/use-familias-supabase", () => ({
  usePessoaPorDocumento: () => ({ data: pessoa }),
  useTransferirPessoa: () => ({
    mutate: transferirMutate,
    reset: () => {},
    isPending: false,
    isError: false,
    error: null,
  }),
}));

mock.module("@/lib/auth/auth-service", () => ({
  getCurrentProfile: async () => ({ data: { papel } }),
}));

const { PessoaExistenteBanner } = await import("@/components/pessoa-existente-banner");

const EM_OUTRA_FAMILIA: PessoaExistente = {
  pessoaId: "p-1",
  nome: "Joana Silva",
  documento: "111.444.777-35",
  familiaAtivaId: "f-origem",
  familiaAtivaNome: "Família Souza",
};

const LIVRE: PessoaExistente = {
  pessoaId: "p-2",
  nome: "Carlos Lima",
  documento: "529.982.247-25",
};

function montar(props: Partial<Parameters<typeof PessoaExistenteBanner>[0]> = {}) {
  return render(
    <PessoaExistenteBanner
      documento="11144477735"
      pessoaIdSelecionado=""
      onReutilizar={() => {}}
      onLimpar={() => {}}
      familiaDestinoId="f-destino"
      {...props}
    />,
  );
}

beforeEach(() => {
  pessoa = EM_OUTRA_FAMILIA;
  papel = "administrador";
  transferirMutate.mockClear();
});

afterEach(cleanup);

describe("PessoaExistenteBanner — pessoa ativa em outra família", () => {
  test("administrador vê a opção de transferir", async () => {
    montar();
    expect(await screen.findByRole("button", { name: /transferir/i })).toBeDefined();
    expect(screen.getByText(/já é membro ativo da família/i)).toBeDefined();
  });

  test("atendente não vê a opção e é informado do motivo", async () => {
    papel = "atendente";
    montar();
    await waitFor(() => {
      expect(screen.getByText(/exige um administrador/i)).toBeDefined();
    });
    expect(screen.queryByRole("button", { name: /transferir/i })).toBeNull();
  });

  test("sem família de destino (pré-cadastro), orienta em vez de oferecer", async () => {
    montar({ familiaDestinoId: undefined });
    await waitFor(() => {
      expect(screen.getByText(/abra o cadastro pela família de destino/i)).toBeDefined();
    });
    expect(screen.queryByRole("button", { name: /transferir/i })).toBeNull();
  });

  test("avisa as duas consequências antes de confirmar", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("button", { name: /transferir/i }));

    // O vínculo de assistida encerrado e o histórico que acompanha a pessoa são
    // irreversíveis pela tela: precisam estar escritos antes do clique final.
    expect(screen.getByText(/assistida se ela receber benefício lá/i)).toBeDefined();
    expect(screen.getByText(/histórico de retiradas acompanha a pessoa/i)).toBeDefined();
  });

  test("motivo curto mantém a confirmação bloqueada", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("button", { name: /transferir/i }));

    const confirmar = screen.getByRole("button", { name: /confirmar transferência/i });
    expect(confirmar.hasAttribute("disabled")).toBe(true);

    await user.type(screen.getByPlaceholderText(/motivo/i), "abc");
    expect(confirmar.hasAttribute("disabled")).toBe(true);
  });

  test("motivo válido envia pessoa, destino e motivo", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("button", { name: /transferir/i }));
    await user.type(screen.getByPlaceholderText(/motivo/i), "Mudou de endereço");
    await user.click(screen.getByRole("button", { name: /confirmar transferência/i }));

    expect(transferirMutate).toHaveBeenCalledTimes(1);
    expect(transferirMutate.mock.calls[0][0]).toEqual({
      pessoaId: "p-1",
      familiaDestinoId: "f-destino",
      motivo: "Mudou de endereço",
    });
  });
});

describe("PessoaExistenteBanner — pessoa sem vínculo ativo", () => {
  test("oferece reuso, não transferência", async () => {
    pessoa = LIVRE;
    montar();
    expect(await screen.findByRole("button", { name: /reutilizar/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /transferir/i })).toBeNull();
  });

  test("não renderiza nada quando o documento não corresponde a ninguém", () => {
    pessoa = undefined;
    const { container } = montar();
    expect(container.innerHTML).toBe("");
  });
});
