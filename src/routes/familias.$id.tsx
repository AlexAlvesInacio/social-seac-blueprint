import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  HeartHandshake,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  UserCheck,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { calcularIdade, calcularFaixaEtaria, rotuloFaixaEtaria } from "@/lib/familias/faixa-etaria";
import { registrarAuditoria } from "@/lib/auditoria/auditoria-supabase";
import type {
  AssistidoSupabaseReadModel,
  FamiliaSupabaseReadModel,
  MembroFamiliarSupabaseReadModel,
} from "@/lib/familias/familias-supabase-types";
import {
  useEntregasFamilia,
  useFamiliaSupabase,
  useReativarAssistido,
  useTentativasFamilia,
} from "@/lib/familias/use-familias-supabase";
import { AdicionarAssistidoSupabaseDialog } from "@/components/adicionar-assistido-supabase-dialog";
import { AdicionarMembroSupabaseDialog } from "@/components/adicionar-membro-supabase-dialog";
import { EditarMembroSupabaseDialog } from "@/components/editar-membro-supabase-dialog";
import { EditarResponsavelSupabaseDialog } from "@/components/editar-responsavel-supabase-dialog";
import { EditarFamiliaSupabaseDialog } from "@/components/editar-familia-supabase-dialog";
import { RegistrarObservacaoSupabaseDialog } from "@/components/registrar-observacao-supabase-dialog";
import { RegistrarEntregaSupabaseDialog } from "@/components/registrar-entrega-supabase-dialog";

export const Route = createFileRoute("/familias/$id")({
  head: () => ({ meta: [{ title: "Detalhe da família — SEAC Social" }] }),
  component: FamiliaDetail,
});

const supabaseFamiliaIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function FamiliaDetail() {
  const { id } = Route.useParams();

  if (supabaseFamiliaIdPattern.test(id)) {
    return <FamiliaSupabaseDetail id={id} />;
  }

  return (
    <FamiliaDetailState
      message="Identificador de família inválido."
      description="O cadastro local (protótipo) foi desativado; as famílias agora vivem apenas no Supabase. Localize a família pela lista."
    />
  );
}

function FamiliaSupabaseDetail({ id }: { id: string }) {
  const { data: familia, isError, isFetching, isPending, refetch } = useFamiliaSupabase(id);

  if (isPending) {
    return <FamiliaDetailState loading message="Carregando família do Supabase..." />;
  }

  if (isError) {
    return (
      <FamiliaDetailState
        message="Não foi possível carregar a família do Supabase."
        description="Verifique a conexão e tente novamente. Nenhum dado local foi usado para este UUID."
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  }

  if (!familia) {
    return <FamiliaDetailState message="Família não encontrada ou sem permissão." />;
  }

  return <FamiliaSupabaseReadOnly familia={familia} />;
}

function FamiliaSupabaseReadOnly({ familia }: { familia: FamiliaSupabaseReadModel }) {
  const contagens = calcularContagensFamiliaSupabase(familia);
  // Resolve o nome de quem a observação cita. Inclui membros inativos: uma
  // observação antiga sobre alguém que saiu da família não pode virar "Toda a
  // família" só porque o vínculo foi encerrado.
  const nomePorPessoaId = useMemo(
    () => new Map(familia.membros.map((m) => [m.pessoaId, m.nome])),
    [familia.membros],
  );
  const statusLabel = rotuloStatusFamiliaSupabase(familia.status);
  const endereco = [familia.endereco, familia.numero, familia.complemento]
    .filter(Boolean)
    .join(", ");
  const [assistidoOpen, setAssistidoOpen] = useState(false);
  const [membroOpen, setMembroOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [responsavelOpen, setResponsavelOpen] = useState(false);
  const [obsOpen, setObsOpen] = useState(false);
  const [entregaAssistido, setEntregaAssistido] = useState<AssistidoSupabaseReadModel | null>(null);
  const [membroEditar, setMembroEditar] = useState<MembroFamiliarSupabaseReadModel | null>(null);
  const reativarAssistido = useReativarAssistido();

  const handleReativar = async (assistido: AssistidoSupabaseReadModel) => {
    try {
      await reativarAssistido.mutateAsync({ assistidoId: assistido.id, familiaId: familia.id });
      registrarAuditoria({
        acao: "Assistido reativado",
        modulo: "Famílias",
        registro: `${assistido.nome} (${assistido.documento})`,
        observacao: "Reativação de assistido inativo.",
      });
      toast.success("Assistido reativado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível reativar o assistido.");
    }
  };

  return (
    <AppShell
      title="Detalhe da família"
      breadcrumbs={
        <div className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
          <ChevronRight className="h-3 w-3" />
          <Link to="/familias" search={{ foco: undefined }} className="hover:text-foreground">
            Famílias
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{familia.nome || "Família"}</span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setEditarOpen(true)}>
            <Pencil className="h-4 w-4" /> Editar família
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => setResponsavelOpen(true)}
          >
            <Pencil className="h-4 w-4" /> Editar responsável
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setAssistidoOpen(true)}>
            <Plus className="h-4 w-4" /> Adicionar assistido
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setMembroOpen(true)}>
            <Plus className="h-4 w-4" /> Adicionar membro
          </Button>
          <Button asChild size="sm" variant="ghost" className="gap-2">
            <Link to="/familias" search={{ foco: undefined }}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
        </div>
      }
    >
      <AdicionarAssistidoSupabaseDialog
        open={assistidoOpen}
        onOpenChange={setAssistidoOpen}
        familiaId={familia.id}
        familiaNome={familia.nome || "família"}
      />
      <AdicionarMembroSupabaseDialog
        open={membroOpen}
        onOpenChange={setMembroOpen}
        familiaId={familia.id}
        familiaNome={familia.nome || "família"}
      />
      <EditarFamiliaSupabaseDialog
        open={editarOpen}
        onOpenChange={setEditarOpen}
        familia={familia}
      />
      <EditarResponsavelSupabaseDialog
        open={responsavelOpen}
        onOpenChange={setResponsavelOpen}
        familia={familia}
      />
      <RegistrarObservacaoSupabaseDialog
        open={obsOpen}
        onOpenChange={setObsOpen}
        familiaId={familia.id}
        familiaNome={familia.nome || "família"}
        membros={familia.membros
          .filter((m) => m.status === "ativo")
          .map((m) => ({ pessoaId: m.pessoaId, nome: m.nome }))}
      />
      <RegistrarEntregaSupabaseDialog
        open={entregaAssistido !== null}
        onOpenChange={(o) => {
          if (!o) setEntregaAssistido(null);
        }}
        assistido={entregaAssistido}
        familiaNome={familia.nome || "família"}
      />
      <EditarMembroSupabaseDialog
        open={membroEditar !== null}
        onOpenChange={(o) => {
          if (!o) setMembroEditar(null);
        }}
        membro={membroEditar}
      />
      <div className="space-y-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">
                Dados do Supabase — edição de família, assistidos, membros e observações
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Já é possível editar a família e o responsável, adicionar/editar assistidos e
                membros, registrar observações, atender (registrar entrega) e consultar o histórico
                de entregas e tentativas bloqueadas.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">{familia.nome || "Família sem nome"}</h2>
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                    {statusLabel}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <Info label="Responsável" value={familia.responsavel || "—"} />
                  <Info label="CPF / RG" value={familia.documento || "—"} />
                  <Info label="Endereço" value={endereco || "—"} />
                  <Info label="Bairro" value={familia.bairro || "—"} />
                  <Info label="Cidade" value={familia.cidade || "—"} />
                  <Info label="UF" value={familia.uf || "—"} />
                  <Info label="CEP" value={familia.cep || "—"} />
                  <Info label="Telefone / WhatsApp" value={familia.telefone || "—"} />
                  <Info label="Moradores" value={String(contagens.moradores)} />
                  <Info label="Crianças" value={String(contagens.criancas)} />
                  <Info label="Adolescentes" value={String(contagens.adolescentes)} />
                  <Info label="Adultos" value={String(contagens.adultos)} />
                  <Info label="Idosos" value={String(contagens.idosos)} />
                  <Info label="Gestantes" value={String(contagens.gestantes)} />
                  <Info label="PCD" value={String(contagens.pcd)} />
                  <Info
                    label="Acompanhamento"
                    value={rotuloAcompanhamentoSupabase(familia.acompanhamento)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9">
          <SummaryCard label="Moradores" value={String(contagens.moradores)} />
          <SummaryCard label="Assistidos" value={String(contagens.assistidosAtivos)} />
          <SummaryCard label="Crianças" value={String(contagens.criancas)} />
          <SummaryCard label="Adolescentes" value={String(contagens.adolescentes)} />
          <SummaryCard label="Adultos" value={String(contagens.adultos)} />
          <SummaryCard label="Idosos" value={String(contagens.idosos)} />
          <SummaryCard label="Gestantes" value={String(contagens.gestantes)} />
          <SummaryCard label="PCD" value={String(contagens.pcd)} />
          <SummaryCard
            label="Acompanhamento"
            value={rotuloAcompanhamentoSupabase(familia.acompanhamento)}
            tone={familia.acompanhamento === "em_dia" ? "success" : undefined}
          />
        </div>

        <Tabs defaultValue="assistidos">
          <TabsList>
            <TabsTrigger value="assistidos">Assistidos vinculados</TabsTrigger>
            <TabsTrigger value="membros">Membros vinculados</TabsTrigger>
            <TabsTrigger value="entregas">Histórico de entregas</TabsTrigger>
            <TabsTrigger value="bloqueios">Tentativas bloqueadas</TabsTrigger>
            <TabsTrigger value="observacoes">Observações sociais</TabsTrigger>
          </TabsList>

          <TabsContent value="assistidos">
            <Card>
              {familia.assistidos.length === 0 ? (
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum assistido vinculado.
                </CardContent>
              ) : (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF/RG</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Benefício</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>PCD</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {familia.assistidos.map((assistido) => (
                        <TableRow key={assistido.id}>
                          <TableCell className="text-sm">{assistido.nome}</TableCell>
                          <TableCell className="text-sm">{assistido.documento}</TableCell>
                          <TableCell className="text-sm">
                            {assistido.tipoCadastro === "definitivo" ? "Definitivo" : "Extra"}
                          </TableCell>
                          <TableCell className="text-sm">{assistido.beneficio || "—"}</TableCell>
                          <TableCell className="text-sm capitalize">{assistido.status}</TableCell>
                          <TableCell className="text-sm">{assistido.pcd ? "Sim" : "Não"}</TableCell>
                          <TableCell className="text-right">
                            {assistido.status === "inativo" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                                disabled={reativarAssistido.isPending}
                                onClick={() => void handleReativar(assistido)}
                              >
                                <UserCheck className="h-4 w-4" /> Reativar
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                                disabled={assistido.status !== "ativo"}
                                onClick={() => setEntregaAssistido(assistido)}
                              >
                                <HeartHandshake className="h-4 w-4" /> Registrar entrega
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="membros">
            <Card>
              {familia.membros.length === 0 ? (
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum membro vinculado.
                </CardContent>
              ) : (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Parentesco</TableHead>
                        <TableHead>Doc.</TableHead>
                        <TableHead>Faixa etária</TableHead>
                        <TableHead>Marcadores</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {familia.membros.map((membro) => {
                        const idade = calcularIdade(membro.nascimento);
                        const faixa = calcularFaixaEtaria(membro.nascimento);

                        return (
                          <TableRow key={membro.id}>
                            <TableCell className="text-sm">{membro.nome}</TableCell>
                            <TableCell className="text-sm">{membro.parentesco}</TableCell>
                            <TableCell className="text-sm">{membro.documento || "—"}</TableCell>
                            <TableCell className="text-sm">
                              {faixa
                                ? `${rotuloFaixaEtaria(faixa)}${idade !== null ? ` (${idade})` : ""}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {[
                                membro.responsavelPrincipal && "Responsável principal",
                                membro.gestante && "Gestante",
                                membro.pcd && "PCD",
                              ]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </TableCell>
                            <TableCell className="text-sm capitalize">{membro.status}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                                onClick={() => setMembroEditar(membro)}
                              >
                                <Pencil className="h-4 w-4" /> Editar
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="entregas">
            <EntregasFamiliaTab familiaId={familia.id} />
          </TabsContent>

          <TabsContent value="bloqueios">
            <TentativasFamiliaTab familiaId={familia.id} />
          </TabsContent>

          <TabsContent value="observacoes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Observações sociais</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setObsOpen(true)}
                >
                  <Plus className="h-4 w-4" /> Registrar observação
                </Button>
              </CardHeader>
              {familia.observacoes.length === 0 ? (
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma observação social registrada.
                </CardContent>
              ) : (
                <CardContent className="space-y-3">
                  {familia.observacoes.map((observacao) => (
                    <div key={observacao.id} className="rounded-md border p-3">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{observacao.tipo}</Badge>
                          <Badge variant="secondary">
                            {nomePorPessoaId.get(observacao.pessoaId ?? "") ?? "Toda a família"}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatarDataHora(observacao.data)} · Autor {observacao.usuario}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{observacao.texto}</p>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function FamiliaDetailState({
  description,
  loading = false,
  message,
  onRetry,
  retrying = false,
}: {
  description?: string;
  loading?: boolean;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <AppShell
      title="Detalhe da família"
      actions={
        <Button asChild size="sm" variant="ghost" className="gap-2">
          <Link to="/familias" search={{ foco: undefined }}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
      }
    >
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          {loading ? (
            <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          ) : onRetry ? (
            <AlertTriangle className="h-5 w-5 text-warning" />
          ) : null}
          <p className="text-sm text-muted-foreground">{message}</p>
          {description ? (
            <p className="max-w-xl text-xs text-muted-foreground">{description}</p>
          ) : null}
          {onRetry ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={retrying}
              onClick={onRetry}
            >
              <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Tentando novamente..." : "Tentar novamente"}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function EntregasFamiliaTab({ familiaId }: { familiaId: string }) {
  const { data, isPending, isError, isFetching, refetch } = useEntregasFamilia(familiaId);

  if (isPending) return <HistoricoEstado loading message="Carregando histórico de entregas..." />;
  if (isError) {
    return (
      <HistoricoEstado
        message="Não foi possível carregar o histórico de entregas."
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  }

  const entregas = data ?? [];
  if (entregas.length === 0) return <HistoricoEstado message="Nenhuma entrega registrada." />;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data / hora</TableHead>
              <TableHead>Assistido</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Benefício</TableHead>
              <TableHead>Tipo de entrega</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entregas.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-sm">{formatarDataHora(e.criadoEm)}</TableCell>
                <TableCell className="text-sm">{e.assistidoNome}</TableCell>
                <TableCell className="text-sm">{e.documento ?? "—"}</TableCell>
                <TableCell className="text-sm">{e.beneficioNome}</TableCell>
                <TableCell className="text-sm">
                  {e.excepcional ? "Excepcional" : "Padrão"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {e.observacao || "—"}
                </TableCell>
                <TableCell className="text-sm">
                  <Badge variant="outline" className="text-[10px]">
                    Entregue
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TentativasFamiliaTab({ familiaId }: { familiaId: string }) {
  const { data, isPending, isError, isFetching, refetch } = useTentativasFamilia(familiaId);

  if (isPending) return <HistoricoEstado loading message="Carregando tentativas bloqueadas..." />;
  if (isError) {
    return (
      <HistoricoEstado
        message="Não foi possível carregar as tentativas bloqueadas."
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  }

  const tentativas = data ?? [];
  if (tentativas.length === 0) return <HistoricoEstado message="Nenhuma tentativa bloqueada." />;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data / hora</TableHead>
              <TableHead>Assistido</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Benefício</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Observação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tentativas.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-sm">{formatarDataHora(t.criadoEm)}</TableCell>
                <TableCell className="text-sm">{t.assistidoNome}</TableCell>
                <TableCell className="text-sm">{t.documento ?? "—"}</TableCell>
                <TableCell className="text-sm">{t.beneficioNome}</TableCell>
                <TableCell className="text-sm">
                  <Badge variant="outline" className="text-[10px]">
                    {t.motivo === "prazo"
                      ? "Prazo (25 dias)"
                      : t.motivo === "estoque"
                        ? "Estoque"
                        : "Extra completou"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.observacao || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function HistoricoEstado({
  loading = false,
  message,
  onRetry,
  retrying = false,
}: {
  loading?: boolean;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        {loading ? (
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
        ) : onRetry ? (
          <AlertTriangle className="h-5 w-5 text-warning" />
        ) : null}
        <p className="text-sm text-muted-foreground">{message}</p>
        {onRetry ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={retrying}
            onClick={onRetry}
          >
            <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "Tentando novamente..." : "Tentar novamente"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function calcularContagensFamiliaSupabase(familia: FamiliaSupabaseReadModel) {
  const membrosAtivosPorPessoa = new Map(
    familia.membros
      .filter((membro) => membro.status === "ativo")
      .map((membro) => [membro.pessoaId, membro] as const),
  );
  const membrosAtivos = [...membrosAtivosPorPessoa.values()];
  const assistidosAtivos = new Set(
    familia.assistidos
      .filter((assistido) => assistido.status === "ativo")
      .map((assistido) => assistido.pessoaId),
  ).size;
  let criancas = 0;
  let adolescentes = 0;
  let adultos = 0;
  let idosos = 0;
  let gestantes = 0;
  let pcd = 0;

  for (const membro of membrosAtivos) {
    const faixa = calcularFaixaEtaria(membro.nascimento);

    if (faixa === "crianca") criancas += 1;
    else if (faixa === "adolescente") adolescentes += 1;
    else if (faixa === "adulto") adultos += 1;
    else if (faixa === "idoso") idosos += 1;

    if (membro.gestante) gestantes += 1;
    if (membro.pcd) pcd += 1;
  }

  return {
    moradores: membrosAtivos.length,
    assistidosAtivos,
    criancas,
    adolescentes,
    adultos,
    idosos,
    gestantes,
    pcd,
  };
}

function rotuloStatusFamiliaSupabase(status: FamiliaSupabaseReadModel["status"]) {
  if (status === "liberado") return "Ativa";
  if (status === "bloqueado") return "Bloqueada";
  if (status === "inativo") return "Inativa";
  return "Em avaliação";
}

function rotuloAcompanhamentoSupabase(acompanhamento: FamiliaSupabaseReadModel["acompanhamento"]) {
  if (acompanhamento === "em_dia") return "Em dia";
  if (acompanhamento === "atencao_45") return "Atenção (45 dias)";
  if (acompanhamento === "atencao_60") return "Atenção (60 dias)";
  if (acompanhamento === "sem_retirada_90") return "Contato necessário (90+ dias)";
  return "Inativo";
}

function formatarDataHora(value: string) {
  const data = new Date(value);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleString("pt-BR");
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-lg font-semibold ${tone === "success" ? "text-primary" : "text-foreground"}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
