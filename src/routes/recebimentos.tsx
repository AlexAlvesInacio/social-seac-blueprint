import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Inbox, HandCoins, ShoppingCart, Landmark, Wallet, Package, Plus, Trash2, Eye, PackagePlus, Info,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/recebimentos")({
  head: () => ({ meta: [{ title: "Recebimentos — SEAC Social" }] }),
  component: RecebimentosPage,
});

const kpis = [
  { label: "Recebimentos no mês", value: "12", hint: "Maio/2025", icon: Inbox, tone: "bg-primary/10 text-primary" },
  { label: "Doações recebidas", value: "8", hint: "No mês", icon: HandCoins, tone: "bg-emerald-100 text-emerald-700" },
  { label: "Compras registradas", value: "3", hint: "No mês", icon: ShoppingCart, tone: "bg-sky-100 text-sky-700" },
  { label: "Investimentos", value: "1", hint: "No mês", icon: Landmark, tone: "bg-violet-100 text-violet-700" },
  { label: "Valor estimado", value: "R$ 18.450,00", hint: "Recebido no mês", icon: Wallet, tone: "bg-emerald-100 text-emerald-700" },
  { label: "Itens recebidos", value: "2.430", hint: "Unidades / pacotes", icon: Package, tone: "bg-amber-100 text-amber-700" },
];

const itensRecebimento = [
  { item: "Arroz 5kg", qtd: 200, unidade: "pacote", vu: "R$ 24,00", total: "R$ 4.800,00" },
  { item: "Feijão 1kg", qtd: 100, unidade: "pacote", vu: "R$ 8,50", total: "R$ 850,00" },
  { item: "Óleo 900ml", qtd: 80, unidade: "unidade", vu: "R$ 7,50", total: "R$ 600,00" },
];

type StatusRec = "Registrado" | "Pendente conferência" | "Cancelado";

const historico: {
  data: string; tipo: "Doação" | "Compra" | "Investimento"; parte: string;
  itens: string; valor: string; status: StatusRec;
}[] = [
  { data: "21/05/2025", tipo: "Doação", parte: "Supermercado Exemplo", itens: "3 itens", valor: "R$ 6.250,00", status: "Registrado" },
  { data: "20/05/2025", tipo: "Compra", parte: "Atacadão Exemplo", itens: "5 itens", valor: "R$ 3.850,00", status: "Registrado" },
  { data: "18/05/2025", tipo: "Investimento", parte: "Recurso interno SEAC", itens: "2 itens", valor: "R$ 2.500,00", status: "Registrado" },
  { data: "15/05/2025", tipo: "Doação", parte: "Padaria Bom Pão", itens: "2 itens", valor: "R$ 480,00", status: "Pendente conferência" },
  { data: "10/05/2025", tipo: "Doação", parte: "Família anônima", itens: "1 item", valor: "R$ 120,00", status: "Cancelado" },
];

function tipoBadge(tipo: "Doação" | "Compra" | "Investimento") {
  const map = {
    "Doação": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Compra": "bg-sky-100 text-sky-700 border-sky-200",
    "Investimento": "bg-violet-100 text-violet-700 border-violet-200",
  } as const;
  return <Badge variant="outline" className={map[tipo]}>{tipo}</Badge>;
}

function statusBadge(status: StatusRec) {
  const map: Record<StatusRec, string> = {
    "Registrado": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Pendente conferência": "bg-amber-100 text-amber-700 border-amber-200",
    "Cancelado": "bg-red-100 text-red-700 border-red-200",
  };
  return <Badge variant="outline" className={map[status]}>{status}</Badge>;
}

function RecebimentosPage() {
  const [tipo, setTipo] = useState<"doacao" | "compra" | "investimento">("doacao");
  const parteLabel = tipo === "compra" ? "Fornecedor" : tipo === "investimento" ? "Origem do recurso" : "Doador ou fornecedor";
  const partePlaceholder = tipo === "compra"
    ? "Nome do fornecedor"
    : tipo === "investimento"
      ? "Ex.: Recurso interno SEAC, campanha, parceiro"
      : "Nome do doador ou fornecedor";
  return (
    <AppShell title="Recebimentos">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${k.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs leading-tight text-muted-foreground">{k.label}</p>
                  <p className="mt-0.5 text-xl font-semibold leading-tight">{k.value}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{k.hint}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Recebimentos registram a origem dos alimentos, compras e investimentos. A entrada efetiva no estoque será controlada nas movimentações de estoque.</p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div>
              <p className="text-sm font-semibold">Novo recebimento</p>
              <p className="text-xs text-muted-foreground">Selecione o tipo e preencha os dados abaixo.</p>
            </div>

            <Tabs value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <TabsList>
                <TabsTrigger value="doacao">Doação</TabsTrigger>
                <TabsTrigger value="compra">Compra</TabsTrigger>
                <TabsTrigger value="investimento">Investimento</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Data do recebimento"><Input type="date" defaultValue="2025-05-21" /></Field>
              <Field label="Tipo / origem">
                <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doacao">Doação</SelectItem>
                    <SelectItem value="compra">Compra</SelectItem>
                    <SelectItem value="investimento">Investimento</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={parteLabel}><Input placeholder={partePlaceholder} /></Field>
              <Field label="Documento ou referência (opcional)"><Input placeholder="CNPJ, NF, protocolo..." /></Field>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valor total estimado (R$)</Label>
                <Input placeholder="0,00" />
                <p className="text-[11px] text-muted-foreground">Pode ser preenchido manualmente ou conferido com o total dos itens.</p>
              </div>
              <Field label="Comprovante / anexo"><Input type="file" /></Field>
            </div>
            <Field label="Observação"><Textarea placeholder="Observação opcional" /></Field>

            {/* Itens recebidos */}
            <div className="rounded-md border">
              <div className="border-b p-3">
                <p className="text-sm font-semibold">Itens recebidos</p>
                <p className="text-xs text-muted-foreground">Um recebimento pode conter vários itens.</p>
              </div>

              <div className="space-y-3 border-b p-3">
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <Field label="Item">
                    <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="arroz">Arroz 5kg</SelectItem>
                        <SelectItem value="feijao">Feijão 1kg</SelectItem>
                        <SelectItem value="oleo">Óleo 900ml</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Quantidade"><Input type="number" placeholder="Informe a quantidade" /></Field>
                  <Field label="Unidade">
                    <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="un">unidade</SelectItem>
                        <SelectItem value="pc">pacote</SelectItem>
                        <SelectItem value="cx">caixa</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <Field label="Valor unitário estimado (R$)"><Input placeholder="0,00" /></Field>
                  <Field label="Valor total do item (R$)"><Input placeholder="0,00" /></Field>
                  <Button variant="outline" className="gap-2 sm:col-span-2 md:col-span-1"><Plus className="h-4 w-4" /> Adicionar item</Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Valor unitário estimado</TableHead>
                    <TableHead>Valor total do item</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensRecebimento.map((i) => (
                    <TableRow key={i.item}>
                      <TableCell className="font-medium">{i.item}</TableCell>
                      <TableCell>{i.qtd}</TableCell>
                      <TableCell>{i.unidade}</TableCell>
                      <TableCell>{i.vu}</TableCell>
                      <TableCell>{i.total}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t bg-muted/40 p-3 text-sm">
                <span className="text-muted-foreground">Total dos itens</span>
                <span className="font-semibold text-emerald-700">R$ 6.250,00</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">Salvar recebimento</Button>
              <Button variant="outline">Limpar</Button>
              <Button variant="ghost">Cancelar edição</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Histórico de recebimentos</p>
              <p className="text-xs text-muted-foreground">Últimos registros</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Doador / fornecedor</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Valor total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((h, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">{h.data}</TableCell>
                    <TableCell>{tipoBadge(h.tipo)}</TableCell>
                    <TableCell className="font-medium">{h.parte}</TableCell>
                    <TableCell>{h.itens}</TableCell>
                    <TableCell>{h.valor}</TableCell>
                    <TableCell>{statusBadge(h.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Ver detalhes"><Eye className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" title="Gerar entrada no estoque (em breve)" disabled><PackagePlus className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">Mostrando 1 a 5 de 12 recebimentos</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}