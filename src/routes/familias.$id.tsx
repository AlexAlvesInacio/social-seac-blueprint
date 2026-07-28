import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  HeartHandshake,
  LoaderCircle,
  LockKeyhole,
  MoreHorizontal,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useFamilias,
  calcularIdade,
  calcularFaixaEtaria,
  rotuloFaixaEtaria,
} from "@/lib/familias-store";
import { registrarAuditoria } from "@/lib/auditoria/auditoria-supabase";
import { useAtendimentoStore } from "@/lib/atendimento-store";
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
import {
  EditarFamiliaDialog,
  AdicionarAssistidoDialog,
  AdicionarMembroDialog,
  RegistrarObservacaoDialog,
} from "@/components/familia-detail-dialogs";
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

const localFamiliaIdPattern = /^\d+$/;
const supabaseFamiliaIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const legacyFamiliaDaSilvaRouteId = 1;
const familiaDaSilvaStoreId = 15;

function FamiliaDetail() {
  const { id } = Route.useParams();

  if (localFamiliaIdPattern.test(id)) {
    return <FamiliaLocalDetail id={id} />;
  }

  if (supabaseFamiliaIdPattern.test(id)) {
    return <FamiliaSupabaseDetail id={id} />;
  }

  return <FamiliaDetailState message="Identificador de família inválido." />;
}

function FamiliaLocalDetail({ id }: { id: string }) {
  const [localStoreHydrated, setLocalStoreHydrated] = useState(false);
  const localFamiliaId = Number(id);
  const familias = useFamilias((s) => s.familias);
  const allAssistidos = useFamilias((s) => s.assistidos);
  const allMembros = useFamilias((s) => s.membros);
  const allObs = useFamilias((s) => s.observacoes);
  const familia = useMemo(() => {
    const familiaById = familias.find((item) => item.id === localFamiliaId);

    if (familiaById) return familiaById;

    // O detalhe local original exibia a Família da Silva em /familias/1,
    // enquanto o seed atual identifica esse mesmo mock com o ID 15.
    if (localFamiliaId === legacyFamiliaDaSilvaRouteId) {
      return familias.find((item) => item.id === familiaDaSilvaStoreId);
    }

    return undefined;
  }, [familias, localFamiliaId]);
  const resolvedFamiliaId = familia?.id ?? localFamiliaId;
  const assistidos = useMemo(
    () => allAssistidos.filter((a) => a.familiaId === resolvedFamiliaId),
    [allAssistidos, resolvedFamiliaId],
  );
  const membros = useMemo(
    () => allMembros.filter((m) => m.familiaId === resolvedFamiliaId),
    [allMembros, resolvedFamiliaId],
  );
  const observacoes = useMemo(
    () => allObs.filter((o) => o.familiaId === resolvedFamiliaId),
    [allObs, resolvedFamiliaId],
  );
  const allEntregas = useAtendimentoStore((s) => s.entregas);
  const entregasFamilia = useMemo(
    () =>
      allEntregas
        .filter((e) => e.familiaId === resolvedFamiliaId)
        .sort((a, b) => b.dataISO.localeCompare(a.dataISO)),
    [allEntregas, resolvedFamiliaId],
  );
  const assistidosAtivos = useMemo(
    () => assistidos.filter((a) => a.status === "ativo"),
    [assistidos],
  );
  const navigate = useNavigate();
  const contagens = useMemo(() => {
    const assistidosAtivos = assistidos.filter((a) => a.status === "ativo");
    type Pessoa = { documento?: string; nascimento?: string; pcd?: boolean; gestante?: boolean };
    const pessoas: Pessoa[] = [
      {
        documento: familia?.documento,
        nascimento: undefined,
        pcd: false,
        gestante: false,
      },
      ...assistidosAtivos.map((a) => ({
        documento: a.documento,
        nascimento: a.nascimento,
        pcd: a.pcd,
        gestante: false,
      })),
      ...membros.map((m) => ({
        documento: m.documento,
        nascimento: m.nascimento,
        pcd: m.pcd,
        gestante: m.gestante,
      })),
    ];
    const vistos = new Set<string>();
    const unicos: Pessoa[] = [];
    for (const p of pessoas) {
      const chave = (p.documento ?? "").replace(/\D/g, "");
      if (chave) {
        if (vistos.has(chave)) continue;
        vistos.add(chave);
      }
      unicos.push(p);
    }
    let criancas = 0,
      adolescentes = 0,
      adultos = 0,
      idosos = 0,
      gestantes = 0,
      pcd = 0;
    for (const p of unicos) {
      const faixa = calcularFaixaEtaria(p.nascimento);
      if (faixa === "crianca") criancas++;
      else if (faixa === "adolescente") adolescentes++;
      else if (faixa === "adulto") adultos++;
      else if (faixa === "idoso") idosos++;
      if (p.gestante) gestantes++;
      if (p.pcd) pcd++;
    }
    return {
      moradores: unicos.length,
      assistidosAtivos: assistidosAtivos.length,
      membrosAtivos: membros.length,
      criancas,
      adolescentes,
      adultos,
      idosos,
      gestantes,
      pcd,
    };
  }, [assistidos, membros, familia?.documento]);
  const [openEditar, setOpenEditar] = useState(false);
  const [openAssistido, setOpenAssistido] = useState(false);
  const [openMembro, setOpenMembro] = useState(false);
  const [openObs, setOpenObs] = useState(false);
  const [openSelecionar, setOpenSelecionar] = useState(false);

  useEffect(() => {
    let active = true;
    const persistApi = useFamilias.persist;
    const finishHydration = () => {
      if (active) setLocalStoreHydrated(true);
    };

    if (!persistApi) {
      finishHydration();
      return () => {
        active = false;
      };
    }

    const unsubscribe = persistApi.onFinishHydration(finishHydration);

    if (persistApi.hasHydrated()) {
      finishHydration();
    } else {
      void Promise.resolve(persistApi.rehydrate()).then(finishHydration, finishHydration);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const irParaAtendimento = () => {
    if (!familia) return;
    if (assistidosAtivos.length === 0) {
      registrarAuditoria({
        usuario: "operador",
        acao: "Tentativa de atendimento sem assistido ativo",
        modulo: "Atendimento",
        registro: familia.nome,
      });
      toast.warning("Esta família ainda não possui assistido ativo para atendimento.", {
        action: { label: "Adicionar assistido", onClick: () => setOpenAssistido(true) },
      });
      return;
    }
    if (assistidosAtivos.length === 1) {
      const a = assistidosAtivos[0];
      registrarAuditoria({
        usuario: "operador",
        acao: "Atendimento aberto a partir da família",
        modulo: "Atendimento",
        registro: `${familia.nome} — ${a.nome}`,
      });
      navigate({ to: "/atendimento", search: { assistido: a.documento } });
      return;
    }
    setOpenSelecionar(true);
  };

  const selecionarAssistido = (docto: string, nome: string) => {
    if (!familia) return;
    registrarAuditoria({
      usuario: "operador",
      acao: "Assistido selecionado para atendimento",
      modulo: "Atendimento",
      registro: `${familia.nome} — ${nome}`,
    });
    setOpenSelecionar(false);
    navigate({ to: "/atendimento", search: { assistido: docto } });
  };

  if (!localStoreHydrated) {
    return <FamiliaDetailState loading message="Carregando dados locais..." />;
  }

  if (!familia) {
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
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Família não encontrada.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const alertaAvaliacao = false;
  const statusLabel =
    familia.status === "liberado"
      ? "Ativa"
      : familia.status === "bloqueado"
        ? "Bloqueada"
        : familia.status === "inativo"
          ? "Inativa"
          : "Em avaliação";

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
          <span className="text-foreground">{familia.nome}</span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost" className="gap-2">
            <Link to="/familias" search={{ foco: undefined }}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpenEditar(true)}>
            <Pencil className="h-4 w-4" /> Editar família
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => setOpenAssistido(true)}
          >
            <Plus className="h-4 w-4" /> Adicionar assistido
          </Button>
          <Button size="sm" className="gap-2" onClick={irParaAtendimento}>
            <HeartHandshake className="h-4 w-4" /> Ir para atendimento
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-2">
                <MoreHorizontal className="h-4 w-4" /> Mais ações
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2" onSelect={() => setOpenMembro(true)}>
                <Plus className="h-4 w-4" /> Adicionar membro familiar
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onSelect={() => setOpenObs(true)}>
                <ClipboardList className="h-4 w-4" /> Registrar observação
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <EditarFamiliaDialog open={openEditar} onOpenChange={setOpenEditar} familia={familia} />
      <AdicionarAssistidoDialog
        open={openAssistido}
        onOpenChange={setOpenAssistido}
        familia={familia}
      />
      <AdicionarMembroDialog open={openMembro} onOpenChange={setOpenMembro} familia={familia} />
      <RegistrarObservacaoDialog open={openObs} onOpenChange={setOpenObs} familia={familia} />
      <Dialog open={openSelecionar} onOpenChange={setOpenSelecionar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecionar assistido para atendimento</DialogTitle>
            <DialogDescription>
              Esta família tem mais de um assistido ativo. Escolha quem será atendido agora.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {assistidosAtivos.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => selecionarAssistido(a.documento, a.nome)}
                className="flex w-full flex-col gap-1 rounded-md border border-border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{a.nome}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {a.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.documento} · {a.tipoCadastro === "definitivo" ? "Definitivo" : "Avaliação"} ·{" "}
                  {a.beneficio}
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSelecionar(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">{familia.nome}</h2>
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                    {statusLabel}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <Info label="Responsável" value={familia.responsavel} />
                  <Info label="CPF / RG" value={familia.documento} />
                  <Info
                    label="Endereço"
                    value={[familia.endereco, familia.numero].filter(Boolean).join(", ") || "—"}
                  />
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
                    label="Tipo de cadastro"
                    value={familia.tipoCadastro === "definitivo" ? "Definitivo" : "Avaliação"}
                  />
                </div>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="text-sm">{familia.observacoes || "—"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {alertaAvaliacao && (
          <Card className="border-l-4 border-l-warning bg-warning/5">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
              <p className="text-sm text-foreground">
                Assistido completou 3 retiradas extras. Avaliar cadastro definitivo para liberar
                Cesta Padrão no próximo mês.
              </p>
            </CardContent>
          </Card>
        )}

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
            value={familia.acompanhamento === "em_dia" ? "Em dia" : "—"}
            tone="success"
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
              {assistidos.length === 0 ? (
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assistidos.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm">{a.nome}</TableCell>
                          <TableCell className="text-sm">{a.documento}</TableCell>
                          <TableCell className="text-sm">
                            {a.tipoCadastro === "definitivo" ? "Definitivo" : "Avaliação"}
                          </TableCell>
                          <TableCell className="text-sm">{a.beneficio}</TableCell>
                          <TableCell className="text-sm capitalize">{a.status}</TableCell>
                          <TableCell className="text-sm">{a.pcd ? "Sim" : "Não"}</TableCell>
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
              {membros.length === 0 ? (
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membros.map((m) => {
                        const idade = calcularIdade(m.nascimento);
                        const faixa = calcularFaixaEtaria(m.nascimento);
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-sm">{m.nome}</TableCell>
                            <TableCell className="text-sm">{m.parentesco}</TableCell>
                            <TableCell className="text-sm">{m.documento || "—"}</TableCell>
                            <TableCell className="text-sm">
                              {faixa
                                ? `${rotuloFaixaEtaria(faixa)}${idade !== null ? ` (${idade})` : ""}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {[m.gestante && "Gestante", m.pcd && "PCD"]
                                .filter(Boolean)
                                .join(" · ") || "—"}
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
            <Card>
              {entregasFamilia.length === 0 ? (
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma entrega registrada.
                </CardContent>
              ) : (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data / hora</TableHead>
                        <TableHead>Assistido</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Benefício</TableHead>
                        <TableHead>Tipo de entrega</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entregasFamilia.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm">
                            {new Date(e.dataISO).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-sm">{e.nome}</TableCell>
                          <TableCell className="text-sm">{e.documento}</TableCell>
                          <TableCell className="text-sm">
                            {e.beneficio}
                            {e.excepcional ? " (excepcional)" : ""}
                          </TableCell>
                          <TableCell className="text-sm">Retirada no local</TableCell>
                          <TableCell className="text-sm">{e.usuario}</TableCell>
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
              )}
            </Card>
          </TabsContent>

          <TabsContent value="bloqueios">
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma tentativa bloqueada.
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="observacoes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Observações sociais</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setOpenObs(true)}
                >
                  <Plus className="h-4 w-4" /> Nova observação
                </Button>
              </CardHeader>
              {observacoes.length === 0 ? (
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma observação social registrada.
                </CardContent>
              ) : (
                <CardContent className="space-y-3">
                  {observacoes.map((o) => (
                    <div key={o.id} className="rounded-md border p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <Badge variant="outline">{o.tipo}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(o.data).toLocaleString("pt-BR")} · {o.usuario}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{o.texto}</p>
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
                        <Badge variant="outline">{observacao.tipo}</Badge>
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
