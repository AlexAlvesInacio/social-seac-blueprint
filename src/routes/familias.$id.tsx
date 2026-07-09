import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFamilias, calcularIdade, calcularFaixaEtaria, rotuloFaixaEtaria } from "@/lib/familias-store";
import {
  EditarFamiliaDialog, AdicionarAssistidoDialog,
  AdicionarMembroDialog, RegistrarObservacaoDialog,
} from "@/components/familia-detail-dialogs";

export const Route = createFileRoute("/familias/$id")({
  head: () => ({ meta: [{ title: "Detalhe da família — SEAC Social" }] }),
  component: FamiliaDetail,
});

function FamiliaDetail() {
  const { id } = Route.useParams();
  const familias = useFamilias((s) => s.familias);
  const allAssistidos = useFamilias((s) => s.assistidos);
  const allMembros = useFamilias((s) => s.membros);
  const allObs = useFamilias((s) => s.observacoes);
  const familia = useMemo(() => familias.find((f) => String(f.id) === id), [familias, id]);
  const assistidos = useMemo(
    () => allAssistidos.filter((a) => String(a.familiaId) === id), [allAssistidos, id],
  );
  const membros = useMemo(
    () => allMembros.filter((m) => String(m.familiaId) === id), [allMembros, id],
  );
  const observacoes = useMemo(
    () => allObs.filter((o) => String(o.familiaId) === id), [allObs, id],
  );
  const contagens = useMemo(() => {
    let criancas = 0, adolescentes = 0, idosos = 0, gestantes = 0, pcd = 0;
    for (const m of membros) {
      const faixa = calcularFaixaEtaria(m.nascimento);
      if (faixa === "crianca") criancas++;
      else if (faixa === "adolescente") adolescentes++;
      else if (faixa === "idoso") idosos++;
      if (m.gestante) gestantes++;
      if (m.pcd) pcd++;
    }
    return { criancas, adolescentes, idosos, gestantes, pcd };
  }, [membros]);
  const [openEditar, setOpenEditar] = useState(false);
  const [openAssistido, setOpenAssistido] = useState(false);
  const [openMembro, setOpenMembro] = useState(false);
  const [openObs, setOpenObs] = useState(false);

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
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpenEditar(true)}><Pencil className="h-4 w-4" /> Editar família</Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpenAssistido(true)}><Plus className="h-4 w-4" /> Adicionar assistido</Button>
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
      <AdicionarAssistidoDialog open={openAssistido} onOpenChange={setOpenAssistido} familia={familia} />
      <AdicionarMembroDialog open={openMembro} onOpenChange={setOpenMembro} familia={familia} />
      <RegistrarObservacaoDialog open={openObs} onOpenChange={setOpenObs} familia={familia} />
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
                  <Info label="Crianças" value={String(contagens.criancas)} />
                  <Info label="Adolescentes" value={String(contagens.adolescentes)} />
                  <Info label="Idosos" value={String(contagens.idosos)} />
                  <Info label="Gestantes" value={String(contagens.gestantes)} />
                  <Info label="PCD" value={String(contagens.pcd)} />
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
          <SummaryCard label="Assistidos" value={String(assistidos.length)} />
          <SummaryCard label="Membros familiares" value={String(membros.length)} />
          <SummaryCard label="Crianças" value={String(contagens.criancas)} />
          <SummaryCard label="Idosos" value={String(contagens.idosos)} />
          <SummaryCard label="Gestantes" value={String(contagens.gestantes)} />
          <SummaryCard label="PCD" value={String(contagens.pcd)} />
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
              {assistidos.length === 0 ? (
                <CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum assistido vinculado.</CardContent>
              ) : (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Nome</TableHead><TableHead>CPF/RG</TableHead>
                      <TableHead>Tipo</TableHead><TableHead>Benefício</TableHead>
                      <TableHead>Status</TableHead><TableHead>PCD</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {assistidos.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm">{a.nome}</TableCell>
                          <TableCell className="text-sm">{a.documento}</TableCell>
                          <TableCell className="text-sm">{a.tipoCadastro === "definitivo" ? "Definitivo" : "Avaliação"}</TableCell>
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
                <CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum membro vinculado.</CardContent>
              ) : (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Nome</TableHead><TableHead>Parentesco</TableHead>
                      <TableHead>Doc.</TableHead>
                      <TableHead>Faixa etária</TableHead>
                      <TableHead>Marcadores</TableHead>
                    </TableRow></TableHeader>
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
                            {faixa ? `${rotuloFaixaEtaria(faixa)}${idade !== null ? ` (${idade})` : ""}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {[m.gestante && "Gestante", m.pcd && "PCD"].filter(Boolean).join(" · ") || "—"}
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
                <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpenObs(true)}><Plus className="h-4 w-4" /> Nova observação</Button>
              </CardHeader>
              {observacoes.length === 0 ? (
                <CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma observação social registrada.</CardContent>
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