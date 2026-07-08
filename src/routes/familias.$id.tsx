import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  HeartHandshake,
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
];

const observacoesSociais = [
  { obs: "Família acompanhada pelo SEAC. Priorizar atendimento mensal.", data: "01/05/2025", usuario: "Assistente social" },
  { obs: "Visita domiciliar realizada. Condições estáveis.", data: "10/04/2025", usuario: "Atendente teste" },
];

function FamiliaDetail() {
  const alertaAvaliacao = assistidos.some(
    (a) => a.tipoCadastro === "Avaliação" && a.progresso === "3/3",
  );

  return (
    <AppShell
      title="Detalhe da família"
      breadcrumbs={
        <div className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
          <ChevronRight className="h-3 w-3" />
          <Link to="/familias" className="hover:text-foreground">Famílias</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Família da Silva</span>
        </div>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="ghost" className="gap-2">
            <Link to="/familias"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          </Button>
          <Button size="sm" variant="outline" className="gap-2"><Pencil className="h-4 w-4" /> Editar família</Button>
          <Button size="sm" variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Adicionar assistido</Button>
          <Button size="sm" variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Adicionar membro familiar</Button>
          <Button asChild size="sm" className="gap-2">
            <Link to="/atendimento"><HeartHandshake className="h-4 w-4" /> Ir para atendimento</Link>
          </Button>
          <Button size="sm" variant="secondary" className="gap-2"><ClipboardList className="h-4 w-4" /> Registrar observação</Button>
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
                  <h2 className="text-xl font-semibold">Família da Silva</h2>
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Ativa</Badge>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <Info label="Endereço" value="Rua das Flores, 123" />
                  <Info label="Bairro" value="São João" />
                  <Info label="Cidade" value="São Paulo" />
                  <Info label="UF" value="SP" />
                  <Info label="CEP" value="00000-000" />
                  <Info label="Telefone / WhatsApp" value="(11) 97654-3210" />
                  <Info label="Moradores" value="5" />
                  <Info label="Crianças" value="2" />
                  <Info label="Idosos" value="1" />
                  <Info label="Gestantes" value="0" />
                  <Info label="PCD" value="1" />
                </div>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="text-sm">Família acompanhada pelo SEAC. Priorizar atendimento mensal.</p>
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
          <SummaryCard label="Moradores" value="5" />
          <SummaryCard label="Assistidos" value="2" />
          <SummaryCard label="Membros familiares" value="3" />
          <SummaryCard label="Crianças" value="2" />
          <SummaryCard label="Idosos" value="1" />
          <SummaryCard label="Gestantes" value="0" />
          <SummaryCard label="PCD" value="1" />
          <SummaryCard label="Última retirada" value="16/05/2025" />
          <SummaryCard label="Acompanhamento" value="Em dia" tone="success" />
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
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF/RG</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tipo de cadastro</TableHead>
                      <TableHead>Benefício</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Última retirada</TableHead>
                      <TableHead>Próxima permitida</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assistidos.map((a) => (
                      <TableRow key={a.documento}>
                        <TableCell className="font-medium">{a.nome}</TableCell>
                        <TableCell>{a.documento}</TableCell>
                        <TableCell><Badge variant="outline">{a.status}</Badge></TableCell>
                        <TableCell>
                          {a.tipoCadastro === "Definitivo" ? (
                            <Badge>Definitivo</Badge>
                          ) : (
                            <Badge variant="warning">Avaliação</Badge>
                          )}
                        </TableCell>
                        <TableCell>{a.beneficio}</TableCell>
                        <TableCell>{a.progresso}</TableCell>
                        <TableCell>{a.ultimaRetirada}</TableCell>
                        <TableCell>{a.proximaData}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="membros">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Data de nascimento</TableHead>
                      <TableHead>Parentesco</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membros.map((m) => (
                      <TableRow key={m.nome}>
                        <TableCell className="font-medium">{m.nome}</TableCell>
                        <TableCell>{m.nasc}</TableCell>
                        <TableCell>{m.parentesco}</TableCell>
                        <TableCell><Badge variant="outline">{m.tipo}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{m.obs}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="entregas">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Assistido</TableHead>
                      <TableHead>Benefício</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Usuário responsável</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entregas.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.data}</TableCell>
                        <TableCell className="font-medium">{e.assistido}</TableCell>
                        <TableCell>{e.beneficio}</TableCell>
                        <TableCell><Badge className="bg-primary/15 text-primary hover:bg-primary/15">{e.status}</Badge></TableCell>
                        <TableCell>{e.usuario}</TableCell>
                        <TableCell className="text-muted-foreground">{e.obs}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bloqueios">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Assistido</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Tipo de cesta tentada</TableHead>
                      <TableHead>Próxima permitida</TableHead>
                      <TableHead>Liberação excepcional</TableHead>
                      <TableHead>Usuário responsável</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bloqueios.map((b, i) => (
                      <TableRow key={i}>
                        <TableCell>{b.data}</TableCell>
                        <TableCell className="font-medium">{b.assistido}</TableCell>
                        <TableCell><Badge variant="destructive">{b.motivo}</Badge></TableCell>
                        <TableCell>{b.tipo}</TableCell>
                        <TableCell>{b.proxima}</TableCell>
                        <TableCell>{b.liberacao}</TableCell>
                        <TableCell>{b.usuario}</TableCell>
                        <TableCell className="text-muted-foreground">{b.obs}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="observacoes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Observações sociais</CardTitle>
                <Button size="sm" variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Nova observação</Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Observação</TableHead>
                      <TableHead className="w-32">Data</TableHead>
                      <TableHead className="w-48">Usuário responsável</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {observacoesSociais.map((o, i) => (
                      <TableRow key={i}>
                        <TableCell>{o.obs}</TableCell>
                        <TableCell>{o.data}</TableCell>
                        <TableCell>{o.usuario}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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