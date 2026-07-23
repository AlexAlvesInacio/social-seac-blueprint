import type {
  AssistidoSupabaseReadModel,
  AssistidoSupabaseRow,
  FamiliaSupabaseAggregateRows,
  FamiliaSupabaseReadModel,
  FamiliaSupabaseRow,
  MembroFamiliarSupabaseReadModel,
  MembroFamiliarSupabaseRow,
  ObservacaoSocialSupabaseReadModel,
  ObservacaoSocialSupabaseRow,
  ObservacaoSocialTipoLocal,
  ObservacaoSocialTipoSupabase,
  PessoaSupabaseReadModel,
  PessoaSupabaseRow,
} from "@/lib/familias/familias-supabase-types";
import { FamiliasSupabaseIntegrityError } from "@/lib/familias/familias-supabase-types";

const observacaoTipoLocal: Record<ObservacaoSocialTipoSupabase, ObservacaoSocialTipoLocal> = {
  social: "Social",
  atendimento: "Atendimento",
  documento: "Documento",
  endereco: "Endereço",
  saude_pcd: "Saúde/PCD",
  outro: "Outro",
};

function optionalText(value: string | null): string | undefined {
  return value ?? undefined;
}

function calcularIdade(nascimento?: string): number | null {
  if (!nascimento) return null;

  const dataNascimento = new Date(`${nascimento}T00:00:00`);
  if (Number.isNaN(dataNascimento.getTime())) return null;

  const hoje = new Date();
  if (dataNascimento.getTime() > hoje.getTime()) return null;

  let idade = hoje.getFullYear() - dataNascimento.getFullYear();
  const diferencaMes = hoje.getMonth() - dataNascimento.getMonth();

  if (diferencaMes < 0 || (diferencaMes === 0 && hoje.getDate() < dataNascimento.getDate())) {
    idade -= 1;
  }

  return idade;
}

function mapPessoa(row: PessoaSupabaseRow): PessoaSupabaseReadModel {
  return {
    id: row.id,
    nome: row.nome,
    tipoDocumento: row.tipo_documento,
    documento: row.documento,
    documentoNormalizado: row.documento_normalizado,
    telefone: optionalText(row.telefone),
    nascimento: optionalText(row.nascimento),
    pcd: row.pcd,
    observacoes: optionalText(row.observacoes),
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function requirePessoa(
  pessoasPorId: ReadonlyMap<string, PessoaSupabaseReadModel>,
  pessoaId: string,
  relationName: "membro" | "assistido",
): PessoaSupabaseReadModel {
  const pessoa = pessoasPorId.get(pessoaId);

  if (!pessoa) {
    throw new FamiliasSupabaseIntegrityError(
      `A pessoa ${pessoaId} referenciada pelo ${relationName} não foi carregada.`,
    );
  }

  return pessoa;
}

function mapAssistido(
  row: AssistidoSupabaseRow,
  pessoa: PessoaSupabaseReadModel,
): AssistidoSupabaseReadModel {
  return {
    id: row.id,
    familiaId: row.familia_id,
    pessoaId: row.pessoa_id,
    membroFamiliarId: row.membro_familiar_id,
    nome: pessoa.nome,
    documento: pessoa.documento,
    telefone: pessoa.telefone,
    nascimento: pessoa.nascimento,
    tipoCadastro: row.tipo_cadastro,
    beneficio: optionalText(row.beneficio),
    status: row.status,
    pcd: pessoa.pcd,
    observacoes: optionalText(row.observacoes),
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function mapMembro(
  row: MembroFamiliarSupabaseRow,
  pessoa: PessoaSupabaseReadModel,
  assistidos: AssistidoSupabaseReadModel[],
): MembroFamiliarSupabaseReadModel {
  const idade = calcularIdade(pessoa.nascimento);
  const assistidoAtivo = assistidos.find((assistido) => assistido.status === "ativo");

  return {
    id: row.id,
    familiaId: row.familia_id,
    pessoaId: row.pessoa_id,
    nome: pessoa.nome,
    parentesco: row.parentesco ?? "—",
    documento: pessoa.documento,
    tipoDocumento: pessoa.tipoDocumento,
    telefone: pessoa.telefone,
    nascimento: pessoa.nascimento,
    crianca: idade !== null && idade <= 12,
    adolescente: idade !== null && idade >= 13 && idade <= 17,
    idoso: idade !== null && idade >= 60,
    gestante: row.gestante,
    pcd: pessoa.pcd,
    observacoes: pessoa.observacoes,
    responsavelPrincipal: row.responsavel_principal,
    status: row.status,
    assistidoId: assistidoAtivo?.id,
    assistidos,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function mapObservacao(row: ObservacaoSocialSupabaseRow): ObservacaoSocialSupabaseReadModel {
  return {
    id: row.id,
    familiaId: row.familia_id,
    pessoaId: row.pessoa_id ?? undefined,
    assistidoId: row.assistido_id ?? undefined,
    tipo: observacaoTipoLocal[row.tipo],
    texto: row.texto,
    data: row.criado_em,
    usuario: row.criado_por,
  };
}

function mapFamilia(
  familia: FamiliaSupabaseRow,
  pessoasPorId: ReadonlyMap<string, PessoaSupabaseReadModel>,
  membrosRows: MembroFamiliarSupabaseRow[],
  assistidosRows: AssistidoSupabaseRow[],
  observacoesRows: ObservacaoSocialSupabaseRow[],
): FamiliaSupabaseReadModel {
  const assistidos = assistidosRows.map((row) =>
    mapAssistido(row, requirePessoa(pessoasPorId, row.pessoa_id, "assistido")),
  );

  const assistidosPorMembro = new Map<string, AssistidoSupabaseReadModel[]>();
  for (const assistido of assistidos) {
    const atuais = assistidosPorMembro.get(assistido.membroFamiliarId) ?? [];
    atuais.push(assistido);
    assistidosPorMembro.set(assistido.membroFamiliarId, atuais);
  }

  const membros = membrosRows.map((row) =>
    mapMembro(
      row,
      requirePessoa(pessoasPorId, row.pessoa_id, "membro"),
      assistidosPorMembro.get(row.id) ?? [],
    ),
  );

  const responsavelPrincipal =
    membros.find((membro) => membro.responsavelPrincipal && membro.status === "ativo") ?? null;

  const observacoes = observacoesRows
    .map(mapObservacao)
    .sort((a, b) => b.data.localeCompare(a.data));

  return {
    id: familia.id,
    nome: familia.nome_referencia ?? "",
    responsavel: responsavelPrincipal?.nome ?? "",
    documento: responsavelPrincipal?.documento ?? "",
    telefone: responsavelPrincipal?.telefone ?? "",
    bairro: familia.bairro ?? "",
    endereco: optionalText(familia.endereco),
    numero: optionalText(familia.numero),
    complemento: optionalText(familia.complemento),
    cidade: optionalText(familia.cidade),
    uf: optionalText(familia.uf),
    cep: optionalText(familia.cep),
    status: familia.status,
    acompanhamento: familia.acompanhamento,
    responsavelPrincipal,
    membros,
    assistidos,
    observacoes,
    criadoEm: familia.criado_em,
    atualizadoEm: familia.atualizado_em,
  };
}

export function mapFamiliaFromSupabase(
  aggregate: FamiliaSupabaseAggregateRows,
): FamiliaSupabaseReadModel {
  const pessoasPorId = new Map(
    aggregate.pessoas.map((row) => {
      const pessoa = mapPessoa(row);
      return [pessoa.id, pessoa] as const;
    }),
  );

  return mapFamilia(
    aggregate.familia,
    pessoasPorId,
    aggregate.membros,
    aggregate.assistidos,
    aggregate.observacoes,
  );
}

export function mapFamiliasFromSupabase(
  familias: FamiliaSupabaseRow[],
  pessoas: PessoaSupabaseRow[],
  membros: MembroFamiliarSupabaseRow[],
  assistidos: AssistidoSupabaseRow[],
  observacoes: ObservacaoSocialSupabaseRow[],
): FamiliaSupabaseReadModel[] {
  const pessoasPorId = new Map(
    pessoas.map((row) => {
      const pessoa = mapPessoa(row);
      return [pessoa.id, pessoa] as const;
    }),
  );

  return familias.map((familia) =>
    mapFamilia(
      familia,
      pessoasPorId,
      membros.filter((membro) => membro.familia_id === familia.id),
      assistidos.filter((assistido) => assistido.familia_id === familia.id),
      observacoes.filter((observacao) => observacao.familia_id === familia.id),
    ),
  );
}
