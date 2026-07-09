import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  HeartHandshake,
  MoreHorizontal,
  Pencil,
  Plus,
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
import { useFamilias } from "@/lib/familias-store";

export const Route = createFileRoute("/familias/$id")({
  head: () => ({ meta: [{ title: "Detalhe da família — SEAC Social" }] }),
  component: FamiliaDetail,
});

const assistidos = [
  {
    nome: "João da Silva",
    documento: "987.654.321-00",
    status: "Ativo",
    tipoCadastro: "Definitivo",
    beneficio: "Cesta Padrão",
    ultimaRetirada: "16/05/2025",
    proximaData: "10/06/2025",
    progresso: "—",
  },
  {
    nome: "Maria da Silva",
    documento: "321.654.987-00",
    status: "Ativa",
    tipoCadastro: "Avaliação",
    beneficio: "Cesta Extra",
    ultimaRetirada: "20/05/2025",
    proximaData: "14/06/2025",
    progresso: "2/3",
  },
];

const membros = [
  { nome: "Pedro da Silva", nasc: "12/03/2016", parentesco: "Filho", tipo: "Criança", obs: "—" },
  { nome: "Ana da Silva", nasc: "08/09/2019", parentesco: "Filha", tipo: "Criança", obs: "—" },
  { nome: "José da Silva", nasc: "04/02/1952", parentesco: "Pai", tipo: "Idoso", obs: "Hipertenso." },
];

const entregas = [
  { data: "20/05/2025", assistido: "Maria da Silva", beneficio: "Cesta Extra", status: "Entrega realizada", usuario: "Atendente teste", obs: "—" },
  { data: "16/05/2025", assistido: "João da Silva", beneficio: "Cesta Padrão", status: "Entrega realizada", usuario: "Atendente teste", obs: "—" },
  { data: "15/04/2025", assistido: "João da Silva", beneficio: "Cesta Padrão", status: "Entrega realizada", usuario: "Atendente teste", obs: "—" },
];

const bloqueios = [
  {
    data: "25/05/2025",
    assistido: "João da Silva",
    motivo: "Antes dos 25 dias",
    tipo: "Cesta Padrão",
    proxima: "10/06/2025",
    liberacao: "Não",
    usuario: "Atendente teste",
    obs: "Tentativa registrada.",
  },
  {
    data: "18/05/2025",
    assistido: "Maria da Silva",
    motivo: "Falta de estoque",
    tipo: "Cesta Extra",
    proxima: "—",
    liberacao: "Não",
    usuario: "Atendente teste",
    obs: "Sem saldo de Cesta Extra no momento.",
  },
  {
    data: "05/05/2025",
    assistido: "João da Silva",
    motivo: "Antes dos 25 dias",
    tipo: "Cesta Padrão",
    proxima: "10/05/2025",
    liberacao: "Sim",
    usuario: "Administrador",
    obs: "Liberação excepcional autorizada por admin.",
  },
  {
    data: "12/04/2025",
    assistido: "Maria da Silva",
    motivo: "Antes dos 25 dias",
    tipo: "Cesta Extra",
    proxima: "20/04/2025",
    liberacao: "Não",
    usuario: "Atendente teste",
    obs: "Tentativa sem liberação.",
  },
];

const observacoesSociais = [
  { obs: "Família acompanhada pelo SEAC. Priorizar atendimento mensal.", data: "01/05/2025", usuario: "Assistente social" },
  { obs: "Visita domiciliar realizada. Condições estáveis.", data: "10/04/2025", usuario: "Atendente teste" },
];

function FamiliaDetail() {
  const { id } = Route.useParams();
  const familia = useFamilias((s) => s.familias.find((f) => String(f.id) === id));

  if (!familia) {
    return (
      <AppShell
        title="Detalhe da família"
        actions={
          <Button asChild size="sm" variant="ghost" className="gap-2">
            <Link to="/familias"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
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
    familia.status === "liberado" ? "Ativa" :
    familia.status === "bloqueado" ? "Bloqueada" :
    familia.status === "inativo" ? "Inativa" : "Em avaliação";

  return (
    <AppShell
      title="Detalhe da família"
      breadcrumbs={
        <div className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
          <ChevronRight className="h-3 w-3" />
          <Link to="/familias" className="hover:text-foreground">Famílias</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{familia.nome}</span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost" className="gap-2">
            <Link to="/familias"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          </Button>
          <Button size="sm" variant="outline" className="gap-2"><Pencil className="h-4 w-4" /> Editar família</Button>
          <Button size="sm" variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Adicionar assistido</Button>
          <Button asChild size="sm" className="gap-2">
            <Link to="/atendimento"><HeartHandshake className="h-4 w-4" /> Ir para atendimento</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-2">
                <MoreHorizontal className="h-4 w-4" /> Mais ações
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar membro familiar
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <ClipboardList className="h-4 w-4" /> Registrar observação
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
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
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/15">{statusLabel}</Badge>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <Info label="Responsável" value={familia.responsavel} />
                  <Info label="CPF / RG" value={familia.documento} />
                  <Info label="Endereço" value={[familia.endereco, familia.numero].filter(Boolean).join(", ") || "—"} />
                  <Info label="Bairro" value={familia.bairro || "—"} />
                  <Info label="Cidade" value={familia.cidade || "—"} />
                  <Info label="UF" value={familia.uf || "—"} />
                  <Info label="CEP" value={familia.cep || "—"} />
                  <Info label="Telefone / WhatsApp" value={familia.telefone || "—"} />
                  <Info label="Moradores" value={String(familia.moradores ?? 0)} />
                  <Info label="Crianças" value={String(familia.criancas ?? 0)} />
                  <Info label="Idosos" value={String(familia.idosos ?? 0)} />
                  <Info label="Gestantes" value={String(familia.gestantes ?? 0)} />
                  <Info label="PCD" value={String(familia.pcd ?? 0)} />
                  <Info label="Tipo de cadastro" value={familia.tipoCadastro === "definitivo" ? "Definitivo" : "Avaliação"} />
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
                Assistido completou 3 retiradas extras. Avaliar cadastro definitivo para liberar Cesta Padrão no próximo mês.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
          <SummaryCard label="Moradores" value={String(familia.moradores ?? 0)} />
          <SummaryCard label="Assistidos" value="0" />
          <SummaryCard label="Membros familiares" value="0" />
          <SummaryCard label="Crianças" value={String(familia.criancas ?? 0)} />
          <SummaryCard label="Idosos" value={String(familia.idosos ?? 0)} />
          <SummaryCard label="Gestantes" value={String(familia.gestantes ?? 0)} />
          <SummaryCard label="PCD" value={String(familia.pcd ?? 0)} />
          <SummaryCard label="Última retirada" value={familia.ultimaRetirada || "—"} />
          <SummaryCard label="Acompanhamento" value={familia.acompanhamento === "em_dia" ? "Em dia" : "—"} tone="success" />
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
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhum assistido vinculado.
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="membros">
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhum membro vinculado.
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="entregas">
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma entrega registrada.
              </CardContent>
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
                <Button size="sm" variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Nova observação</Button>
              </CardHeader>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma observação social registrada.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
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
        <p className={`mt-1 text-lg font-semibold ${tone === "success" ? "text-primary" : "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}