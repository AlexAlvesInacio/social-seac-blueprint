import type { PostgrestError } from "@supabase/supabase-js";

import type {
  FamiliaSupabaseId,
  MembroFamiliarSupabaseId,
  PessoaSupabaseId,
  PessoaTipoDocumentoSupabase,
} from "@/lib/familias/familias-supabase-types";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface CriarFamiliaComResponsavelSupabaseInput {
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

export interface FamiliaCriadaSupabase {
  familiaId: FamiliaSupabaseId;
  pessoaId: PessoaSupabaseId;
  membroFamiliarId: MembroFamiliarSupabaseId;
}

interface CriarFamiliaComResponsavelRpcRow {
  familia_id: FamiliaSupabaseId;
  pessoa_id: PessoaSupabaseId;
  membro_familiar_id: MembroFamiliarSupabaseId;
}

interface CriarFamiliaComResponsavelRpcArgs {
  p_nome_referencia: string;
  p_responsavel_nome: string;
  p_responsavel_tipo_documento: PessoaTipoDocumentoSupabase;
  p_responsavel_documento: string;
  p_responsavel_telefone: string | null;
  p_endereco: string | null;
  p_numero: string | null;
  p_complemento: string | null;
  p_bairro: string | null;
  p_cidade: string | null;
  p_uf: string | null;
  p_cep: string | null;
}

export type FamiliasSupabaseWriteErrorKind =
  | "documento_duplicado"
  | "conflito"
  | "dados_invalidos"
  | "sem_permissao"
  | "resposta_invalida"
  | "indisponivel";

export class FamiliasSupabaseWriteError extends Error {
  readonly kind: FamiliasSupabaseWriteErrorKind;
  readonly code: string;
  readonly details: string | null;
  readonly hint: string | null;

  constructor({
    kind,
    code,
    message,
    details = null,
    hint = null,
  }: {
    kind: FamiliasSupabaseWriteErrorKind;
    code: string;
    message: string;
    details?: string | null;
    hint?: string | null;
  }) {
    super(message);
    this.name = "FamiliasSupabaseWriteError";
    this.kind = kind;
    this.code = code;
    this.details = details;
    this.hint = hint;
  }
}

function classifyPostgrestError(error: PostgrestError): FamiliasSupabaseWriteErrorKind {
  if (
    error.code === "23505" &&
    error.message === "Já existe uma pessoa cadastrada com este documento."
  ) {
    return "documento_duplicado";
  }
  if (error.code === "23505") return "conflito";
  if (error.code === "42501") return "sem_permissao";
  if (error.code === "PGRST116") return "resposta_invalida";
  if (["22023", "22P02", "23514", "P0001"].includes(error.code)) {
    return "dados_invalidos";
  }

  return "indisponivel";
}

function fromPostgrestError(error: PostgrestError): FamiliasSupabaseWriteError {
  return new FamiliasSupabaseWriteError({
    kind: classifyPostgrestError(error),
    code: error.code,
    message: error.message,
    details: error.details || null,
    hint: error.hint || null,
  });
}

function nullIfBlank(value?: string): string | null {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
}

function isRpcRow(value: unknown): value is CriarFamiliaComResponsavelRpcRow {
  if (!value || typeof value !== "object") return false;

  const row = value as Partial<CriarFamiliaComResponsavelRpcRow>;
  return (
    typeof row.familia_id === "string" &&
    typeof row.pessoa_id === "string" &&
    typeof row.membro_familiar_id === "string"
  );
}

export async function criarFamiliaComResponsavelNoSupabase(
  input: CriarFamiliaComResponsavelSupabaseInput,
): Promise<FamiliaCriadaSupabase> {
  try {
    const args = {
      p_nome_referencia: input.nomeReferencia.trim(),
      p_responsavel_nome: input.responsavelNome.trim(),
      p_responsavel_tipo_documento: input.responsavelTipoDocumento,
      p_responsavel_documento: input.responsavelDocumento.trim(),
      p_responsavel_telefone: nullIfBlank(input.responsavelTelefone),
      p_endereco: nullIfBlank(input.endereco),
      p_numero: nullIfBlank(input.numero),
      p_complemento: nullIfBlank(input.complemento),
      p_bairro: nullIfBlank(input.bairro),
      p_cidade: nullIfBlank(input.cidade),
      p_uf: nullIfBlank(input.uf),
      p_cep: nullIfBlank(input.cep),
    } satisfies CriarFamiliaComResponsavelRpcArgs;

    const { data, error } = await getSupabaseClient()
      .rpc("criar_familia_com_responsavel", args)
      .single()
      .overrideTypes<CriarFamiliaComResponsavelRpcRow, { merge: false }>();

    if (error) throw fromPostgrestError(error);

    if (!isRpcRow(data)) {
      throw new FamiliasSupabaseWriteError({
        kind: "resposta_invalida",
        code: "INVALID_RPC_RESPONSE",
        message: "A criação foi concluída sem retornar os identificadores esperados.",
      });
    }

    return {
      familiaId: data.familia_id,
      pessoaId: data.pessoa_id,
      membroFamiliarId: data.membro_familiar_id,
    };
  } catch (error) {
    if (error instanceof FamiliasSupabaseWriteError) throw error;

    throw new FamiliasSupabaseWriteError({
      kind: "indisponivel",
      code: "SUPABASE_WRITE_ERROR",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível concluir o cadastro no Supabase.",
    });
  }
}
