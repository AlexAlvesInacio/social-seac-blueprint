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
import { useMemo, useState } from "react";
import {
  atendeAosFiltros,
  calcularPaginacao,
  FILTROS_VAZIOS,
  POR_PAGINA,
  type FamiliaListaItem,
} from "@/lib/familias/filtro-lista";
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
import {
  CONFIGURACOES_PADRAO,
  useConfiguracoes,
  type Configuracoes,
} from "@/lib/configuracoes/configuracoes-supabase";
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

function resumirTipoCadastro(familia: FamiliaSupabaseReadModel): FamiliaListaItem["tipoCadastro"] {
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

function mapFamiliaParaLista(familia: FamiliaSupabaseReadModel): FamiliaListaItem {
  return {
    id: familia.id,
    nome: familia.nome,
    responsavel: familia.responsavel,
    documento: familia.documento,
    telefone: familia.telefone,
    bairro: familia.bairro,
    tipoCadastro: resumirTipoCadastro(familia),
    acompanhamento: familia.acompanhamento,
    status: familia.status,
  };
}

function FamiliasPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);
  const [cadastroMessage, setCadastroMessage] = useState<string | null>(null);
  const {
    data: familiasSupabase,
    isLoadingError: falhaInicial,
    isRefetchError: falhaAtualizacao,
    isPending: carregando,
  } = useFamiliasSupabase();
  const todasFamilias: FamiliaListaItem[] = (familiasSupabase ?? []).map(mapFamiliaParaLista);
  const { foco } = Route.useSearch();
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [pagina, setPagina] = useState(1);
  const filtrarPor = (campo: keyof typeof FILTROS_VAZIOS) => (valor: string) => {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
    setPagina(1);
  };

  // Bairros vêm dos próprios dados: a planilha importada não trouxe endereço,
  // então hoje a lista fica vazia e o seletor mostra só "Todos".
  const bairros = useMemo(
    () => [...new Set(todasFamilias.map((f) => f.bairro).filter(Boolean))].sort(),
    [todasFamilias],
  );

  const porFoco =
    foco === "avaliar"
      ? todasFamilias.filter((f) => f.status === "avaliar")
      : foco === "contato90"
        ? todasFamilias.filter((f) => f.acompanhamento === "sem_retirada_90")
        : todasFamilias;

  const familiasFiltradas = useMemo(
    () => porFoco.filter((f) => atendeAosFiltros(f, filtros)),
    [porFoco, filtros],
  );

  const {
    paginaAtual,
    totalPaginas,
    primeiro: primeiroDaPagina,
  } = calcularPaginacao(familiasFiltradas.length, pagina);
  const familiasDaPagina = useMemo(
    () => familiasFiltradas.slice(primeiroDaPagina, primeiroDaPagina + POR_PAGINA),
    [familiasFiltradas, primeiroDaPagina],
  );
  const selected = familiasFiltradas.find((familia) => familia.id === selectedId) ?? null;
  const { data: configData } = useConfiguracoes();
  const params = configData ?? CONFIGURACOES_PADRAO;
  const toggleSelect = (id: string) => setSelectedId((cur) => (cur === id ? null : id));

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
        onCreated={({ nome }) => setCadastroMessage(`${nome} foi cadastrada com sucesso.`)}
      />
      <FonteDadosNotice
        carregando={carregando}
        falhaInicial={falhaInicial}
        falhaAtualizacao={falhaAtualizacao}
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
            <Input
              placeholder="Buscar por nome"
              value={filtros.nome}
              onChange={(e) => filtrarPor("nome")(e.target.value)}
            />
          </Field>
          <Field label="CPF / RG">
            <Input
              placeholder="Buscar por CPF ou RG"
              value={filtros.documento}
              onChange={(e) => filtrarPor("documento")(e.target.value)}
            />
          </Field>
          <Field label="Telefone">
            <Input
              placeholder="(00) 00000-0000"
              value={filtros.telefone}
              onChange={(e) => filtrarPor("telefone")(e.target.value)}
            />
          </Field>
          <Field label="Bairro">
            <Select value={filtros.bairro} onValueChange={filtrarPor("bairro")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {bairros.map((bairro) => (
                  <SelectItem key={bairro} value={bairro}>
                    {bairro}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={filtros.status} onValueChange={filtrarPor("status")}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="liberado">Liberado</SelectItem>
                <SelectItem value="bloqueado">Bloqueado</SelectItem>
                <SelectItem value="avaliar">Avaliar</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-end justify-between gap-2">
            {/* A filtragem é imediata, então não há botão "Buscar": em vez de
                um botão que não faz nada, a contagem mostra o efeito. */}
            <span className="text-xs text-muted-foreground">
              <Search className="mr-1 inline h-3.5 w-3.5" />
              {familiasFiltradas.length === todasFamilias.length
                ? `${todasFamilias.length} famílias`
                : `${familiasFiltradas.length} de ${todasFamilias.length}`}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={JSON.stringify(filtros) === JSON.stringify(FILTROS_VAZIOS)}
              onClick={() => setFiltros(FILTROS_VAZIOS)}
            >
              Limpar
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
                  <Link to="/familias/$id" params={{ id: selected.id }}>
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
                    <Link to="/atendimento" search={{ assistido: undefined }}>
                      <ArrowRight className="h-3.5 w-3.5" /> Ir para atendimento
                    </Link>
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
                  <TableHead>Acompanhamento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {familiasFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="py-16 text-center text-sm text-muted-foreground"
                    >
                      {todasFamilias.length > 0
                        ? "Nenhuma família corresponde ao filtro atual."
                        : "Nenhuma família cadastrada ainda."}
                    </TableCell>
                  </TableRow>
                ) : (
                  familiasDaPagina.map((familia) => {
                    const isSelected = selectedId === familia.id;
                    return (
                      <TableRow key={familia.id} className={cn(isSelected && "bg-muted/40")}>
                        <TableCell className="w-10">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(familia.id)}
                            aria-label={`Selecionar ${familia.nome}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            to="/familias/$id"
                            params={{ id: familia.id }}
                            className="text-foreground hover:underline"
                          >
                            {familia.nome || "Família sem nome de referência"}
                          </Link>
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
                          <AcompanhamentoBadge status={familia.acompanhamento} params={params} />
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
            {familiasFiltradas.length > POR_PAGINA && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  Mostrando {primeiroDaPagina + 1}–
                  {Math.min(primeiroDaPagina + POR_PAGINA, familiasFiltradas.length)} de{" "}
                  {familiasFiltradas.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginaAtual === 1}
                    onClick={() => setPagina(paginaAtual - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {paginaAtual} de {totalPaginas}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginaAtual === totalPaginas}
                    onClick={() => setPagina(paginaAtual + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
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
}: {
  carregando: boolean;
  falhaInicial: boolean;
  falhaAtualizacao: boolean;
}) {
  if (!carregando && !falhaInicial && !falhaAtualizacao) return null;

  const mensagem = carregando
    ? "Carregando famílias do Supabase..."
    : falhaInicial
      ? "Não foi possível consultar o Supabase. Verifique a conexão e tente novamente."
      : "Não foi possível atualizar a lista. Mantendo os últimos dados carregados.";

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

function AcompanhamentoBadge({ status, params }: { status: string; params: Configuracoes }) {
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
