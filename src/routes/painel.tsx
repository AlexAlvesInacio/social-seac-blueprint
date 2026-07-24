import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Users,
  UserRound,
  Package,
  Truck,
  Calendar,
  AlertTriangle,
  PhoneCall,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useBeneficiosEstoque,
  useEntregasPainel,
  useFamiliasSupabase,
  useMovimentacoesEstoque,
} from "@/lib/familias/use-familias-supabase";
import type {
  BeneficioEstoque,
  EntregaPainel,
  FamiliaSupabaseReadModel,
  MovimentacaoEstoque,
} from "@/lib/familias/familias-supabase-types";

export const Route = createFileRoute("/painel")({
  head: () => ({ meta: [{ title: "Painel — SEAC Social" }] }),
  component: PainelPage,
});

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function daysAgo(n: number): Date {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - n);
  return d;
}

type StatusEstoque = "Em estoque" | "Atenção" | "Estoque baixo" | "Sem estoque";
function statusEstoque(saldo: number, minimo: number): StatusEstoque {
  if (saldo <= 0) return "Sem estoque";
  if (minimo > 0 && saldo < minimo * 0.5) return "Estoque baixo";
  if (minimo > 0 && saldo < minimo) return "Atenção";
  return "Em estoque";
}

function trend(current: number, previous: number): { label: string; dir: "up" | "down" | "flat" } {
  if (previous === 0 && current === 0) return { label: "sem histórico", dir: "flat" };
  if (previous === 0) return { label: "novo período", dir: "up" };
  const pct = Math.round(((current - previous) / previous) * 100);
  return {
    label: `${pct >= 0 ? "+" : ""}${pct}% vs período anterior`,
    dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
  };
}

function computarDados(
  familias: FamiliaSupabaseReadModel[],
  beneficios: BeneficioEstoque[],
  entregas: EntregaPainel[],
  movimentacoes: MovimentacaoEstoque[],
) {
  const hoje = startOfDay(new Date());
  const iniMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ini30 = daysAgo(30);
  const ini60 = daysAgo(60);
  const parse = (iso: string) => new Date(iso);

  const entregasHoje = entregas.filter(
    (e) => startOfDay(parse(e.criadoEm)).getTime() === hoje.getTime(),
  );
  const entregasMes = entregas.filter((e) => parse(e.criadoEm) >= iniMes);
  const entregas30 = entregas.filter((e) => parse(e.criadoEm) >= ini30);
  const entregas30Prev = entregas.filter((e) => {
    const d = parse(e.criadoEm);
    return d >= ini60 && d < ini30;
  });

  const famAtend30 = new Set(entregas30.map((e) => e.familiaId));
  const famAtend30Prev = new Set(entregas30Prev.map((e) => e.familiaId));

  const cestasEstoque = beneficios.reduce((acc, b) => acc + b.saldo, 0);
  const assistidosAtivos = familias.reduce(
    (acc, f) => acc + f.assistidos.filter((a) => a.status === "ativo").length,
    0,
  );
  const aguardandoAvaliacao = familias.filter((f) => f.status === "avaliar");

  // Última entrega por família (dentro da janela) para o card de contato.
  const ultimaEntregaPorFamilia = new Map<string, Date>();
  for (const e of entregas) {
    const d = parse(e.criadoEm);
    const atual = ultimaEntregaPorFamilia.get(e.familiaId);
    if (!atual || d > atual) ultimaEntregaPorFamilia.set(e.familiaId, d);
  }
  const contatoNecessario = familias
    .filter((f) => f.acompanhamento === "sem_retirada_90")
    .map((f) => {
      const ult = ultimaEntregaPorFamilia.get(f.id) ?? null;
      const dias = ult ? Math.floor((hoje.getTime() - ult.getTime()) / 86400000) : null;
      return { f, dias };
    });

  // Perfil do público: conta sobre os membros de cada família (inclui o responsável).
  const publico = {
    criancas: 0,
    adolescentes: 0,
    adultos: 0,
    idosos: 0,
    gestantes: 0,
    pcd: 0,
    naoInformado: 0,
  };
  for (const f of familias) {
    for (const m of f.membros) {
      if (m.crianca) publico.criancas++;
      else if (m.adolescente) publico.adolescentes++;
      else if (m.idoso) publico.idosos++;
      else publico.adultos++;
      if (m.gestante) publico.gestantes++;
      if (m.pcd) publico.pcd++;
      publico.naoInformado++;
    }
  }

  const entregasPorDia: { dia: string; qtd: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i);
    const qtd = entregas.filter(
      (e) => startOfDay(parse(e.criadoEm)).getTime() === d.getTime(),
    ).length;
    if (qtd === 0) continue;
    const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    entregasPorDia.push({ dia: label, qtd });
  }

  const beneficiosNomes = beneficios.map((b) => b.nome);
  const entregasPorBeneficio = beneficiosNomes
    .map((nome) => ({
      name: nome,
      value: entregasMes.filter((e) => e.beneficioNome === nome).length,
    }))
    .filter((b) => b.value > 0);

  const statusFamilias = [
    { status: "Liberado", chave: "liberado", fill: "hsl(152 55% 42%)" },
    { status: "Bloqueado", chave: "bloqueado", fill: "hsl(0 72% 51%)" },
    { status: "Avaliar", chave: "avaliar", fill: "#E8712A" },
    { status: "Inativo", chave: "inativo", fill: "hsl(220 9% 55%)" },
  ].map((s) => ({
    status: s.status,
    fill: s.fill,
    qtd: familias.filter((f) => f.status === s.chave).length,
  }));

  const alertasEstoque = beneficios
    .map((b) => ({
      item: b.nome,
      saldo: b.saldo,
      minimo: b.minimo,
      status: statusEstoque(b.saldo, b.minimo),
    }))
    .filter((x) => x.status !== "Em estoque");

  return {
    contadores: {
      familiasCadastradas: familias.length,
      familiasAtendidas30: famAtend30.size,
      familiasAtendidas30Prev: famAtend30Prev.size,
      assistidosAtivos,
      entregasHoje: entregasHoje.length,
      entregasMes: entregasMes.length,
      cestasEstoque,
      aguardandoAvaliacao: aguardandoAvaliacao.length,
      contatoNecessario: contatoNecessario.length,
      entregas30: entregas30.length,
      entregas30Prev: entregas30Prev.length,
    },
    publico,
    entregasPorDia,
    entregasPorBeneficio,
    statusFamilias,
    alertasEstoque,
    ultimasEntregas: entregas.slice(0, 5),
    ultimasMovimentacoes: movimentacoes.slice(0, 5),
    aguardandoAvaliacao: aguardandoAvaliacao.slice(0, 6),
    contatoNecessario: contatoNecessario.slice(0, 6),
  };
}

function PainelPage() {
  const familias = useFamiliasSupabase();
  const beneficios = useBeneficiosEstoque();
  const movimentacoes = useMovimentacoesEstoque();
  const entregas = useEntregasPainel();

  const carregando =
    familias.isPending || beneficios.isPending || movimentacoes.isPending || entregas.isPending;
  const erro = familias.isError || beneficios.isError || movimentacoes.isError || entregas.isError;

  const dados = useMemo(
    () =>
      computarDados(
        familias.data ?? [],
        beneficios.data ?? [],
        entregas.data ?? [],
        movimentacoes.data ?? [],
      ),
    [familias.data, beneficios.data, entregas.data, movimentacoes.data],
  );

  if (carregando) {
    return (
      <AppShell title="Painel">
        <div className="p-8 text-sm text-muted-foreground">Carregando indicadores…</div>
      </AppShell>
    );
  }
  if (erro) {
    return (
      <AppShell title="Painel">
        <div className="p-8 text-sm text-destructive">
          Não foi possível carregar os indicadores. Verifique a conexão e tente novamente.
        </div>
      </AppShell>
    );
  }

  const c = dados.contadores;
  const tAtend = trend(c.familiasAtendidas30, c.familiasAtendidas30Prev);
  const tEntregas30 = trend(c.entregas30, c.entregas30Prev);

  const kpis = [
    {
      icon: Users,
      label: "Famílias cadastradas",
      value: c.familiasCadastradas,
      hint: "Total",
      tone: "bg-primary/10 text-primary",
    },
    {
      icon: Truck,
      label: "Famílias atendidas (30 dias)",
      value: c.familiasAtendidas30,
      hint: tAtend.label,
      tone: "bg-emerald-100 text-emerald-700",
      trend: tAtend,
    },
    {
      icon: UserRound,
      label: "Assistidos ativos",
      value: c.assistidosAtivos,
      hint: "Ativos",
      tone: "bg-sky-100 text-sky-700",
    },
    {
      icon: Calendar,
      label: "Entregas hoje",
      value: c.entregasHoje,
      hint: "Hoje",
      tone: "bg-amber-100 text-amber-700",
    },
    {
      icon: Truck,
      label: "Entregas no mês",
      value: c.entregasMes,
      hint: tEntregas30.label,
      tone: "bg-emerald-100 text-emerald-700",
      trend: tEntregas30,
    },
    {
      icon: Package,
      label: "Cestas em estoque",
      value: c.cestasEstoque,
      hint: "Benefícios entregáveis",
      tone: "bg-primary/10 text-primary",
    },
    {
      icon: ClipboardCheck,
      label: "Aguardando avaliação",
      value: c.aguardandoAvaliacao,
      hint: "Cadastro definitivo",
      tone: "bg-violet-100 text-violet-700",
    },
    {
      icon: PhoneCall,
      label: "Contato necessário 90+",
      value: c.contatoNecessario,
      hint: "Sem retirada",
      tone: "bg-red-100 text-red-700",
    },
  ];

  const perfil = [
    { label: "Mulheres", value: 0, hint: "Cadastro pendente" },
    { label: "Homens", value: 0, hint: "Cadastro pendente" },
    { label: "Não informado", value: dados.publico.naoInformado, hint: "Sem gênero cadastrado" },
    { label: "Crianças", value: dados.publico.criancas, hint: "0 a 12 anos" },
    { label: "Adolescentes", value: dados.publico.adolescentes, hint: "13 a 17 anos" },
    { label: "Adultos", value: dados.publico.adultos, hint: "18 a 59 anos" },
    { label: "Idosos", value: dados.publico.idosos, hint: "60+ anos" },
    { label: "Gestantes", value: dados.publico.gestantes, hint: "Cadastradas" },
    { label: "PCD", value: dados.publico.pcd, hint: "Deficiência" },
  ];

  const PIE_COLORS = ["#1E5AA8", "#E8712A", "#4C8FD1", "#F4A96B"];

  return (
    <AppShell title="Painel">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const T = k.trend;
          const TrendIcon = T?.dir === "up" ? TrendingUp : T?.dir === "down" ? TrendingDown : Minus;
          const trendClass =
            T?.dir === "up"
              ? "text-emerald-700"
              : T?.dir === "down"
                ? "text-red-700"
                : "text-muted-foreground";
          return (
            <Card key={k.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${k.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-2xl font-semibold leading-tight">{k.value}</p>
                  <p
                    className={`mt-0.5 text-[11px] ${T ? trendClass : "text-muted-foreground"} flex items-center gap-1`}
                  >
                    {T && <TrendIcon className="h-3 w-3" />}
                    {k.hint}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Perfil do público atendido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-5 lg:grid-cols-9">
            {perfil.map((p) => (
              <div key={p.label} className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-semibold">{p.value}</p>
                <p className="text-xs font-medium text-foreground">{p.label}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {p.hint}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Membros das famílias cadastradas no Supabase (responsável + demais membros). Sexo/gênero
            ainda não é obrigatório no cadastro — enquanto isso, o total aparece em "Não informado".
          </p>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Atendimentos por dia (30 dias)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {dados.entregasPorDia.length === 0 ? (
              <EmptyList text="Nenhum atendimento nos últimos 30 dias." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dados.entregasPorDia}
                  margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 10 }}
                    interval={dados.entregasPorDia.length > 12 ? 1 : 0}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="qtd" fill="#1E5AA8" radius={[4, 4, 0, 0]} minPointSize={4}>
                    <LabelList
                      dataKey="qtd"
                      position="top"
                      style={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entregas por benefício (mês)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {dados.entregasPorBeneficio.length === 0 ? (
              <EmptyList text="Nenhuma entrega registrada no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dados.entregasPorBeneficio}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label={(e: { name: string; value: number }) => `${e.name}: ${e.value}`}
                  >
                    {dados.entregasPorBeneficio.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Famílias por status</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dados.statusFamilias}
              layout="vertical"
              margin={{ top: 4, right: 32, left: 0, bottom: 4 }}
            >
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis dataKey="status" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="qtd" radius={[0, 4, 4, 0]}>
                {dados.statusFamilias.map((s) => (
                  <Cell key={s.status} fill={s.fill} />
                ))}
                <LabelList
                  dataKey="qtd"
                  position="right"
                  style={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Últimas entregas</CardTitle>
            <Link
              to="/relatorios"
              search={{ tipo: "entregas" }}
              className="text-xs text-primary hover:underline"
            >
              Ver relatório
            </Link>
          </CardHeader>
          <CardContent>
            {dados.ultimasEntregas.length === 0 ? (
              <EmptyList text="Nenhuma entrega registrada ainda." />
            ) : (
              <ul className="divide-y">
                {dados.ultimasEntregas.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.assistidoNome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.familiaNome} • {e.beneficioNome}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatarDataHora(e.criadoEm)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Últimas movimentações</CardTitle>
            <Link
              to="/estoque"
              search={{ tab: "mov", foco: undefined }}
              className="text-xs text-primary hover:underline"
            >
              Ver estoque
            </Link>
          </CardHeader>
          <CardContent>
            {dados.ultimasMovimentacoes.length === 0 ? (
              <EmptyList text="Nenhuma movimentação ainda." />
            ) : (
              <ul className="divide-y">
                {dados.ultimasMovimentacoes.map((m) => (
                  <li
                    key={`${m.origem}-${m.id}`}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.beneficioNome}</p>
                      <p className="truncate text-xs capitalize text-muted-foreground">
                        {m.tipo === "baixa" ? "Baixa automática" : m.tipo}
                        {m.motivo ? ` • ${m.motivo}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs ${m.quantidade < 0 ? "text-red-700" : "text-emerald-700"}`}
                    >
                      {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Alertas de estoque
            </CardTitle>
            <Link
              to="/estoque"
              search={{ tab: "saldos", foco: "alertas" }}
              className="text-xs text-primary hover:underline"
            >
              Abrir
            </Link>
          </CardHeader>
          <CardContent>
            {dados.alertasEstoque.length === 0 ? (
              <EmptyList text="Sem alertas no momento." />
            ) : (
              <ul className="divide-y">
                {dados.alertasEstoque.map((a) => (
                  <li key={a.item} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{a.item}</p>
                      <p className="text-xs text-muted-foreground">
                        Saldo {a.saldo} / mín. {a.minimo}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        a.status === "Sem estoque"
                          ? "border-red-200 bg-red-100 text-red-700"
                          : a.status === "Estoque baixo"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-amber-200 bg-amber-100 text-amber-700"
                      }
                    >
                      {a.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Aguardando avaliação definitiva</CardTitle>
            <Link
              to="/familias"
              search={{ foco: "avaliar" }}
              className="text-xs text-primary hover:underline"
            >
              Ver famílias
            </Link>
          </CardHeader>
          <CardContent>
            {dados.aguardandoAvaliacao.length === 0 ? (
              <EmptyList text="Nenhuma família em avaliação." />
            ) : (
              <ul className="divide-y">
                {dados.aguardandoAvaliacao.map((f) => (
                  <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <Link
                        to="/familias/$id"
                        params={{ id: f.id }}
                        className="font-medium hover:underline"
                      >
                        {f.nome}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {f.responsavel} • {f.bairro}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-violet-200 bg-violet-100 text-violet-700"
                    >
                      avaliar
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Contato necessário (90+ dias)</CardTitle>
            <Link
              to="/familias"
              search={{ foco: "contato90" }}
              className="text-xs text-primary hover:underline"
            >
              Ver famílias
            </Link>
          </CardHeader>
          <CardContent>
            {dados.contatoNecessario.length === 0 ? (
              <EmptyList text="Nenhuma família nesse período." />
            ) : (
              <ul className="divide-y">
                {dados.contatoNecessario.map(({ f, dias }) => (
                  <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <Link
                        to="/familias/$id"
                        params={{ id: f.id }}
                        className="font-medium hover:underline"
                      >
                        {f.nome}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {f.responsavel} • {f.bairro}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-red-200 bg-red-100 text-red-700">
                      {dias !== null ? `${dias} dias` : "90+ dias"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmptyList({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Badge variant="secondary">Sem dados</Badge>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
