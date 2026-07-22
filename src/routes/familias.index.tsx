import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Eye,
  ArrowRight,
  AlertTriangle,
  MessageSquare,
  X,
  LoaderCircle,
} from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useParametros } from "@/lib/config-store";
import type { Familia, TipoCadastro } from "@/lib/familias-store";
import { useFamilias } from "@/lib/familias-store";
import type { FamiliaSupabaseReadModel } from "@/lib/familias/familias-supabase-types";
import { useFamiliasSupabase } from "@/lib/familias/use-familias-supabase";
import { NovaFamiliaDialog } from "@/components/nova-familia-dialog";

export const Route = createFileRoute("/familias/")({
  head: () => ({ meta: [{ title: "Famílias — SEAC Social" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    foco: (search.foco as "avaliar" | "contato90" | undefined) ?? undefined,
  }),
  component: FamiliasPage,
});

type FamiliaListaBase = {
  nome: string;
  responsavel: string;
  documento: string;
  telefone: string;
  bairro: string;
  tipoCadastro: TipoCadastro | "misto" | null;
  progressoExtra: string | null;
  ultimaRetirada: string | null;
  acompanhamento: Familia["acompanhamento"];
  status: Familia["status"];
};

type FamiliaListaLocal = FamiliaListaBase & {
  origem: "local";
  id: number;
};

type FamiliaListaSupabase = FamiliaListaBase & {
  origem: "supabase";
  id: string;
};

type FamiliaListaItem = FamiliaListaLocal | FamiliaListaSupabase;

function mapFamiliaLocalParaLista(familia: Familia): FamiliaListaLocal {
  return {
    origem: "local",
    id: familia.id,
    nome: familia.nome,
    responsavel: familia.responsavel,
    documento: familia.documento,
    telefone: familia.telefone,
    bairro: familia.bairro,
    tipoCadastro: familia.tipoCadastro,
    progressoExtra: familia.progressoExtra,
    ultimaRetirada: familia.ultimaRetirada,
    acompanhamento: familia.acompanhamento,
    status: familia.status,
  };
}

function resumirTipoCadastroSupabase(
  familia: FamiliaSupabaseReadModel,
): FamiliaListaSupabase["tipoCadastro"] {
  const tiposAtivos = new Set(
    familia.assistidos
      .filter((assistido) => assistido.status !== "inativo")
      .map((assistido) => assistido.tipoCadastro),
  );

  if (tiposAtivos.has("definitivo") && tiposAtivos.has("extra")) return "misto";
  if (tiposAtivos.has("definitivo")) return "definitivo";
  if (tiposAtivos.has("extra")) return "extra";
  return null;
}

function mapFamiliaSupabaseParaLista(familia: FamiliaSupabaseReadModel): FamiliaListaSupabase {
  return {
    origem: "supabase",
    id: familia.id,
    nome: familia.nome,
    responsavel: familia.responsavel,
    documento: familia.documento,
    telefone: familia.telefone,
    bairro: familia.bairro,
    tipoCadastro: resumirTipoCadastroSupabase(familia),
    progressoExtra: null,
    ultimaRetirada: null,
    acompanhamento: familia.acompanhamento,
    status: familia.status,
  };
}

function FamiliasPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);
  const [cadastroMessage, setCadastroMessage] = useState<string | null>(null);
  const familiasLocais = useFamilias((s) => s.familias);
  const {
    data: familiasSupabase,
    isLoadingError: supabaseFalhaInicial,
    isRefetchError: supabaseFalhaAtualizacao,
    isPending: supabaseCarregando,
  } = useFamiliasSupabase();
  const temFamiliasSupabase = Boolean(familiasSupabase?.length);
  const usandoSupabase = temFamiliasSupabase && !supabaseFalhaInicial;
  const todasFamilias: FamiliaListaItem[] = usandoSupabase
    ? (familiasSupabase ?? []).map(mapFamiliaSupabaseParaLista)
    : familiasLocais.map(mapFamiliaLocalParaLista);
  const { foco } = Route.useSearch();
  const exemploFamilias =
    foco === "avaliar"
      ? todasFamilias.filter(
          (f) =>
            f.status === "avaliar" || (f.tipoCadastro === "extra" && f.progressoExtra === "3/3"),
        )
      : foco === "contato90"
        ? todasFamilias.filter((f) => f.acompanhamento === "sem_retirada_90")
        : todasFamilias;
  const selected =
    exemploFamilias.find(
      (familia): familia is FamiliaListaLocal =>
        familia.origem === "local" && familia.id === selectedId,
    ) ?? null;
  const params = useParametros((s) => s.params);
  const toggleSelect = (id: number) => setSelectedId((cur) => (cur === id ? null : id));

  const total = todasFamilias.length;
  const definitivos = todasFamilias.filter(
    (f) => f.tipoCadastro === "definitivo" || f.tipoCadastro === "misto",
  ).length;
  const extras = todasFamilias.filter(
    (f) => f.tipoCadastro === "extra" || f.tipoCadastro === "misto",
  ).length;
  const aguardandoAvaliacao = todasFamilias.filter((f) => f.status === "avaliar").length;
  const semRetirada90 = todasFamilias.filter((f) => f.acompanhamento === "sem_retirada_90").length;
  const bloqueadasInativas = todasFamilias.filter(
    (f) => f.status === "bloqueado" || f.status === "inativo",
  ).length;

  return (
    <AppShell
      title="Famílias"
      breadcrumbs={
        <span className="text-sm text-muted-foreground">
          Gerencie e acompanhe as famílias cadastradas no SEAC Social
        </span>
      }
      actions={
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setCadastroMessage(null);
            setNovaOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nova família
        </Button>
      }
    >
      <NovaFamiliaDialog
        open={novaOpen}
        onOpenChange={setNovaOpen}
        onCreated={({ origem, nome }) =>
          setCadastroMessage(
            origem === "supabase"
              ? `${nome} foi cadastrada no Supabase.`
              : `${nome} foi salva somente neste navegador.`,
          )
        }
        destinoInicial="supabase"
        fonteLista={usandoSupabase ? "supabase" : "local"}
      />
      <FonteDadosNotice
        carregando={supabaseCarregando}
        falhaInicial={supabaseFalhaInicial}
        falhaAtualizacao={supabaseFalhaAtualizacao}
        usandoSupabase={usandoSupabase}
      />
      {cadastroMessage && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground"
        >
          <span>{cadastroMessage}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-2"
            onClick={() => setCadastroMessage(null)}
          >
            Fechar
          </Button>
        </div>
      )}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard value={String(total)} label="Total de famílias" />
        <SummaryCard value={String(definitivos)} label="Cadastros definitivos" />
        <SummaryCard
          value={String(extras)}
          label="Cadastros em avaliação"
          className="border-l-secondary"
        />
        <SummaryCard
          value={String(aguardandoAvaliacao)}
          label="Aguardando avaliação definitiva"
          className="border-l-warning"
        />
        <SummaryCard
          value={String(semRetirada90)}
          label={`Contato necessário (${params.inatividadeContatoDias}+ dias)`}
          className="border-l-destructive"
        />
        <SummaryCard
          value={String(bloqueadasInativas)}
          label="Bloqueadas/inativas"
          className="border-l-destructive"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Acompanhamento é apenas informativo. Não bloqueia entregas, não torna a família inativa
        automaticamente e não gera tarefa de contato.
      </p>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-6">
          <Field label="Nome">
            <Input placeholder="Buscar por nome" />
          </Field>
          <Field label="CPF / RG">
            <Input placeholder="Buscar por CPF ou RG" />
          </Field>
          <Field label="Telefone">
            <Input placeholder="(00) 00000-0000" />
          </Field>
          <Field label="Bairro">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm">
              Limpar
            </Button>
            <Button size="sm" className="gap-2">
              <Search className="h-4 w-4" /> Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          {selected && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
              <span className="text-sm text-foreground">
                Família selecionada: <span className="font-semibold">{selected.nome}</span>
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1" asChild>
                  <Link to="/familias/$id" params={{ id: String(selected.id) }}>
                    <Eye className="h-3.5 w-3.5" /> Ver detalhes
                  </Link>
                </Button>
                {selected.status === "inativo" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-muted-foreground"
                    disabled
                  >
                    <ArrowRight className="h-3.5 w-3.5" /> Ir para atendimento
                  </Button>
                ) : (
                  <Button size="sm" className="gap-1" asChild>
                    <Link to="/atendimento">
                      <ArrowRight className="h-3.5 w-3.5" /> Ir para atendimento
                    </Link>
                  </Button>
                )}
                {selected.progressoExtra === "3/3" && (
                  <Button variant="warning" size="sm" className="gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Avaliar cadastro definitivo
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" /> Registrar observação
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={() => setSelectedId(null)}
                >
                  <X className="h-3.5 w-3.5" /> Limpar
                </Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Nome da família</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="whitespace-nowrap">CPF / RG</TableHead>
                  <TableHead className="whitespace-nowrap">Telefone</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Tipo de cadastro</TableHead>
                  <TableHead>Progresso Extra</TableHead>
                  <TableHead>Acompanhamento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exemploFamilias.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-16 text-center text-sm text-muted-foreground"
                    >
                      {usandoSupabase ? (
                        "Nenhuma família do Supabase corresponde ao filtro atual."
                      ) : (
                        <>
                          Nenhuma família cadastrada ainda.
                          <br />
                          <Link
                            to="/familias/$id"
                            params={{ id: "exemplo" }}
                            className="mt-2 inline-block text-primary hover:underline"
                          >
                            Ver exemplo de detalhe →
                          </Link>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  exemploFamilias.map((familia) => {
                    const isSelected = familia.origem === "local" && selectedId === familia.id;
                    return (
                      <TableRow
                        key={`${familia.origem}-${familia.id}`}
                        className={cn(isSelected && "bg-muted/40")}
                      >
                        <TableCell className="w-10">
                          <Checkbox
                            checked={isSelected}
                            disabled={familia.origem === "supabase"}
                            onCheckedChange={() => {
                              if (familia.origem === "local") toggleSelect(familia.id);
                            }}
                            aria-label={`Selecionar ${familia.nome}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {familia.origem === "local" ? (
                            <Link
                              to="/familias/$id"
                              params={{ id: String(familia.id) }}
                              className="text-foreground hover:underline"
                            >
                              {familia.nome}
                            </Link>
                          ) : (
                            <div className="flex flex-col">
                              <span>{familia.nome || "Família sem nome de referência"}</span>
                              <span className="text-[11px] font-normal text-muted-foreground">
                                Ações remotas desta lista ainda não integradas
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{familia.responsavel || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {familia.documento || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {familia.telefone || "—"}
                        </TableCell>
                        <TableCell>{familia.bairro || "—"}</TableCell>
                        <TableCell>
                          {familia.tipoCadastro === "definitivo" ? (
                            <Badge>Definitivo</Badge>
                          ) : familia.tipoCadastro === "extra" ? (
                            <Badge variant="warning">Avaliação</Badge>
                          ) : familia.tipoCadastro === "misto" ? (
                            <div className="flex flex-wrap gap-1">
                              <Badge>Definitivo</Badge>
                              <Badge variant="warning">Avaliação</Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {familia.status === "inativo" ? (
                            <span className="text-muted-foreground">—</span>
                          ) : familia.tipoCadastro === "definitivo" ||
                            familia.tipoCadastro === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : familia.origem === "supabase" ? (
                            <span className="text-muted-foreground">Não disponível</span>
                          ) : (
                            <span
                              className={
                                familia.progressoExtra === "3/3"
                                  ? "text-warning font-medium"
                                  : "text-foreground font-medium"
                              }
                            >
                              {familia.progressoExtra}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <AcompanhamentoBadge status={familia.acompanhamento} params={params} />
                            {familia.ultimaRetirada && familia.ultimaRetirada !== "—" && (
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                Última retirada: {familia.ultimaRetirada}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {familia.status === "liberado" && <Badge>Liberado</Badge>}
                          {familia.status === "bloqueado" && (
                            <Badge variant="destructive">Bloqueado</Badge>
                          )}
                          {familia.status === "inativo" && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Inativo
                            </Badge>
                          )}
                          {familia.status === "avaliar" && (
                            <Badge variant="warning" className="gap-1">
                              <AlertTriangle className="h-3 w-3" /> Avaliar definitivo
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function FonteDadosNotice({
  carregando,
  falhaInicial,
  falhaAtualizacao,
  usandoSupabase,
}: {
  carregando: boolean;
  falhaInicial: boolean;
  falhaAtualizacao: boolean;
  usandoSupabase: boolean;
}) {
  let mensagem =
    "Nenhuma família foi retornada pelo Supabase. Exibindo os dados locais temporariamente; novos cadastros usam o Supabase por padrão.";

  if (carregando) {
    mensagem =
      "Consultando o Supabase. Os dados locais permanecem visíveis durante o carregamento.";
  } else if (falhaAtualizacao && usandoSupabase) {
    mensagem =
      "Não foi possível atualizar o Supabase. Mantendo os últimos dados remotos carregados.";
  } else if (falhaAtualizacao) {
    mensagem =
      "Não foi possível atualizar o Supabase. Exibindo os dados locais até a próxima consulta.";
  } else if (falhaInicial) {
    mensagem =
      "Não foi possível consultar o Supabase. Exibindo os dados locais; o cadastro local permanece uma opção explícita e separada.";
  } else if (usandoSupabase) {
    mensagem =
      "Exibindo famílias do Supabase. O cadastro remoto é o padrão e o modo local permanece separado.";
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground",
        (falhaInicial || falhaAtualizacao) && "border-warning/40 bg-warning/5 text-foreground",
      )}
    >
      {carregando && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {(falhaInicial || falhaAtualizacao) && !carregando && (
        <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
      )}
      <span>{mensagem}</span>
    </div>
  );
}

function SummaryCard({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <Card className={cn("border-l-4 border-l-primary", className)}>
      <CardContent className="p-4">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function AcompanhamentoBadge({
  status,
  params,
}: {
  status: string;
  params: ReturnType<typeof useParametros.getState>["params"];
}) {
  if (status === "em_dia") return <Badge>Em dia</Badge>;
  if (status === "atencao_60" || status === "atencao_45")
    return <Badge variant="warning">Atenção {params.alertaLiberadoSemRetiradaDias} dias</Badge>;
  if (status === "sem_retirada_90")
    return (
      <Badge variant="destructive">
        Contato necessário ({params.inatividadeContatoDias}+ dias)
      </Badge>
    );
  if (status === "inativo")
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Inativo
      </Badge>
    );
  return <span className="text-muted-foreground">—</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
