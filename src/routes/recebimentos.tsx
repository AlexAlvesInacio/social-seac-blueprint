import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HandCoins, Landmark, Package, Plus, ShoppingCart, Trash2, Wallet } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCriarRecebimento,
  useItensEstoque,
  useRecebimentos,
} from "@/lib/familias/use-familias-supabase";
import type { RecebimentoOrigem } from "@/lib/familias/familias-supabase-types";

export const Route = createFileRoute("/recebimentos")({
  head: () => ({ meta: [{ title: "Recebimentos — SEAC Social" }] }),
  component: RecebimentosPage,
});

const ORIGENS: { value: RecebimentoOrigem; label: string }[] = [
  { value: "doacao", label: "Doação" },
  { value: "compra", label: "Compra" },
  { value: "investimento", label: "Investimento" },
  { value: "ajuste", label: "Ajuste" },
];

function rotuloParte(origem: RecebimentoOrigem): string {
  if (origem === "compra") return "Fornecedor";
  if (origem === "investimento") return "Origem do recurso";
  return "Doador ou fornecedor";
}

function labelOrigem(o: RecebimentoOrigem): string {
  return ORIGENS.find((x) => x.value === o)?.label ?? o;
}

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type ItemForm = {
  nome: string;
  quantidade: string;
  unidade: string;
  valorUnitario: string;
  itemId: string;
};
const itemVazio: ItemForm = {
  nome: "",
  quantidade: "",
  unidade: "un",
  valorUnitario: "",
  itemId: "",
};

const CATALOGO_LIVRE = "__livre__";

function RecebimentosPage() {
  const recebimentos = useRecebimentos();
  const criar = useCriarRecebimento();
  const catalogo = useItensEstoque();
  const itensCatalogo = (catalogo.data ?? []).filter((i) => i.ativo);

  const [data, setData] = useState(hojeISO());
  const [origem, setOrigem] = useState<RecebimentoOrigem>("doacao");
  const [parte, setParte] = useState("");
  const [documento, setDocumento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([{ ...itemVazio }]);

  const setItem = (i: number, patch: Partial<ItemForm>) =>
    setItens((atual) => atual.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItens((atual) => [...atual, { ...itemVazio }]);
  const removerItem = (i: number) => setItens((atual) => atual.filter((_, idx) => idx !== i));

  const reset = () => {
    setData(hojeISO());
    setOrigem("doacao");
    setParte("");
    setDocumento("");
    setObservacao("");
    setItens([{ ...itemVazio }]);
  };

  // Valor total = soma de (quantidade × valor unitário) dos itens informados.
  const valorTotal = useMemo(
    () =>
      itens.reduce((acc, it) => {
        const qtd = Number(it.quantidade);
        const vu = Number(it.valorUnitario);
        return acc + (Number.isFinite(qtd) && Number.isFinite(vu) ? qtd * vu : 0);
      }, 0),
    [itens],
  );

  const lista = recebimentos.data ?? [];
  const kpis = useMemo(() => {
    const mesAtual = hojeISO().slice(0, 7);
    const doMes = lista.filter((r) => r.data.slice(0, 7) === mesAtual);
    const valorMes = doMes.reduce((acc, r) => acc + r.valor, 0);
    const itensMes = doMes.reduce((acc, r) => acc + r.itensCount, 0);
    return {
      mes: doMes.length,
      doacoes: doMes.filter((r) => r.origem === "doacao").length,
      compras: doMes.filter((r) => r.origem === "compra").length,
      valorMes,
      itensMes,
    };
  }, [lista]);

  const salvar = async () => {
    if (!parte.trim()) {
      toast.error("Informe o doador/fornecedor.");
      return;
    }
    const itensValidos = itens
      .filter((it) => it.nome.trim() && Number(it.quantidade) > 0)
      .map((it) => {
        const qtd = Number(it.quantidade);
        const vu = it.valorUnitario ? Number(it.valorUnitario) : undefined;
        return {
          nome: it.nome,
          quantidade: qtd,
          unidade: it.unidade,
          valorUnitario: vu,
          valorTotal: vu !== undefined ? Number((vu * qtd).toFixed(2)) : undefined,
          itemId: it.itemId || undefined,
        };
      });

    try {
      await criar.mutateAsync({
        data,
        origem,
        parte,
        documento,
        valor: Number(valorTotal.toFixed(2)),
        observacao,
        itens: itensValidos,
      });
      toast.success("Recebimento registrado.");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar o recebimento.");
    }
  };

  return (
    <AppShell title="Recebimentos">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi
            icon={<Package className="h-4 w-4" />}
            label="Recebimentos no mês"
            valor={kpis.mes}
          />
          <Kpi
            icon={<HandCoins className="h-4 w-4" />}
            label="Doações (mês)"
            valor={kpis.doacoes}
          />
          <Kpi
            icon={<ShoppingCart className="h-4 w-4" />}
            label="Compras (mês)"
            valor={kpis.compras}
          />
          <Kpi
            icon={<Wallet className="h-4 w-4" />}
            label="Valor no mês"
            texto={brl(kpis.valorMes)}
          />
          <Kpi icon={<Landmark className="h-4 w-4" />} label="Itens no mês" valor={kpis.itensMes} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novo recebimento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <section className="grid gap-3 md:grid-cols-2">
              <Campo label="Data do recebimento">
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </Campo>
              <Campo label="Origem">
                <Select value={origem} onValueChange={(v) => setOrigem(v as RecebimentoOrigem)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGENS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label={`${rotuloParte(origem)} *`}>
                <Input value={parte} onChange={(e) => setParte(e.target.value)} />
              </Campo>
              <Campo label="Documento / referência">
                <Input
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="CNPJ, NF, protocolo…"
                />
              </Campo>
              <Campo label="Valor total (R$)">
                <Input value={brl(valorTotal)} readOnly disabled />
                <p className="mt-1 text-xs text-muted-foreground">
                  Calculado automaticamente pela soma dos itens (quantidade × valor unitário).
                </p>
              </Campo>
              <Campo label="Observação">
                <Textarea
                  rows={1}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </Campo>
            </section>

            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Itens recebidos</p>
                <Button size="sm" variant="outline" className="gap-2" onClick={addItem}>
                  <Plus className="h-4 w-4" /> Adicionar item
                </Button>
              </div>
              <div className="space-y-2">
                {itens.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-4">
                      <Label className="text-xs text-muted-foreground">Catálogo (estoque)</Label>
                      <Select
                        value={it.itemId || CATALOGO_LIVRE}
                        onValueChange={(v) => {
                          if (v === CATALOGO_LIVRE) {
                            setItem(i, { itemId: "" });
                            return;
                          }
                          const cat = itensCatalogo.find((c) => c.id === v);
                          setItem(i, {
                            itemId: v,
                            nome: cat?.nome ?? it.nome,
                            unidade: cat?.unidade ?? it.unidade,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={CATALOGO_LIVRE}>Texto livre (sem estoque)</SelectItem>
                          {itensCatalogo.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs text-muted-foreground">Item</Label>
                      <Input
                        value={it.nome}
                        onChange={(e) => setItem(i, { nome: e.target.value })}
                        placeholder="Ex.: Arroz 5kg"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Qtd.</Label>
                      <Input
                        type="number"
                        min={0}
                        value={it.quantidade}
                        onChange={(e) => setItem(i, { quantidade: e.target.value })}
                      />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs text-muted-foreground">Unid.</Label>
                      <Input
                        value={it.unidade}
                        onChange={(e) => setItem(i, { unidade: e.target.value })}
                      />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs text-muted-foreground">Vlr.</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={it.valorUnitario}
                        onChange={(e) => setItem(i, { valorUnitario: e.target.value })}
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Remover item"
                        disabled={itens.length === 1}
                        onClick={() => removerItem(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Itens vinculados ao catálogo geram entrada automática no estoque (quantidade
                arredondada para inteiro). Itens em “texto livre” apenas registram o recebimento.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={criar.isPending}>
                Limpar
              </Button>
              <Button onClick={() => void salvar()} disabled={criar.isPending}>
                {criar.isPending ? "Salvando…" : "Salvar recebimento"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de recebimentos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recebimentos.isPending ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : recebimentos.isError ? (
              <p className="p-8 text-center text-sm text-destructive">
                Não foi possível carregar os recebimentos.
              </p>
            ) : lista.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Nenhum recebimento registrado.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Parte</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {r.data.split("-").reverse().join("/")}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline">{labelOrigem(r.origem)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.parte}</TableCell>
                      <TableCell className="text-sm">{r.itensCount}</TableCell>
                      <TableCell className="text-sm">{brl(r.valor)}</TableCell>
                      <TableCell className="text-sm capitalize">{r.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Kpi({
  icon,
  label,
  valor,
  texto,
}: {
  icon: React.ReactNode;
  label: string;
  valor?: number;
  texto?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{texto ?? valor}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
