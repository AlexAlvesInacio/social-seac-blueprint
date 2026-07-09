import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Pencil,
  Plus,
  ShoppingBasket,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/composicao-cesta")({
  head: () => ({ meta: [{ title: "Composição por benefício — SEAC Social" }] }),
  component: ComposicaoPage,
});

type BeneficioKey = "padrao" | "extra" | "gestante";

type ItemComposicao = {
  item: string;
  quantidade: number;
  unidade: string;
  custo: number;
};

const beneficioNomes: Record<BeneficioKey, string> = {
  padrao: "Cesta Padrão",
  extra: "Cesta Extra",
  gestante: "Kit Gestante",
};

const composicoesIniciais: Record<BeneficioKey, ItemComposicao[]> = {
  padrao: [
    { item: "Arroz 5kg", quantidade: 1, unidade: "pacote", custo: 24.0 },
    { item: "Feijão 1kg", quantidade: 2, unidade: "pacote", custo: 17.0 },
    { item: "Óleo 900ml", quantidade: 1, unidade: "unidade", custo: 7.5 },
    { item: "Macarrão", quantidade: 2, unidade: "pacote", custo: 8.4 },
    { item: "Açúcar 1kg", quantidade: 1, unidade: "pacote", custo: 5.5 },
    { item: "Café 500g", quantidade: 1, unidade: "pacote", custo: 16.0 },
    { item: "Leite em pó", quantidade: 1, unidade: "unidade", custo: 18.0 },
  ],
  extra: [
    { item: "Arroz 5kg", quantidade: 1, unidade: "pacote", custo: 24.0 },
    { item: "Feijão 1kg", quantidade: 1, unidade: "pacote", custo: 8.5 },
    { item: "Macarrão", quantidade: 1, unidade: "pacote", custo: 4.2 },
    { item: "Óleo 900ml", quantidade: 1, unidade: "unidade", custo: 7.5 },
  ],
  gestante: [
    { item: "Leite em pó", quantidade: 2, unidade: "unidade", custo: 36.0 },
    { item: "Sabonete", quantidade: 3, unidade: "unidade", custo: 9.0 },
    { item: "Fralda descartável", quantidade: 1, unidade: "pacote", custo: 28.0 },
  ],
};

const catalogoItens: { nome: string; unidade: string; custo: number }[] = [
  { nome: "Arroz 5kg", unidade: "pacote", custo: 24.0 },
  { nome: "Feijão 1kg", unidade: "pacote", custo: 8.5 },
  { nome: "Óleo 900ml", unidade: "unidade", custo: 7.5 },
  { nome: "Macarrão", unidade: "pacote", custo: 4.2 },
  { nome: "Açúcar 1kg", unidade: "pacote", custo: 5.5 },
  { nome: "Café 500g", unidade: "pacote", custo: 16.0 },
  { nome: "Leite em pó", unidade: "unidade", custo: 18.0 },
  { nome: "Sabonete", unidade: "unidade", custo: 3.0 },
  { nome: "Fralda descartável", unidade: "pacote", custo: 28.0 },
];

const saldoEstoque: Record<string, number> = {
  "Arroz 5kg": 200,
  "Feijão 1kg": 80,
  "Óleo 900ml": 15,
  Macarrão: 100,
  "Açúcar 1kg": 60,
  "Café 500g": 40,
  "Leite em pó": 25,
  Sabonete: 90,
  "Fralda descartável": 12,
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ComposicaoPage() {
  const [beneficio, setBeneficio] = useState<BeneficioKey>("padrao");
  const [beneficioMontagem, setBeneficioMontagem] = useState<BeneficioKey>("padrao");
  const [quantidade, setQuantidade] = useState<number>(30);
  const [composicoes, setComposicoes] =
    useState<Record<BeneficioKey, ItemComposicao[]>>(composicoesIniciais);

  const [novoItem, setNovoItem] = useState("");
  const [novaQtd, setNovaQtd] = useState<string>("");
  const [novaUnidade, setNovaUnidade] = useState("");
  const [novoCusto, setNovoCusto] = useState<string>("");
  const [editandoItem, setEditandoItem] = useState<string | null>(null);

  const itens = composicoes[beneficio];
  const custoTotal = useMemo(
    () => itens.reduce((s, i) => s + i.custo * i.quantidade, 0),
    [itens],
  );

  const resetForm = () => {
    setNovoItem("");
    setNovaQtd("");
    setNovaUnidade("");
    setNovoCusto("");
    setEditandoItem(null);
  };

  const handleSelectItem = (nome: string) => {
    setNovoItem(nome);
    const c = catalogoItens.find((i) => i.nome === nome);
    if (c) {
      if (!novaUnidade) setNovaUnidade(c.unidade);
      if (!novoCusto) setNovoCusto(c.custo.toFixed(2));
    }
  };

  const podeAdicionar =
    novoItem.trim() !== "" && Number(novaQtd) > 0 && novaUnidade.trim() !== "";

  const handleAdicionar = () => {
    if (!podeAdicionar) return;
    const jaExiste = itens.some((i) => i.item === novoItem);
    if (jaExiste && editandoItem !== novoItem) {
      toast.error("Item já existe na composição deste benefício.");
      return;
    }
    const novo: ItemComposicao = {
      item: novoItem,
      quantidade: Number(novaQtd),
      unidade: novaUnidade,
      custo: Number(novoCusto) || 0,
    };
    setComposicoes((prev) => {
      const list = prev[beneficio];
      const next = editandoItem
        ? list.map((i) => (i.item === editandoItem ? novo : i))
        : [...list, novo];
      return { ...prev, [beneficio]: next };
    });
    toast.success(editandoItem ? "Item atualizado." : "Item adicionado à composição.");
    resetForm();
  };

  const handleEditar = (item: ItemComposicao) => {
    setEditandoItem(item.item);
    setNovoItem(item.item);
    setNovaQtd(String(item.quantidade));
    setNovaUnidade(item.unidade);
    setNovoCusto(item.custo.toFixed(2));
  };

  const handleExcluir = (nome: string) => {
    setComposicoes((prev) => ({
      ...prev,
      [beneficio]: prev[beneficio].filter((i) => i.item !== nome),
    }));
    if (editandoItem === nome) resetForm();
    toast("Item removido da composição.");
  };

  const handleSalvar = () => {
    toast.success("Composição salva no modo demonstração.");
  };

  const preview = useMemo(() => {
    const c = composicoes[beneficioMontagem];
    return c.map((i) => {
      const total = i.quantidade * quantidade;
      const saldo = saldoEstoque[i.item] ?? 0;
      const depois = saldo - total;
      let status: "ok" | "atencao" | "sem" = "ok";
      if (depois < 0) status = "sem";
      else if (depois <= total * 0.5) status = "atencao";
      return { ...i, total, saldo, depois, status };
    });
  }, [beneficioMontagem, quantidade, composicoes]);

  const temFalta = preview.some((p) => p.status === "sem");

  return (
    <AppShell title="Composição por benefício">
      <p className="mb-4 text-sm text-muted-foreground">
        Configure os itens que compõem cada cesta ou benefício do SEAC.
      </p>

      {/* Cards de resumo */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <ResumoCard icon={<ShoppingBasket className="h-5 w-5" />} label="Benefícios configurados" value="3" hint="benefícios" tone="emerald" />
        <ResumoCard icon={<Users className="h-5 w-5" />} label="Itens na Cesta Padrão" value={String(composicoes.padrao.length)} hint="itens" tone="teal" />
        <ResumoCard icon={<Users className="h-5 w-5" />} label="Itens na Cesta Extra" value={String(composicoes.extra.length)} hint="itens" tone="teal" />
        <ResumoCard icon={<ShoppingBasket className="h-5 w-5" />} label="Custo médio Cesta Padrão" value="R$ 85,00" hint="por cesta" tone="emerald" />
        <ResumoCard icon={<ShoppingBasket className="h-5 w-5" />} label="Custo médio Cesta Extra" value="R$ 60,00" hint="por cesta" tone="emerald" />
        <ResumoCard icon={<AlertTriangle className="h-5 w-5" />} label="Alertas de estoque" value="2" hint="itens com atenção" tone="amber" />
      </div>

      <Tabs defaultValue="composicao">
        <TabsList>
          <TabsTrigger value="composicao">Composição do benefício</TabsTrigger>
          <TabsTrigger value="montagem">Montagem de cestas</TabsTrigger>
        </TabsList>

        {/* Composição */}
        <TabsContent value="composicao" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Composição do benefício</p>
                    <p className="text-xs text-muted-foreground">
                      Esta configuração define os itens que compõem cada benefício. A alteração não movimenta estoque automaticamente.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSalvar}>Salvar composição</Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Benefício</Label>
                    <Select value={beneficio} onValueChange={(v) => { setBeneficio(v as BeneficioKey); resetForm(); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="padrao">Cesta Padrão</SelectItem>
                        <SelectItem value="extra">Cesta Extra</SelectItem>
                        <SelectItem value="gestante">Kit Gestante</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantidade por cesta</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Custo estimado</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                            Nenhum item na composição. Use o formulário abaixo para adicionar.
                          </TableCell>
                        </TableRow>
                      ) : itens.map((i) => (
                        <TableRow key={i.item}>
                          <TableCell className="font-medium">{i.item}</TableCell>
                          <TableCell>{i.quantidade}</TableCell>
                          <TableCell>{i.unidade}</TableCell>
                          <TableCell>{brl(i.custo)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditar(i)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExcluir(i.item)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
                  Custo estimado da {beneficioNomes[beneficio]}:{" "}
                  <span className="font-semibold text-primary">{brl(custoTotal)}</span>
                </div>

                {/* Adicionar item à composição */}
                <div className="rounded-md border p-3">
                  <p className="mb-2 text-xs font-semibold">
                    {editandoItem ? `Editar item: ${editandoItem}` : "Adicionar item à composição"}
                  </p>
                  <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Item</Label>
                      <Select value={novoItem} onValueChange={handleSelectItem}>
                        <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
                        <SelectContent>
                          {catalogoItens.map((c) => (
                            <SelectItem key={c.nome} value={c.nome}>{c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Quantidade</Label>
                      <Input type="number" min={1} placeholder="Ex.: 1" value={novaQtd} onChange={(e) => setNovaQtd(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Unidade</Label>
                      <Select value={novaUnidade} onValueChange={setNovaUnidade}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unidade">unidade</SelectItem>
                          <SelectItem value="pacote">pacote</SelectItem>
                          <SelectItem value="caixa">caixa</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="litro">litro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Custo estimado</Label>
                      <Input type="number" step="0.01" min={0} placeholder="0,00" value={novoCusto} onChange={(e) => setNovoCusto(e.target.value)} />
                    </div>
                    <div className="flex items-end gap-2">
                      {editandoItem && (
                        <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                      )}
                      <Button className="w-full gap-2" disabled={!podeAdicionar} onClick={handleAdicionar}>
                        <Plus className="h-4 w-4" /> {editandoItem ? "Salvar" : "Adicionar"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comparativo dos benefícios */}
            <Card>
              <CardContent className="space-y-3 p-4">
                <p className="text-sm font-semibold">Comparativo dos benefícios</p>
                <BeneficioMini icon={<ShoppingBasket className="h-4 w-4" />} nome="Cesta Padrão" tag="Cadastro definitivo" itens={composicoes.padrao.length} custo={brl(composicoes.padrao.reduce((s, i) => s + i.custo * i.quantidade, 0))} tone="emerald" />
                <BeneficioMini icon={<ShoppingBasket className="h-4 w-4" />} nome="Cesta Extra" tag="Cadastro em avaliação" itens={composicoes.extra.length} custo={brl(composicoes.extra.reduce((s, i) => s + i.custo * i.quantidade, 0))} tone="amber" />
                <BeneficioMini icon={<Users className="h-4 w-4" />} nome="Kit Gestante" tag="Benefício específico" itens={composicoes.gestante.length} custo={brl(composicoes.gestante.reduce((s, i) => s + i.custo * i.quantidade, 0))} tone="violet" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Montagem */}
        <TabsContent value="montagem" className="mt-4">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="text-sm font-semibold">Montagem de cestas / benefícios</p>
                <p className="text-xs text-muted-foreground">
                  Visualize o consumo dos itens e o impacto no estoque antes de montar as cestas.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Benefício</Label>
                  <Select value={beneficioMontagem} onValueChange={(v) => setBeneficioMontagem(v as BeneficioKey)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padrao">Cesta Padrão</SelectItem>
                      <SelectItem value="extra">Cesta Extra</SelectItem>
                      <SelectItem value="gestante">Kit Gestante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Quantidade a montar</Label>
                  <Input type="number" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value) || 0)} />
                </div>
                <div className="flex items-end">
                  <Button className="w-full">Montar preview</Button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Itens que serão consumidos</p>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Qtd. por cesta</TableHead>
                          <TableHead>Qtd. total necessária</TableHead>
                          <TableHead>Saldo atual</TableHead>
                          <TableHead>Saldo após montagem</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((p) => (
                          <TableRow key={p.item}>
                            <TableCell className="font-medium">{p.item}</TableCell>
                            <TableCell>{p.quantidade}</TableCell>
                            <TableCell>{p.total}</TableCell>
                            <TableCell>{p.saldo}</TableCell>
                            <TableCell className={p.depois < 0 ? "font-semibold text-red-600" : ""}>{p.depois}</TableCell>
                            <TableCell><StatusBadge status={p.status} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="space-y-3">
                  {temFalta ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600" />
                        <div>
                          <p className="text-sm font-semibold text-red-700">Não é possível montar esta quantidade.</p>
                          <p className="text-xs text-red-600">Existem itens com saldo insuficiente.</p>
                        </div>
                      </div>
                      <ul className="mt-2 space-y-1 text-xs">
                        {preview.filter((p) => p.status !== "ok").map((p) => (
                          <li key={p.item} className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${p.status === "sem" ? "bg-red-500" : "bg-amber-500"}`} />
                            <span className="font-medium">{p.item}</span>
                            <span className="text-muted-foreground">
                              {p.status === "sem"
                                ? `Faltam ${Math.abs(p.depois)} unidades`
                                : `Saldo ficará baixo (${p.depois} unidades)`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                      Todos os itens têm saldo suficiente para a montagem.
                    </div>
                  )}

                  <Button
                    disabled={temFalta}
                    className="w-full gap-2"
                  >
                    <ShoppingBasket className="h-4 w-4" /> Montar cestas
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                A montagem de cestas consumirá itens do estoque e aumentará o saldo do benefício montado futuramente. Nesta etapa, é apenas visual.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function ResumoCard({
  icon, label, value, hint, tone,
}: {
  icon: React.ReactNode; label: string; value: string; hint?: string;
  tone: "emerald" | "teal" | "amber" | "violet" | "sky";
}) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    teal: "bg-teal-50 text-teal-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    sky: "bg-sky-50 text-sky-600",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${tones[tone]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold leading-tight">{value}</p>
          {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function BeneficioMini({
  icon, nome, tag, itens, custo, tone,
}: {
  icon: React.ReactNode; nome: string; tag: string; itens: number; custo: string;
  tone: "emerald" | "amber" | "violet" | "sky";
}) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
  };
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-md ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{nome}</p>
          <Badge variant="outline" className="text-[10px]">{tag}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{itens} itens</p>
        <p className="text-xs text-muted-foreground">Custo estimado: <span className="font-medium text-foreground">{custo}</span></p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "ok" | "atencao" | "sem" }) {
  if (status === "ok") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">OK</Badge>;
  if (status === "atencao") return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Atenção</Badge>;
  return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Sem estoque suficiente</Badge>;
}
