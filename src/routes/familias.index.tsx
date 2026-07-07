import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, Eye, ArrowRight, AlertTriangle, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/familias/")({
  head: () => ({ meta: [{ title: "Famílias — SEAC Social" }] }),
  component: FamiliasPage,
});

const exemploFamilias = [
  {
    id: 15,
    nome: "Família da Silva",
    responsavel: "João da Silva",
    documento: "987.654.321-00",
    telefone: "(11) 97654-3210",
    bairro: "São João",
    tipoCadastro: "definitivo" as const,
    progressoExtra: null,
    ultimaRetirada: "16/05/2025",
    proximaData: "10/06/2025 (Faltam 18 dias)",
    acompanhamento: "em_dia" as const,
    status: "liberado" as const,
  },
  {
    id: 23,
    nome: "Família Santos",
    responsavel: "Maria Santos",
    documento: "321.654.987-00",
    telefone: "(11) 91234-5678",
    bairro: "Vila Nova",
    tipoCadastro: "extra" as const,
    progressoExtra: "2/3" as const,
    ultimaRetirada: "20/05/2025",
    proximaData: "13/06/2025 (Faltam 21 dias)",
    acompanhamento: "em_dia" as const,
    status: "liberado" as const,
  },
  {
    id: 31,
    nome: "Família Oliveira",
    responsavel: "Carlos Oliveira",
    documento: "123.987.654-00",
    telefone: "(11) 99876-5432",
    bairro: "Jardim Esperança",
    tipoCadastro: "extra" as const,
    progressoExtra: "3/3" as const,
    ultimaRetirada: "18/05/2025",
    proximaData: "11/06/2025 (Faltam 19 dias)",
    acompanhamento: "em_dia" as const,
    status: "avaliar" as const,
  },
  {
    id: 42,
    nome: "Família Souza",
    responsavel: "Ana Souza",
    documento: "456.123.789-00",
    telefone: "(11) 95555-1212",
    bairro: "Cidade Alta",
    tipoCadastro: "definitivo" as const,
    progressoExtra: null,
    ultimaRetirada: "05/05/2025",
    proximaData: "30/05/2025 (Atrasado)",
    acompanhamento: "atencao_60" as const,
    status: "bloqueado" as const,
  },
  {
    id: 57,
    nome: "Família Lima",
    responsavel: "Pedro Lima",
    documento: "789.321.456-00",
    telefone: "(11) 93333-4444",
    bairro: "São José",
    tipoCadastro: "extra" as const,
    progressoExtra: "1/3" as const,
    ultimaRetirada: "10/02/2025",
    proximaData: "04/06/2025 (Faltam 12 dias)",
    acompanhamento: "sem_retirada_90" as const,
    status: "liberado" as const,
  },
  {
    id: 68,
    nome: "Família Martins",
    responsavel: "Luciana Martins",
    documento: "654.987.321-00",
    telefone: "(11) 94444-5555",
    bairro: "Vila Esperança",
    tipoCadastro: "extra" as const,
    progressoExtra: null,
    ultimaRetirada: "—",
    proximaData: "—",
    acompanhamento: "inativo" as const,
    status: "inativo" as const,
  },
];

function FamiliasPage() {
  const total = exemploFamilias.length;
  const definitivos = exemploFamilias.filter((f) => f.tipoCadastro === "definitivo").length;
  const extras = exemploFamilias.filter((f) => f.tipoCadastro === "extra").length;
  const aguardandoAvaliacao = exemploFamilias.filter((f) => f.status === "avaliar").length;
  const semRetirada90 = exemploFamilias.filter((f) => f.acompanhamento === "sem_retirada_90").length;
  const bloqueadasInativas = exemploFamilias.filter(
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
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nova família
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard value={String(total)} label="Total de famílias" />
        <SummaryCard value={String(definitivos)} label="Cadastros definitivos" />
        <SummaryCard value={String(extras)} label="Cadastros extra/em avaliação" className="border-l-secondary" />
        <SummaryCard value={String(aguardandoAvaliacao)} label="Aguardando avaliação definitiva" className="border-l-warning" />
        <SummaryCard value={String(semRetirada90)} label="Sem retirada 90 dias+" className="border-l-destructive" />
        <SummaryCard value={String(bloqueadasInativas)} label="Bloqueadas/inativas" className="border-l-destructive" />
      </div>

      <p className="text-xs text-muted-foreground">
        Acompanhamento é apenas informativo. Não bloqueia entregas, não torna a família inativa automaticamente e não gera tarefa de contato.
      </p>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-6">
          <Field label="Nome"><Input placeholder="Buscar por nome" /></Field>
          <Field label="CPF / RG"><Input placeholder="Buscar por CPF ou RG" /></Field>
          <Field label="Telefone"><Input placeholder="(00) 00000-0000" /></Field>
          <Field label="Bairro">
            <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent>
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm">Limpar</Button>
            <Button size="sm" className="gap-2"><Search className="h-4 w-4" /> Buscar</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-0">
          <Table className="min-w-[1400px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nome da família</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>CPF / RG</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Bairro</TableHead>
                <TableHead>Tipo de cadastro</TableHead>
                <TableHead>Progresso Extra</TableHead>
                <TableHead>Última retirada</TableHead>
                <TableHead>Próxima data permitida</TableHead>
                <TableHead>Acompanhamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exemploFamilias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-16 text-center text-sm text-muted-foreground">
                    Nenhuma família cadastrada ainda.<br />
                    <Link to="/familias/$id" params={{ id: "exemplo" }} className="mt-2 inline-block text-primary hover:underline">
                      Ver exemplo de detalhe →
                    </Link>
                  </TableCell>
                </TableRow>
              ) : (
                exemploFamilias.map((familia) => (
                  <TableRow key={familia.id}>
                    <TableCell className="font-medium">
                      {familia.nome}
                      <div className="text-xs text-muted-foreground">ID: {familia.id}</div>
                    </TableCell>
                    <TableCell>{familia.responsavel}</TableCell>
                    <TableCell>{familia.documento}</TableCell>
                    <TableCell>{familia.telefone}</TableCell>
                    <TableCell>{familia.bairro}</TableCell>
                    <TableCell>
                      {familia.tipoCadastro === "definitivo" ? (
                        <Badge>Definitivo / Cesta Padrão</Badge>
                      ) : (
                        <Badge variant="outline">Extra / em avaliação</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {familia.progressoExtra ? (
                        <span className={familia.progressoExtra === "3/3" ? "text-destructive font-medium" : "text-foreground font-medium"}>
                          {familia.progressoExtra} retiradas
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{familia.ultimaRetirada}</TableCell>
                    <TableCell>{familia.proximaData}</TableCell>
                    <TableCell>
                      <AcompanhamentoBadge status={familia.acompanhamento} />
                    </TableCell>
                    <TableCell>
                      {familia.status === "liberado" && <Badge>Liberado</Badge>}
                      {familia.status === "bloqueado" && <Badge variant="destructive">Bloqueado</Badge>}
                      {familia.status === "inativo" && <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>}
                      {familia.status === "avaliar" && <Badge>Liberado</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" className="gap-1" asChild>
                            <Link to="/familias/$id" params={{ id: String(familia.id) }}>
                              <Eye className="h-3.5 w-3.5" /> Ver detalhes
                            </Link>
                          </Button>
                          <Button size="sm" className="gap-1" asChild>
                            <Link to="/atendimento">
                              <ArrowRight className="h-3.5 w-3.5" /> Ir para atendimento
                            </Link>
                          </Button>
                        </div>
                        <div className="flex justify-end gap-2">
                          {familia.progressoExtra === "3/3" && (
                            <Button variant="warning" size="sm" className="gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" /> Avaliar cadastro definitivo
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
                            <MessageSquare className="h-3.5 w-3.5" /> Registrar observação
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function SummaryCard({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <Card className={cn("border-l-4 border-l-primary", className)}>
      <CardContent className="p-4">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function AcompanhamentoBadge({ status }: { status: string }) {
  if (status === "em_dia") return <Badge>Em dia</Badge>;
  if (status === "atencao_60") return <Badge variant="warning">Atenção 60 dias</Badge>;
  if (status === "sem_retirada_90") return <Badge variant="destructive">Sem retirada 90 dias+</Badge>;
  if (status === "inativo") return <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>;
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
