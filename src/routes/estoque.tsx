import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Minus, Sliders, Package, PackageCheck, AlertTriangle, PackageX, Wallet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/estoque")({
  head: () => ({ meta: [{ title: "Estoque — SEAC Social" }] }),
  component: EstoquePage,
});

const kpis = [
  { label: "Total de itens", value: "18", hint: "Cadastrados", icon: Package, tone: "bg-primary/10 text-primary" },
  { label: "Itens com estoque", value: "12", hint: "Saldo > 0", icon: PackageCheck, tone: "bg-emerald-100 text-emerald-700" },
  { label: "Itens em estoque baixo", value: "3", hint: "Atenção", icon: AlertTriangle, tone: "bg-amber-100 text-amber-700" },
  { label: "Itens sem estoque", value: "2", hint: "Sem saldo", icon: PackageX, tone: "bg-red-100 text-red-700" },
  { label: "Valor total estimado", value: "R$ 24.350,00", hint: "Valor estimado do estoque", icon: Wallet, tone: "bg-emerald-100 text-emerald-700" },
];

type StatusItem = "Em estoque" | "Atenção" | "Estoque baixo" | "Sem estoque" | "Inativo";

const saldos: {
  item: string; categoria: string; unidade: string; saldo: number; minimo: number;
  status: StatusItem; valor: string; ultima: string;
}[] = [
  { item: "Cesta Padrão", categoria: "Benefício montado", unidade: "unidade", saldo: 120, minimo: 30, status: "Em estoque", valor: "R$ 85,00", ultima: "20/05/2025 10:30" },
  { item: "Cesta Extra", categoria: "Benefício montado", unidade: "unidade", saldo: 25, minimo: 20, status: "Atenção", valor: "R$ 60,00", ultima: "20/05/2025 09:15" },
  { item: "Arroz 5kg", categoria: "Alimento", unidade: "pacote", saldo: 200, minimo: 50, status: "Em estoque", valor: "R$ 24,00", ultima: "19/05/2025 14:20" },
  { item: "Feijão 1kg", categoria: "Alimento", unidade: "pacote", saldo: 80, minimo: 40, status: "Em estoque", valor: "R$ 8,50", ultima: "19/05/2025 14:20" },
  { item: "Óleo 900ml", categoria: "Alimento", unidade: "unidade", saldo: 15, minimo: 30, status: "Estoque baixo", valor: "R$ 7,50", ultima: "18/05/2025 16:45" },
  { item: "Macarrão", categoria: "Alimento", unidade: "pacote", saldo: 0, minimo: 20, status: "Sem estoque", valor: "R$ 4,20", ultima: "18/05/2025 11:00" },
  { item: "Marmita", categoria: "Refeição", unidade: "unidade", saldo: 150, minimo: 50, status: "Em estoque", valor: "R$ 12,00", ultima: "20/05/2025 08:50" },
  { item: "Kit Gestante", categoria: "Benefício", unidade: "unidade", saldo: 8, minimo: 10, status: "Atenção", valor: "R$ 45,00", ultima: "17/05/2025 13:10" },
];

type MovTipo = "Entrada" | "Saída" | "Ajuste" | "Baixa automática";

const movimentacoes: {
  data: string; item: string; tipo: MovTipo; quantidade: string; saldo: number;
  usuario: string; origem: string; obs: string;
}[] = [
  { data: "20/05/2025 10:30", item: "Cesta Padrão", tipo: "Baixa automática", quantidade: "-1", saldo: 119, usuario: "Atendente teste", origem: "Entrega realizada", obs: "Entrega para João da Silva" },
  { data: "20/05/2025 09:15", item: "Cesta Extra", tipo: "Baixa automática", quantidade: "-1", saldo: 24, usuario: "Atendente teste", origem: "Entrega realizada", obs: "Entrega para Maria da Silva" },
  { data: "19/05/2025 14:20", item: "Arroz 5kg", tipo: "Entrada", quantidade: "+200", saldo: 200, usuario: "Atendente teste", origem: "Doação", obs: "Doador: Supermercado Exemplo" },
  { data: "18/05/2025 16:45", item: "Óleo 900ml", tipo: "Ajuste", quantidade: "-5", saldo: 15, usuario: "Administrador", origem: "Ajuste de contagem", obs: "Correção de inventário" },
  { data: "18/05/2025 11:00", item: "Macarrão", tipo: "Saída", quantidade: "-20", saldo: 0, usuario: "Atendente teste", origem: "Montagem de cesta", obs: "Uso na montagem de cesta" },
];

function statusBadge(status: StatusItem) {
  const map: Record<StatusItem, string> = {
    "Em estoque": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Atenção": "bg-amber-100 text-amber-700 border-amber-200",
    "Estoque baixo": "bg-red-100 text-red-700 border-red-200",
    "Sem estoque": "bg-red-600 text-white border-red-700",
    "Inativo": "bg-muted text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={map[status]}>{status}</Badge>;
}

function movBadge(tipo: MovTipo) {
  const map: Record<MovTipo, string> = {
    "Entrada": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Saída": "bg-amber-100 text-amber-700 border-amber-200",
    "Ajuste": "bg-violet-100 text-violet-700 border-violet-200",
    "Baixa automática": "bg-sky-100 text-sky-700 border-sky-200",
  };
  return <Badge variant="outline" className={map[tipo]}>{tipo}</Badge>;
}

function EstoquePage() {
  const [openEntrada, setOpenEntrada] = useState(false);
  const [openSaida, setOpenSaida] = useState(false);
  const [openAjuste, setOpenAjuste] = useState(false);

  return (
    <AppShell
      title="Controle de estoque"
      actions={
        <div className="flex gap-2">
          <Button size="sm" className="gap-2" onClick={() => setOpenEntrada(true)}>
            <Plus className="h-4 w-4" /> Nova entrada
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpenSaida(true)}>
            <Minus className="h-4 w-4" /> Nova saída
          </Button>
          <Button size="sm" variant="secondary" className="gap-2" onClick={() => setOpenAjuste(true)}>
            <Sliders className="h-4 w-4" /> Ajuste
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${k.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{k.label}</p>
                  <p className="mt-0.5 text-2xl font-semibold leading-tight">{k.value}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{k.hint}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="saldos" className="mt-4">
        <TabsList>
          <TabsTrigger value="saldos">Saldos atuais</TabsTrigger>
          <TabsTrigger value="mov">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="saldos" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Saldo atual</TableHead>
                    <TableHead>Estoque mínimo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor médio estimado</TableHead>
                    <TableHead>Última movimentação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saldos.map((s) => (
                    <TableRow key={s.item}>
                      <TableCell className="font-medium">{s.item}</TableCell>
                      <TableCell>{s.categoria}</TableCell>
                      <TableCell>{s.unidade}</TableCell>
                      <TableCell>{s.saldo}</TableCell>
                      <TableCell>{s.minimo}</TableCell>
                      <TableCell>{statusBadge(s.status)}</TableCell>
                      <TableCell>{s.valor}</TableCell>
                      <TableCell className="text-muted-foreground">{s.ultima}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="mt-2 text-xs text-muted-foreground">Mostrando 1 a 8 de 8 itens</p>
        </TabsContent>

        <TabsContent value="mov" className="mt-3 space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-6">
              <Field label="Item">
                <Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent></Select>
              </Field>
              <Field label="Categoria">
                <Select><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem></SelectContent></Select>
              </Field>
              <Field label="Tipo de movimentação">
                <Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem><SelectItem value="ajuste">Ajuste</SelectItem><SelectItem value="baixa">Baixa automática</SelectItem></SelectContent></Select>
              </Field>
              <Field label="Status">
                <Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent></Select>
              </Field>
              <Field label="Período de"><Input type="date" /></Field>
              <Field label="até"><Input type="date" /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/hora</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Tipo de movimentação</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Saldo após</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoes.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{m.data}</TableCell>
                      <TableCell className="font-medium">{m.item}</TableCell>
                      <TableCell>{movBadge(m.tipo)}</TableCell>
                      <TableCell className={m.quantidade.startsWith("+") ? "text-emerald-700" : "text-red-700"}>{m.quantidade}</TableCell>
                      <TableCell>{m.saldo}</TableCell>
                      <TableCell>{m.usuario}</TableCell>
                      <TableCell>{m.origem}</TableCell>
                      <TableCell className="text-muted-foreground">{m.obs}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">Mostrando 1 a 5 de 25 movimentações</p>
        </TabsContent>
      </Tabs>

      {/* Nova entrada */}
      <Sheet open={openEntrada} onOpenChange={setOpenEntrada}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>Nova entrada</SheetTitle></SheetHeader>
          <div className="grid gap-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Item"><Select defaultValue="a"><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="a">Arroz 5kg</SelectItem><SelectItem value="b">Feijão 1kg</SelectItem><SelectItem value="c">Óleo 900ml</SelectItem></SelectContent></Select></Field>
              <Field label="Quantidade"><Input type="number" placeholder="Informe a quantidade" /></Field>
              <Field label="Unidade"><Select defaultValue="pc"><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="un">unidade</SelectItem><SelectItem value="pc">pacote</SelectItem><SelectItem value="cx">caixa</SelectItem><SelectItem value="kg">kg</SelectItem><SelectItem value="lt">litro</SelectItem></SelectContent></Select></Field>
              <Field label="Origem"><Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="doacao">Doação</SelectItem><SelectItem value="compra">Compra</SelectItem><SelectItem value="invest">Investimento</SelectItem><SelectItem value="ajuste">Ajuste inicial</SelectItem><SelectItem value="transf">Transferência</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select></Field>
            </div>
            <Field label="Doador / Fornecedor"><Input placeholder="Digite o nome" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data"><Input type="date" defaultValue="2025-05-21" /></Field>
              <Field label="Valor unitário estimado (R$)"><Input type="number" step="0.01" placeholder="0,00" /></Field>
            </div>
            <Field label="Observação"><Textarea placeholder="Digite uma observação (opcional)" /></Field>
          </div>
          <SheetFooter>
            <Button variant="ghost" onClick={() => setOpenEntrada(false)}>Cancelar</Button>
            <Button onClick={() => setOpenEntrada(false)}>Salvar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Nova saída */}
      <Sheet open={openSaida} onOpenChange={setOpenSaida}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>Nova saída</SheetTitle></SheetHeader>
          <div className="grid gap-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Item"><Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="a">Macarrão</SelectItem><SelectItem value="b">Arroz 5kg</SelectItem><SelectItem value="c">Óleo 900ml</SelectItem></SelectContent></Select></Field>
              <Field label="Quantidade"><Input type="number" placeholder="Informe a quantidade" /></Field>
              <Field label="Motivo"><Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="manual">Entrega manual</SelectItem><SelectItem value="perda">Perda</SelectItem><SelectItem value="venc">Vencimento</SelectItem><SelectItem value="desc">Descarte</SelectItem><SelectItem value="doa">Doação externa</SelectItem><SelectItem value="mont">Montagem de cesta</SelectItem><SelectItem value="int">Consumo interno</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select></Field>
              <Field label="Destino (opcional)"><Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="atend">Atendimento</SelectItem><SelectItem value="mont">Montagem de cesta</SelectItem><SelectItem value="desc">Descarte</SelectItem><SelectItem value="doa">Doação externa</SelectItem><SelectItem value="int">Uso interno</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select></Field>
            </div>
            <Field label="Data"><Input type="date" defaultValue="2025-05-21" /></Field>
            <Field label="Observação"><Textarea placeholder="Digite uma observação (opcional)" /></Field>
          </div>
          <SheetFooter>
            <Button variant="ghost" onClick={() => setOpenSaida(false)}>Cancelar</Button>
            <Button onClick={() => setOpenSaida(false)}>Salvar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Ajuste */}
      <Sheet open={openAjuste} onOpenChange={setOpenAjuste}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>Ajuste de estoque</SheetTitle></SheetHeader>
          <div className="grid gap-3 p-4">
            <Field label="Item"><Select defaultValue="a"><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="a">Óleo 900ml</SelectItem><SelectItem value="b">Arroz 5kg</SelectItem><SelectItem value="c">Macarrão</SelectItem></SelectContent></Select></Field>
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Saldo atual</span>
                <span className="font-medium">15</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Saldo após ajuste</span>
                <span className="font-semibold text-emerald-700">20</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo de ajuste</Label>
              <div className="flex gap-4 pt-1 text-sm">
                <label className="flex items-center gap-2"><input type="radio" name="ajuste" defaultChecked /> Aumentar saldo</label>
                <label className="flex items-center gap-2"><input type="radio" name="ajuste" /> Reduzir saldo</label>
              </div>
            </div>
            <Field label="Quantidade"><Input type="number" placeholder="Informe a quantidade" /></Field>
            <Field label="Motivo (obrigatório)"><Input placeholder="Digite o motivo" /></Field>
            <Field label="Observação"><Textarea placeholder="Digite uma observação (opcional)" /></Field>
          </div>
          <SheetFooter>
            <Button variant="ghost" onClick={() => setOpenAjuste(false)}>Cancelar</Button>
            <Button onClick={() => setOpenAjuste(false)}>Salvar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}