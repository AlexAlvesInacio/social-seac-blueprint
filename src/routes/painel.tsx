import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Users, UserRound, Package, Truck, Calendar, AlertTriangle, PhoneCall,
  ClipboardCheck, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFamilias, calcularFaixaEtaria } from "@/lib/familias-store";
import { useAtendimentoStore } from "@/lib/atendimento-store";
import { useParametros } from "@/lib/config-store";
import { ESTOQUE_BASE } from "@/lib/relatorios-store";

export const Route = createFileRoute("/painel")({
  head: () => ({ meta: [{ title: "Painel — SEAC Social" }] }),
  component: PainelPage,
});

const BENEFICIOS_ENTREGAVEIS = ["Cesta Padrão", "Cesta Extra", "Kit Gestante"];

function normDoc(s?: string): string {
  return (s ?? "").replace(/\D/g, "");
}

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

function parseBR(s?: string): Date | null {
  if (!s || s === "—") return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
}

function trend(current: number, previous: number): { delta: number; label: string; dir: "up" | "down" | "flat" } {
  if (previous === 0 && current === 0) return { delta: 0, label: "sem histórico", dir: "flat" };
  if (previous === 0) return { delta: 100, label: "novo período", dir: "up" };
  const pct = Math.round(((current - previous) / previous) * 100);
  return {
    delta: pct,
    label: `${pct >= 0 ? "+" : ""}${pct}% vs período anterior`,
    dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
  };
}

function PainelPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const familias = useFamilias((s) => s.familias);
  const assistidos = useFamilias((s) => s.assistidos);
  const membros = useFamilias((s) => s.membros);
  const entregas = useAtendimentoStore((s) => s.entregas);
  const saldoStore = useAtendimentoStore((s) => s.saldo);
  const params = useParametros((s) => s.params);

  const dados = useMemo(() => {
    const hoje = startOfDay(new Date());
    const iniMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ini30 = daysAgo(30);
    const ini60 = daysAgo(60);

    const parseEntrega = (dISO: string) => new Date(dISO);

    const entregasHoje = entregas.filter((e) => startOfDay(parseEntrega(e.dataISO)).getTime() === hoje.getTime());
    const entregasMes = entregas.filter((e) => parseEntrega(e.dataISO) >= iniMes);
    const entregas30 = entregas.filter((e) => parseEntrega(e.dataISO) >= ini30);
    const entregas30Prev = entregas.filter((e) => {
      const d = parseEntrega(e.dataISO);
      return d >= ini60 && d < ini30;
    });

    // Famílias atendidas por período (unique por familiaId ou documento)
    const familiaKey = (e: (typeof entregas)[number]): string => {
      if (e.familiaId) return `id:${e.familiaId}`;
      const doc = normDoc(e.documento);
      const a = assistidos.find((x) => normDoc(x.documento) === doc);
      return a ? `id:${a.familiaId}` : `doc:${doc || e.familia}`;
    };
    const famAtend30 = new Set(entregas30.map(familiaKey));
    const famAtend30Prev = new Set(entregas30Prev.map(familiaKey));

    const cestasEstoque = BENEFICIOS_ENTREGAVEIS.reduce((acc, b) => {
      const base = ESTOQUE_BASE.find((s) => s.item === b)?.saldo ?? 0;
      return acc + (saldoStore[b] ?? base);
    }, 0);

    // Aguardando avaliação — alinhado ao card de /familias
    const aguardandoAvaliacao = familias.filter((f) => f.status === "avaliar");

    // Contato necessário 90+ — alinhado ao card de /familias (acompanhamento sem_retirada_90)
    const contatoNecessario = familias
      .filter((f) => f.acompanhamento === "sem_retirada_90")
      .map((f) => {
        const docs = new Set(assistidos.filter((a) => a.familiaId === f.id).map((a) => normDoc(a.documento)));
        docs.add(normDoc(f.documento));
        let ult: Date | null = null;
        for (const e of entregas) {
          if (e.familiaId === f.id || docs.has(normDoc(e.documento))) {
            const d = parseEntrega(e.dataISO);
            if (!ult || d > ult) ult = d;
          }
        }
        if (!ult) ult = parseBR(f.ultimaRetirada);
        const dias = ult ? Math.floor((hoje.getTime() - ult.getTime()) / 86400000) : params.inatividadeContatoDias;
        return { f, ult, dias };
      });

    // Assistidos ativos — só assistidos cadastrados com status ativo
    const assistidosAtivos = assistidos.filter((a) => a.status === "ativo").length;

    // Perfil do público
    const publico = { criancas: 0, adolescentes: 0, adultos: 0, idosos: 0, gestantes: 0, pcd: 0, mulheres: 0, homens: 0, naoInformado: 0, total: 0 };
    for (const f of familias) {
      const listaAssist = assistidos.filter((a) => a.familiaId === f.id);
      const listaMemb = membros.filter((m) => m.familiaId === f.id);
      const docsVistos = new Set<string>();
      const respDoc = normDoc(f.documento);
      if (respDoc) docsVistos.add(respDoc);
      // responsável conta como 1 adulto sem gênero informado
      publico.total++; publico.adultos++; publico.naoInformado++;
      for (const a of listaAssist) {
        const d = normDoc(a.documento);
        if (d && docsVistos.has(d)) continue;
        if (d) docsVistos.add(d);
        publico.total++;
        const faixa = calcularFaixaEtaria(a.nascimento);
        if (faixa === "crianca") publico.criancas++;
        else if (faixa === "adolescente") publico.adolescentes++;
        else if (faixa === "idoso") publico.idosos++;
        else publico.adultos++;
        if (a.pcd) publico.pcd++;
        publico.naoInformado++;
      }
      for (const m of listaMemb) {
        const d = normDoc(m.documento);
        if (d && docsVistos.has(d)) continue;
        if (d) docsVistos.add(d);
        publico.total++;
        if (m.crianca) publico.criancas++;
        else if (m.adolescente) publico.adolescentes++;
        else if (m.idoso) publico.idosos++;
        else publico.adultos++;
        if (m.gestante) publico.gestantes++;
        if (m.pcd) publico.pcd++;
        publico.naoInformado++;
      }
      // fallback: se família tem contadores agregados e não há membros/assistidos detalhados
      const detalhados = listaAssist.length + listaMemb.length;
      if (detalhados === 0) {
        const cri = f.criancas ?? 0;
        const ido = f.idosos ?? 0;
        const ges = f.gestantes ?? 0;
        const pcd = f.pcd ?? 0;
        const extras = Math.max(0, (f.moradores ?? 0) - 1);
        publico.total += extras;
        publico.criancas += cri;
        publico.idosos += ido;
        publico.gestantes += ges;
        publico.pcd += pcd;
        publico.adultos += Math.max(0, extras - cri - ido);
        publico.naoInformado += extras;
      }
    }

    // Atendimentos por dia (30 dias) — apenas dias com atendimento real
    const entregasPorDia: { dia: string; qtd: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = daysAgo(i);
      const qtd = entregas.filter((e) => startOfDay(parseEntrega(e.dataISO)).getTime() === d.getTime()).length;
      if (qtd === 0) continue;
      const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      entregasPorDia.push({ dia: label, qtd });
    }

    // Entregas por benefício (mês) — oculta benefícios sem entrega no período
    const entregasPorBeneficio = BENEFICIOS_ENTREGAVEIS
      .map((b) => ({ name: b, value: entregasMes.filter((e) => e.beneficio === b).length }))
      .filter((b) => b.value > 0);

    const statusFamilias = [
      { status: "Liberado", qtd: familias.filter((f) => f.status === "liberado").length, fill: "hsl(152 55% 42%)" },
      { status: "Bloqueado", qtd: familias.filter((f) => f.status === "bloqueado").length, fill: "hsl(0 72% 51%)" },
      { status: "Avaliar", qtd: familias.filter((f) => f.status === "avaliar").length, fill: "#E8712A" },
      { status: "Inativo", qtd: familias.filter((f) => f.status === "inativo").length, fill: "hsl(220 9% 55%)" },
    ];

    // Alertas estoque
    const alertasEstoque = ESTOQUE_BASE
      .map((s) => {
        const saldo = saldoStore[s.item] ?? s.saldo;
        return { item: s.item, saldo, minimo: s.minimo, status: saldo <= 0 ? "Sem estoque" : saldo < s.minimo * 0.5 ? "Estoque baixo" : saldo < s.minimo ? "Atenção" : "OK" };
      })
      .filter((x) => x.status !== "OK");

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
      ultimasMovimentacoes: entregas.slice(0, 5),
      aguardandoAvaliacao: aguardandoAvaliacao.slice(0, 6),
      contatoNecessario: contatoNecessario.slice(0, 6),
    };
  }, [familias, assistidos, membros, entregas, saldoStore, params]);

  if (!mounted) {
    return <AppShell title="Painel"><div className="p-8 text-sm text-muted-foreground">Carregando indicadores…</div></AppShell>;
  }

  const c = dados.contadores;
  const tAtend = trend(c.familiasAtendidas30, c.familiasAtendidas30Prev);
  const tEntregas30 = trend(c.entregas30, c.entregas30Prev);

  const kpis = [
    { icon: Users, label: "Famílias cadastradas", value: c.familiasCadastradas, hint: "Total", tone: "bg-primary/10 text-primary" },
    { icon: Truck, label: "Famílias atendidas (30 dias)", value: c.familiasAtendidas30, hint: tAtend.label, tone: "bg-emerald-100 text-emerald-700", trend: tAtend },
    { icon: UserRound, label: "Assistidos ativos", value: c.assistidosAtivos, hint: "Ativos", tone: "bg-sky-100 text-sky-700" },
    { icon: Calendar, label: "Entregas hoje", value: c.entregasHoje, hint: "Hoje", tone: "bg-amber-100 text-amber-700" },
    { icon: Truck, label: "Entregas no mês", value: c.entregasMes, hint: tEntregas30.label, tone: "bg-emerald-100 text-emerald-700", trend: tEntregas30 },
    { icon: Package, label: "Cestas em estoque", value: c.cestasEstoque, hint: "Benefícios entregáveis", tone: "bg-primary/10 text-primary" },
    { icon: ClipboardCheck, label: "Aguardando avaliação", value: c.aguardandoAvaliacao, hint: "Cadastro definitivo", tone: "bg-violet-100 text-violet-700" },
    { icon: PhoneCall, label: "Contato necessário 90+", value: c.contatoNecessario, hint: "Sem retirada", tone: "bg-red-100 text-red-700" },
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
      {/* KPIs principais */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const T = k.trend;
          const TrendIcon = T?.dir === "up" ? TrendingUp : T?.dir === "down" ? TrendingDown : Minus;
          const trendClass = T?.dir === "up" ? "text-emerald-700" : T?.dir === "down" ? "text-red-700" : "text-muted-foreground";
          return (
            <Card key={k.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${k.tone}`}><Icon className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-2xl font-semibold leading-tight">{k.value}</p>
                  <p className={`mt-0.5 text-[11px] ${T ? trendClass : "text-muted-foreground"} flex items-center gap-1`}>
                    {T && <TrendIcon className="h-3 w-3" />}
                    {k.hint}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Perfil do público */}
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Perfil do público atendido</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
            {perfil.map((p) => (
              <div key={p.label} className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-semibold">{p.value}</p>
                <p className="text-xs font-medium text-foreground">{p.label}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{p.hint}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Moradores únicos por família (responsável + assistidos + membros, sem duplicidade por documento).
            Sexo/gênero ainda não é obrigatório no cadastro — enquanto isso, o total aparece em "Não informado".
          </p>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Atendimentos por dia (30 dias)</CardTitle></CardHeader>
          <CardContent className="h-64">
            {dados.entregasPorDia.length === 0 ? (
              <EmptyList text="Nenhum atendimento nos últimos 30 dias." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados.entregasPorDia} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} interval={dados.entregasPorDia.length > 12 ? 1 : 0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="qtd" fill="#1E5AA8" radius={[4, 4, 0, 0]} minPointSize={4}>
                    <LabelList dataKey="qtd" position="top" style={{ fontSize: 10, fill: "hsl(var(--foreground))" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Entregas por benefício (mês)</CardTitle></CardHeader>
          <CardContent className="h-64">
            {dados.entregasPorBeneficio.length === 0 ? (
              <EmptyList text="Nenhuma entrega registrada no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dados.entregasPorBeneficio} dataKey="value" nameKey="name" outerRadius={80} label={(e: { name: string; value: number }) => `${e.name}: ${e.value}`}>
                    {dados.entregasPorBeneficio.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
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
        <CardHeader><CardTitle className="text-base">Famílias por status</CardTitle></CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados.statusFamilias} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 4 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis dataKey="status" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="qtd" radius={[0, 4, 4, 0]}>
                {dados.statusFamilias.map((s) => (
                  <Cell key={s.status} fill={s.fill} />
                ))}
                <LabelList dataKey="qtd" position="right" style={{ fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Operacional */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Últimas entregas</CardTitle>
            <Link to="/relatorios" search={{ tipo: "entregas" }} className="text-xs text-primary hover:underline">Ver relatório</Link>
          </CardHeader>
          <CardContent>
            {dados.ultimasEntregas.length === 0 ? <EmptyList text="Nenhuma entrega registrada ainda." /> : (
              <ul className="divide-y">
                {dados.ultimasEntregas.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{e.familia} • {e.beneficio}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{new Date(e.dataISO).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Últimas movimentações</CardTitle>
            <Link to="/estoque" search={{ tab: "mov" }} className="text-xs text-primary hover:underline">Ver estoque</Link>
          </CardHeader>
          <CardContent>
            {dados.ultimasMovimentacoes.length === 0 ? <EmptyList text="Nenhuma movimentação ainda." /> : (
              <ul className="divide-y">
                {dados.ultimasMovimentacoes.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.beneficio}</p>
                      <p className="truncate text-xs text-muted-foreground">Baixa automática • {e.usuario}</p>
                    </div>
                    <span className="shrink-0 text-xs text-red-700">-1</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> Alertas de estoque</CardTitle>
            <Link to="/estoque" search={{ tab: "saldos", foco: "alertas" }} className="text-xs text-primary hover:underline">Abrir</Link>
          </CardHeader>
          <CardContent>
            {dados.alertasEstoque.length === 0 ? <EmptyList text="Sem alertas no momento." /> : (
              <ul className="divide-y">
                {dados.alertasEstoque.map((a) => (
                  <li key={a.item} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{a.item}</p>
                      <p className="text-xs text-muted-foreground">Saldo {a.saldo} / mín. {a.minimo}</p>
                    </div>
                    <Badge variant="outline" className={a.status === "Sem estoque" ? "border-red-200 bg-red-100 text-red-700" : a.status === "Estoque baixo" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-100 text-amber-700"}>{a.status}</Badge>
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
            <Link to="/familias" search={{ foco: "avaliar" }} className="text-xs text-primary hover:underline">Ver famílias</Link>
          </CardHeader>
          <CardContent>
            {dados.aguardandoAvaliacao.length === 0 ? <EmptyList text="Nenhuma família em avaliação." /> : (
              <ul className="divide-y">
                {dados.aguardandoAvaliacao.map((f) => (
                  <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <Link to="/familias/$id" params={{ id: String(f.id) }} className="font-medium hover:underline">{f.nome}</Link>
                      <p className="text-xs text-muted-foreground">{f.responsavel} • {f.bairro}</p>
                    </div>
                    <Badge variant="outline" className="border-violet-200 bg-violet-100 text-violet-700">{f.progressoExtra ?? "avaliar"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Contato necessário (90+ dias)</CardTitle>
            <Link to="/familias" search={{ foco: "contato90" }} className="text-xs text-primary hover:underline">Ver famílias</Link>
          </CardHeader>
          <CardContent>
            {dados.contatoNecessario.length === 0 ? <EmptyList text="Nenhuma família nesse período." /> : (
              <ul className="divide-y">
                {dados.contatoNecessario.map(({ f, dias }) => (
                  <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <Link to="/familias/$id" params={{ id: String(f.id) }} className="font-medium hover:underline">{f.nome}</Link>
                      <p className="text-xs text-muted-foreground">{f.responsavel} • {f.bairro}</p>
                    </div>
                    <Badge variant="outline" className="border-red-200 bg-red-100 text-red-700">{dias} dias</Badge>
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

function EmptyList({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Badge variant="secondary">Sem dados</Badge>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}