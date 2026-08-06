import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Package, Pencil, Plus, ShoppingBasket, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { emAlerta, statusEstoque } from "@/lib/estoque/status-estoque";
import {
  useBeneficiosEstoque,
  useComposicoes,
  useDefinirComposicaoBeneficio,
  useItensEstoque,
  useMontarCesta,
  useMovimentacoesItens,
  useRegistrarMovimentacaoItem,
} from "@/lib/estoque/use-estoque-supabase";
import type { ItemEstoque } from "@/lib/familias/familias-supabase-types";

export const Route = createFileRoute("/composicao-cesta")({
  head: () => ({ meta: [{ title: "Itens e composição — SEAC Social" }] }),
  component: ComposicaoPage,
});

/** Movimentação manual de item: entrada e saída somam/subtraem, ajuste define o saldo. */
type FormMovItem = {
  tipo: "entrada" | "saida" | "ajuste";
  itemId: string;
  quantidade: string;
  motivo: string;
  observacao: string;
};

const formMovVazio: FormMovItem = {
  tipo: "entrada",
  itemId: "",
  quantidade: "",
  motivo: "",
  observacao: "",
};

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Linha editável da composição (referência ao catálogo + quantidade por cesta). */
type LinhaComposicao = { itemId: string; quantidade: number };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ComposicaoPage() {
  const beneficiosQuery = useBeneficiosEstoque();
  const itensQuery = useItensEstoque();
  const composicoesQuery = useComposicoes();
  const definirComposicao = useDefinirComposicaoBeneficio();
  const montarCesta = useMontarCesta();
  const movimentacoesItensQuery = useMovimentacoesItens();
  const registrarMovItem = useRegistrarMovimentacaoItem();

  const beneficios = useMemo(() => beneficiosQuery.data ?? [], [beneficiosQuery.data]);
  const itens = useMemo(() => itensQuery.data ?? [], [itensQuery.data]);

  const itemPorId = useMemo(() => {
    const m = new Map<string, ItemEstoque>();
    for (const it of itens) m.set(it.id, it);
    return m;
  }, [itens]);

  // Composição salva no servidor, por benefício.
  const composicaoServidor = useMemo(() => {
    const m = new Map<string, LinhaComposicao[]>();
    for (const c of composicoesQuery.data ?? []) {
      m.set(
        c.beneficioId,
        c.itens.map((i) => ({ itemId: i.itemId, quantidade: i.quantidade })),
      );
    }
    return m;
  }, [composicoesQuery.data]);

  const [beneficioId, setBeneficioId] = useState<string>("");
  const [beneficioMontagem, setBeneficioMontagem] = useState<string>("");
  const [quantidade, setQuantidade] = useState<number>(30);

  // Rascunho local por benefício; ausente = usa o que está salvo no servidor.
  const [rascunho, setRascunho] = useState<Record<string, LinhaComposicao[]>>({});

  // Formulário de item.
  const [novoItemId, setNovoItemId] = useState("");
  const [novaQtd, setNovaQtd] = useState<string>("");
  const [editandoItemId, setEditandoItemId] = useState<string | null>(null);

  // Movimentação manual de item (entrada/saída/ajuste).
  const [movAberto, setMovAberto] = useState(false);
  const [formMov, setFormMov] = useState<FormMovItem>(formMovVazio);
  const setMov = <K extends keyof FormMovItem>(k: K, v: FormMovItem[K]) =>
    setFormMov((f) => ({ ...f, [k]: v }));

  // Seleciona o primeiro benefício quando a lista carrega.
  useEffect(() => {
    if (beneficios.length === 0) return;
    setBeneficioId((atual) => atual || beneficios[0].id);
    setBeneficioMontagem((atual) => atual || beneficios[0].id);
  }, [beneficios]);

  const resetForm = () => {
    setNovoItemId("");
    setNovaQtd("");
    setEditandoItemId(null);
  };

  const linhasBeneficio = (id: string): LinhaComposicao[] =>
    rascunho[id] ?? composicaoServidor.get(id) ?? [];

  const linhas = linhasBeneficio(beneficioId);
  const temRascunho = rascunho[beneficioId] !== undefined;

  const custoLinha = (l: LinhaComposicao) => (itemPorId.get(l.itemId)?.valor ?? 0) * l.quantidade;
  const custoBeneficio = (id: string) => linhasBeneficio(id).reduce((s, l) => s + custoLinha(l), 0);
  const custoTotal = linhas.reduce((s, l) => s + custoLinha(l), 0);

  const nomeBeneficio = (id: string) => beneficios.find((b) => b.id === id)?.nome ?? "—";

  const setLinhas = (id: string, next: LinhaComposicao[]) =>
    setRascunho((prev) => ({ ...prev, [id]: next }));

  const itemSelecionado = itemPorId.get(novoItemId);
  const podeAdicionar = novoItemId !== "" && Number(novaQtd) > 0;

  const handleSelectItem = (id: string) => setNovoItemId(id);

  const handleAdicionar = () => {
    if (!podeAdicionar) return;
    const jaExiste = linhas.some((l) => l.itemId === novoItemId);
    if (jaExiste && editandoItemId !== novoItemId) {
      toast.error("Item já existe na composição deste benefício.");
      return;
    }
    const nova: LinhaComposicao = { itemId: novoItemId, quantidade: Number(novaQtd) };
    const next = editandoItemId
      ? linhas.map((l) => (l.itemId === editandoItemId ? nova : l))
      : [...linhas, nova];
    setLinhas(beneficioId, next);
    // Adicionar/editar mexe só no rascunho local: sem dizer isso, o toast verde
    // passa a impressão de que a composição já foi gravada.
    toast.warning(
      editandoItemId
        ? "Item atualizado no rascunho — clique em Salvar composição para gravar."
        : "Item adicionado ao rascunho — clique em Salvar composição para gravar.",
    );
    resetForm();
  };

  const handleEditar = (l: LinhaComposicao) => {
    setEditandoItemId(l.itemId);
    setNovoItemId(l.itemId);
    setNovaQtd(String(l.quantidade));
  };

  const handleExcluir = (itemId: string) => {
    setLinhas(
      beneficioId,
      linhas.filter((l) => l.itemId !== itemId),
    );
    if (editandoItemId === itemId) resetForm();
    toast("Item removido da composição.");
  };

  const handleSalvar = () => {
    if (!beneficioId) return;
    definirComposicao.mutate(
      { beneficioId, itens: linhas.map((l) => ({ itemId: l.itemId, quantidade: l.quantidade })) },
      {
        onSuccess: () => {
          // Descarta o rascunho para voltar a refletir o servidor (refetch).
          setRascunho((prev) => {
            const { [beneficioId]: _descartado, ...resto } = prev;
            void _descartado;
            return resto;
          });
          resetForm();
          toast.success("Composição salva.");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao salvar."),
      },
    );
  };

  // Preview de montagem sobre a composição SALVA (é ela que a RPC consome).
  const preview = useMemo(() => {
    const lista = composicaoServidor.get(beneficioMontagem) ?? [];
    return lista.map((l) => {
      const item = itemPorId.get(l.itemId);
      const total = Math.ceil(l.quantidade * quantidade);
      const saldo = item?.saldo ?? 0;
      const depois = saldo - total;
      let status: "ok" | "atencao" | "sem" = "ok";
      if (depois < 0) status = "sem";
      else if (depois <= total * 0.5) status = "atencao";
      return {
        itemId: l.itemId,
        nome: item?.nome ?? "—",
        quantidade: l.quantidade,
        total,
        saldo,
        depois,
        status,
      };
    });
  }, [beneficioMontagem, quantidade, composicaoServidor, itemPorId]);

  const temFalta = preview.some((p) => p.status === "sem");
  const semComposicaoMontagem = preview.length === 0;
  // A montagem consome a composição SALVA; rascunho pendente engana quem acabou
  // de editar a receita e vem direto montar.
  const rascunhoPendenteMontagem = rascunho[beneficioMontagem] !== undefined;

  const handleMontar = () => {
    if (!beneficioMontagem || quantidade <= 0) return;
    montarCesta.mutate(
      { beneficioId: beneficioMontagem, quantidade },
      {
        onSuccess: (data) =>
          toast.success(
            `Montagem concluída: ${quantidade} ${nomeBeneficio(beneficioMontagem)}. ` +
              `Saldo do benefício: ${data?.beneficio_saldo ?? "—"}.`,
          ),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Falha ao montar cestas."),
      },
    );
  };

  const carregando =
    beneficiosQuery.isLoading || itensQuery.isLoading || composicoesQuery.isLoading;
  const erro = beneficiosQuery.error ?? itensQuery.error ?? composicoesQuery.error;

  const alertasEstoque = itens.filter((i) => emAlerta(i.saldo, i.minimo)).length;

  const abrirMov = (tipo: FormMovItem["tipo"]) => {
    setFormMov({ ...formMovVazio, tipo, itemId: itens[0]?.id ?? "" });
    setMovAberto(true);
  };

  const salvarMovItem = async () => {
    const qtd = Number(formMov.quantidade);
    if (!formMov.itemId) {
      toast.error("Selecione o item.");
      return;
    }
    if (!Number.isFinite(qtd) || qtd < 0 || (formMov.tipo !== "ajuste" && qtd <= 0)) {
      toast.error("Informe uma quantidade válida.");
      return;
    }
    // O motivo é o que separa a carga inicial do movimento do dia a dia no ledger.
    if (formMov.tipo === "ajuste" && formMov.motivo.trim() === "") {
      toast.error("Informe o motivo do ajuste (ex.: Inventário inicial 2026-08-06).");
      return;
    }
    try {
      const data = await registrarMovItem.mutateAsync({
        itemId: formMov.itemId,
        tipo: formMov.tipo,
        quantidade: qtd,
        motivo: formMov.motivo,
        observacao: formMov.observacao,
      });
      toast.success(`Movimentação registrada. Saldo atual: ${data.saldo_resultante}.`);
      setMovAberto(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível registrar a movimentação.",
      );
    }
  };

  return (
    <AppShell title="Itens e composição">
      <p className="mb-4 text-sm text-muted-foreground">
        Controle o estoque físico de itens, defina o que compõe cada cesta ou benefício do SEAC e
        monte as cestas consumindo esse estoque.
      </p>

      {erro ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não foi possível carregar os dados: {erro.message}
        </div>
      ) : carregando ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          Carregando dados do Supabase…
        </div>
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <ResumoCard
              icon={<ShoppingBasket className="h-5 w-5" />}
              label="Benefícios configurados"
              value={String(beneficios.length)}
              hint="benefícios"
              tone="emerald"
            />
            <ResumoCard
              icon={<Package className="h-5 w-5" />}
              label="Itens no catálogo"
              value={String(itens.length)}
              hint="itens"
              tone="teal"
            />
            <ResumoCard
              icon={<Users className="h-5 w-5" />}
              label={`Itens em ${nomeBeneficio(beneficioId)}`}
              value={String(linhas.length)}
              hint="itens na composição"
              tone="teal"
            />
            <ResumoCard
              icon={<ShoppingBasket className="h-5 w-5" />}
              label={`Custo estimado ${nomeBeneficio(beneficioId)}`}
              value={brl(custoTotal)}
              hint="por unidade"
              tone="emerald"
            />
            <ResumoCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Alertas de estoque"
              value={String(alertasEstoque)}
              hint="itens abaixo do mínimo"
              tone="amber"
            />
          </div>

          <Tabs defaultValue="itens">
            <TabsList>
              <TabsTrigger value="itens">Estoque de itens</TabsTrigger>
              <TabsTrigger value="composicao">Composição do benefício</TabsTrigger>
              <TabsTrigger value="montagem">Montagem de cestas</TabsTrigger>
            </TabsList>

            {/* Estoque físico de itens: saldos, lançamentos e histórico */}
            <TabsContent value="itens" className="mt-4 space-y-4">
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Estoque de itens</p>
                      <p className="text-xs text-muted-foreground">
                        É o estoque físico recebido em doação. As cestas saem daqui: só é possível
                        montar enquanto houver item suficiente.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" className="gap-2" onClick={() => abrirMov("entrada")}>
                        <Plus className="h-4 w-4" /> Nova entrada
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => abrirMov("saida")}>
                        Nova saída
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => abrirMov("ajuste")}>
                        Ajuste / inventário
                      </Button>
                    </div>
                  </div>

                  {itens.length === 0 ? (
                    <p className="rounded-md border p-8 text-center text-sm text-muted-foreground">
                      Nenhum item no catálogo. Cadastre em Configurações → Itens.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Unidade</TableHead>
                          <TableHead>Saldo</TableHead>
                          <TableHead>Mínimo</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itens.map((i) => (
                          <TableRow key={i.id}>
                            <TableCell className="text-sm font-medium">{i.nome}</TableCell>
                            <TableCell className="text-sm">{i.categoria ?? "—"}</TableCell>
                            <TableCell className="text-sm">{i.unidade}</TableCell>
                            <TableCell className="text-sm">{i.saldo}</TableCell>
                            <TableCell className="text-sm">{i.minimo}</TableCell>
                            <TableCell>
                              <SaldoBadge status={statusEstoque(i.saldo, i.minimo)} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div>
                    <p className="text-sm font-semibold">Movimentações de itens</p>
                    <p className="text-xs text-muted-foreground">
                      Inclui o consumo da montagem de cestas e as entradas geradas por recebimentos
                      vinculados ao catálogo.
                    </p>
                  </div>
                  {movimentacoesItensQuery.isLoading ? (
                    <p className="p-6 text-center text-sm text-muted-foreground">Carregando…</p>
                  ) : movimentacoesItensQuery.isError ? (
                    <p className="p-6 text-center text-sm text-destructive">
                      Não foi possível carregar as movimentações de itens.
                    </p>
                  ) : (movimentacoesItensQuery.data ?? []).length === 0 ? (
                    <p className="p-6 text-center text-sm text-muted-foreground">
                      Nenhuma movimentação de item registrada.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Qtd.</TableHead>
                          <TableHead>Saldo</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(movimentacoesItensQuery.data ?? []).map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="text-sm">
                              {formatarDataHora(m.criadoEm)}
                            </TableCell>
                            <TableCell className="text-sm">{m.itemNome}</TableCell>
                            <TableCell className="text-sm capitalize">{m.tipo}</TableCell>
                            <TableCell className="text-sm">
                              {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                            </TableCell>
                            <TableCell className="text-sm">{m.saldoResultante}</TableCell>
                            <TableCell className="text-sm">{m.motivo ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Composição */}
            <TabsContent value="composicao" className="mt-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <Card>
                  <CardContent className="space-y-4 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Composição do benefício</p>
                        <p className="text-xs text-muted-foreground">
                          Define os itens que compõem cada benefício. A alteração não movimenta
                          estoque — isso acontece na montagem.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {temRascunho ? (
                          <Badge className="gap-1 bg-amber-100 text-[10px] text-amber-800 hover:bg-amber-100">
                            <AlertTriangle className="h-3 w-3" />
                            Alterações não salvas
                          </Badge>
                        ) : null}
                        <Button
                          size="sm"
                          onClick={handleSalvar}
                          disabled={definirComposicao.isPending || !beneficioId}
                        >
                          {definirComposicao.isPending ? "Salvando…" : "Salvar composição"}
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Benefício</Label>
                        <Select
                          value={beneficioId}
                          onValueChange={(v) => {
                            setBeneficioId(v);
                            resetForm();
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {beneficios.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.nome}
                              </SelectItem>
                            ))}
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
                          {linhas.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="py-8 text-center text-sm text-muted-foreground"
                              >
                                Nenhum item na composição. Use o formulário abaixo para adicionar.
                              </TableCell>
                            </TableRow>
                          ) : (
                            linhas.map((l) => {
                              const item = itemPorId.get(l.itemId);
                              return (
                                <TableRow key={l.itemId}>
                                  <TableCell className="font-medium">{item?.nome ?? "—"}</TableCell>
                                  <TableCell>{l.quantidade}</TableCell>
                                  <TableCell>{item?.unidade ?? ""}</TableCell>
                                  <TableCell>{brl(custoLinha(l))}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleEditar(l)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleExcluir(l.itemId)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
                      Custo estimado da {nomeBeneficio(beneficioId)}:{" "}
                      <span className="font-semibold text-primary">{brl(custoTotal)}</span>
                    </div>

                    {/* Adicionar item à composição */}
                    <div className="rounded-md border p-3">
                      <p className="mb-2 text-xs font-semibold">
                        {editandoItemId
                          ? `Editar item: ${itemPorId.get(editandoItemId)?.nome ?? ""}`
                          : "Adicionar item à composição"}
                      </p>
                      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Item</Label>
                          <Select value={novoItemId} onValueChange={handleSelectItem}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o item" />
                            </SelectTrigger>
                            <SelectContent>
                              {itens.map((it) => (
                                <SelectItem key={it.id} value={it.id}>
                                  {it.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Quantidade</Label>
                          <Input
                            type="number"
                            min={1}
                            placeholder="Ex.: 1"
                            value={novaQtd}
                            onChange={(e) => setNovaQtd(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Unidade / custo</Label>
                          <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-xs text-muted-foreground">
                            {itemSelecionado
                              ? `${itemSelecionado.unidade} · ${brl(itemSelecionado.valor)}`
                              : "—"}
                          </div>
                        </div>
                        <div className="flex items-end gap-2">
                          {editandoItemId && (
                            <Button type="button" variant="outline" onClick={resetForm}>
                              Cancelar
                            </Button>
                          )}
                          <Button
                            className="w-full gap-2"
                            disabled={!podeAdicionar}
                            onClick={handleAdicionar}
                          >
                            <Plus className="h-4 w-4" /> {editandoItemId ? "Salvar" : "Adicionar"}
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
                    {beneficios.map((b, idx) => (
                      <BeneficioMini
                        key={b.id}
                        icon={
                          idx % 2 === 0 ? (
                            <ShoppingBasket className="h-4 w-4" />
                          ) : (
                            <Users className="h-4 w-4" />
                          )
                        }
                        nome={b.nome}
                        tag={`Saldo pronto: ${b.saldo}`}
                        itens={linhasBeneficio(b.id).length}
                        custo={brl(custoBeneficio(b.id))}
                        tone={(["emerald", "amber", "violet", "sky"] as const)[idx % 4]}
                      />
                    ))}
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
                      A montagem baixa os itens da composição e aumenta o saldo do benefício pronto.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Benefício</Label>
                      <Select value={beneficioMontagem} onValueChange={setBeneficioMontagem}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {beneficios.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Quantidade a montar</Label>
                      <Input
                        type="number"
                        min={1}
                        value={quantidade}
                        onChange={(e) => setQuantidade(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Itens que serão consumidos
                      </p>
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
                            {semComposicaoMontagem ? (
                              <TableRow>
                                <TableCell
                                  colSpan={6}
                                  className="py-8 text-center text-sm text-muted-foreground"
                                >
                                  {rascunhoPendenteMontagem
                                    ? "A composição editada ainda não foi salva — a montagem só enxerga o que está gravado."
                                    : "Este benefício não possui composição definida."}
                                </TableCell>
                              </TableRow>
                            ) : (
                              preview.map((p) => (
                                <TableRow key={p.itemId}>
                                  <TableCell className="font-medium">{p.nome}</TableCell>
                                  <TableCell>{p.quantidade}</TableCell>
                                  <TableCell>{p.total}</TableCell>
                                  <TableCell>{p.saldo}</TableCell>
                                  <TableCell
                                    className={p.depois < 0 ? "font-semibold text-red-600" : ""}
                                  >
                                    {p.depois}
                                  </TableCell>
                                  <TableCell>
                                    <StatusBadge status={p.status} />
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {rascunhoPendenteMontagem ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                            <div>
                              <p className="text-sm font-semibold text-amber-800">
                                Composição com alterações não salvas.
                              </p>
                              <p className="text-xs text-amber-700">
                                A montagem usa a composição gravada no servidor. Volte à aba
                                &quot;Composição do benefício&quot; e clique em Salvar composição.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {semComposicaoMontagem ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                          Defina a composição deste benefício antes de montar. Sem receita, o
                          servidor recusa a montagem.
                        </div>
                      ) : quantidade <= 0 ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                          Informe quantas unidades deseja montar.
                        </div>
                      ) : temFalta ? (
                        <div className="rounded-md border border-red-200 bg-red-50 p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600" />
                            <div>
                              <p className="text-sm font-semibold text-red-700">
                                Não é possível montar esta quantidade.
                              </p>
                              <p className="text-xs text-red-600">
                                Existem itens com saldo insuficiente.
                              </p>
                            </div>
                          </div>
                          <ul className="mt-2 space-y-1 text-xs">
                            {preview
                              .filter((p) => p.status !== "ok")
                              .map((p) => (
                                <li key={p.itemId} className="flex items-center gap-2">
                                  <span
                                    className={`h-2 w-2 rounded-full ${p.status === "sem" ? "bg-red-500" : "bg-amber-500"}`}
                                  />
                                  <span className="font-medium">{p.nome}</span>
                                  <span className="text-muted-foreground">
                                    {p.status === "sem"
                                      ? `Faltam ${Math.abs(p.depois)} — precisa de ${p.total}, saldo atual ${p.saldo}`
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
                        disabled={
                          semComposicaoMontagem ||
                          temFalta ||
                          quantidade <= 0 ||
                          montarCesta.isPending
                        }
                        className="w-full gap-2"
                        onClick={handleMontar}
                      >
                        <ShoppingBasket className="h-4 w-4" />
                        {montarCesta.isPending ? "Montando…" : "Montar cestas"}
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    A montagem baixa os itens da composição do estoque e aumenta o saldo do
                    benefício pronto, registrando a movimentação em Estoque.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      <Sheet open={movAberto} onOpenChange={setMovAberto}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {formMov.tipo === "entrada"
                ? "Nova entrada de item"
                : formMov.tipo === "saida"
                  ? "Nova saída de item"
                  : "Ajuste de saldo do item"}
            </SheetTitle>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label>Item</Label>
              <Select value={formMov.itemId} onValueChange={(v) => setMov("itemId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {itens.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nome} (saldo {i.saldo} {i.unidade})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{formMov.tipo === "ajuste" ? "Novo saldo" : "Quantidade"}</Label>
              <Input
                type="number"
                min={0}
                value={formMov.quantidade}
                onChange={(e) => setMov("quantidade", e.target.value)}
              />
              {formMov.tipo === "ajuste" ? (
                <p className="text-xs text-muted-foreground">
                  No ajuste, informe a quantidade contada — ela vira o saldo do item.
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label>Motivo{formMov.tipo === "ajuste" ? " *" : ""}</Label>
              <Input
                value={formMov.motivo}
                onChange={(e) => setMov("motivo", e.target.value)}
                placeholder={
                  formMov.tipo === "ajuste" ? "Ex.: Inventário inicial 2026-08-06" : undefined
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Observação</Label>
              <Textarea
                rows={3}
                value={formMov.observacao}
                onChange={(e) => setMov("observacao", e.target.value)}
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setMovAberto(false)}>
              Cancelar
            </Button>
            <Button disabled={registrarMovItem.isPending} onClick={() => void salvarMovItem()}>
              {registrarMovItem.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function SaldoBadge({ status }: { status: ReturnType<typeof statusEstoque> }) {
  if (status === "Em estoque")
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{status}</Badge>;
  if (status === "Atenção")
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{status}</Badge>;
  return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{status}</Badge>;
}

function ResumoCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
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
  icon,
  nome,
  tag,
  itens,
  custo,
  tone,
}: {
  icon: React.ReactNode;
  nome: string;
  tag: string;
  itens: number;
  custo: string;
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
      <div className={`flex h-9 w-9 items-center justify-center rounded-md ${tones[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{nome}</p>
          <Badge variant="outline" className="text-[10px]">
            {tag}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{itens} itens</p>
        <p className="text-xs text-muted-foreground">
          Custo estimado: <span className="font-medium text-foreground">{custo}</span>
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "ok" | "atencao" | "sem" }) {
  if (status === "ok")
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">OK</Badge>;
  if (status === "atencao")
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Atenção</Badge>;
  return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Sem estoque suficiente</Badge>;
}
