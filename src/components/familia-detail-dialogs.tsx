import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useFamilias,
  type Familia,
  type FamiliaStatus,
  type TipoCadastro,
} from "@/lib/familias-store";
import { calcularIdade, calcularFaixaEtaria, rotuloFaixaEtaria } from "@/lib/familias-store";
import { Badge } from "@/components/ui/badge";
import { registrarAuditoria } from "@/lib/auditoria-store";

function F({ label, erro, children }: { label: string; erro?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}

/* ============ Editar família ============ */
export function EditarFamiliaDialog({
  open,
  onOpenChange,
  familia,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familia: Familia;
}) {
  const update = useFamilias((s) => s.update);
  const [form, setForm] = useState(() => toForm(familia));
  useEffect(() => {
    if (open) setForm(toForm(familia));
  }, [open, familia]);

  const set = (k: keyof ReturnType<typeof toForm>, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const salvar = () => {
    if (!form.nome.trim() || !form.responsavel.trim() || !form.documento.trim()) {
      toast.error("Preencha nome, responsável e documento.");
      return;
    }
    update(familia.id, {
      nome: form.nome.trim(),
      responsavel: form.responsavel.trim(),
      documento: form.documento.trim(),
      telefone: form.telefone.trim(),
      bairro: form.bairro.trim(),
      endereco: form.endereco.trim() || undefined,
      cidade: form.cidade.trim() || undefined,
      uf: form.uf.trim() || undefined,
      cep: form.cep.trim() || undefined,
      moradores: form.moradores ? Number(form.moradores) : undefined,
      criancas: form.criancas ? Number(form.criancas) : undefined,
      idosos: form.idosos ? Number(form.idosos) : undefined,
      gestantes: form.gestantes ? Number(form.gestantes) : undefined,
      pcd: form.pcd ? Number(form.pcd) : undefined,
      tipoCadastro: form.tipoCadastro as TipoCadastro,
      status: form.status as FamiliaStatus,
      observacoes: form.observacoes.trim() || undefined,
    });
    registrarAuditoria({
      usuario: "operador",
      acao: "Família atualizada",
      modulo: "Famílias",
      registro: form.nome,
    });
    toast.success("Família atualizada.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar família</DialogTitle>
          <DialogDescription>Atualize os dados da família.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <section className="grid gap-3 md:grid-cols-2">
            <F label="Nome da família *">
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </F>
            <F label="Responsável *">
              <Input
                value={form.responsavel}
                onChange={(e) => set("responsavel", e.target.value)}
              />
            </F>
            <F label="CPF / RG *">
              <Input value={form.documento} onChange={(e) => set("documento", e.target.value)} />
            </F>
            <F label="Telefone / WhatsApp">
              <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
            </F>
          </section>
          <section className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <F label="Endereço">
                <Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} />
              </F>
            </div>
            <F label="Bairro">
              <Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </F>
            <F label="Cidade">
              <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
            </F>
            <F label="UF">
              <Input
                maxLength={2}
                value={form.uf}
                onChange={(e) => set("uf", e.target.value.toUpperCase())}
              />
            </F>
            <F label="CEP">
              <Input value={form.cep} onChange={(e) => set("cep", e.target.value)} />
            </F>
          </section>
          <section className="grid gap-3 md:grid-cols-5">
            <F label="Moradores">
              <Input
                type="number"
                min={0}
                value={form.moradores}
                onChange={(e) => set("moradores", e.target.value)}
              />
            </F>
            <F label="Crianças">
              <Input
                type="number"
                min={0}
                value={form.criancas}
                onChange={(e) => set("criancas", e.target.value)}
              />
            </F>
            <F label="Idosos">
              <Input
                type="number"
                min={0}
                value={form.idosos}
                onChange={(e) => set("idosos", e.target.value)}
              />
            </F>
            <F label="Gestantes">
              <Input
                type="number"
                min={0}
                value={form.gestantes}
                onChange={(e) => set("gestantes", e.target.value)}
              />
            </F>
            <F label="PCD">
              <Input
                type="number"
                min={0}
                value={form.pcd}
                onChange={(e) => set("pcd", e.target.value)}
              />
            </F>
          </section>
          <section className="grid gap-3 md:grid-cols-2">
            <F label="Tipo de cadastro">
              <Select value={form.tipoCadastro} onValueChange={(v) => set("tipoCadastro", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="definitivo">Definitivo</SelectItem>
                  <SelectItem value="extra">Avaliação</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <F label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="liberado">Ativa</SelectItem>
                  <SelectItem value="bloqueado">Bloqueada</SelectItem>
                  <SelectItem value="inativo">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </F>
          </section>
          <F label="Observações">
            <Textarea
              rows={3}
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
            />
          </F>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar}>Salvar alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toForm(f: Familia) {
  return {
    nome: f.nome,
    responsavel: f.responsavel,
    documento: f.documento,
    telefone: f.telefone ?? "",
    endereco: f.endereco ?? "",
    bairro: f.bairro ?? "",
    cidade: f.cidade ?? "",
    uf: f.uf ?? "",
    cep: f.cep ?? "",
    moradores: String(f.moradores ?? ""),
    criancas: String(f.criancas ?? ""),
    idosos: String(f.idosos ?? ""),
    gestantes: String(f.gestantes ?? ""),
    pcd: String(f.pcd ?? ""),
    tipoCadastro: f.tipoCadastro,
    status: f.status,
    observacoes: f.observacoes ?? "",
  };
}

/* ============ Adicionar assistido ============ */
const assistidoEmpty = {
  nome: "",
  documento: "",
  telefone: "",
  nascimento: "",
  tipoCadastro: "extra" as TipoCadastro,
  beneficio: "Cesta Extra",
  status: "ativo" as "ativo" | "inativo" | "bloqueado",
  pcd: false,
  observacoes: "",
};

export function AdicionarAssistidoDialog({
  open,
  onOpenChange,
  familia,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familia: Familia;
}) {
  const addAssistido = useFamilias((s) => s.addAssistido);
  const addMembro = useFamilias((s) => s.addMembro);
  const existsAssistidoDoc = useFamilias((s) => s.existsAssistidoDoc);
  const allMembros = useFamilias((s) => s.membros);
  const membros = useMemo(
    () => allMembros.filter((m) => m.familiaId === familia.id),
    [allMembros, familia.id],
  );
  const [form, setForm] = useState(assistidoEmpty);
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(assistidoEmpty);
      setErros({});
    }
  }, [open]);

  const salvar = () => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Informe o nome.";
    if (!form.documento.trim()) e.documento = "CPF/RG é obrigatório.";
    else if (existsAssistidoDoc(form.documento))
      e.documento = "Já existe assistido com este documento.";
    setErros(e);
    if (Object.keys(e).length) return;

    const novo = addAssistido({
      familiaId: familia.id,
      nome: form.nome.trim(),
      documento: form.documento.trim(),
      telefone: form.telefone.trim() || undefined,
      nascimento: form.nascimento || undefined,
      tipoCadastro: form.tipoCadastro,
      beneficio: form.beneficio,
      status: form.status,
      pcd: form.pcd,
      observacoes: form.observacoes.trim() || undefined,
    });
    // Consistência: se não existir membro correspondente, criar vínculo
    const docNorm = form.documento.replace(/\D/g, "");
    const jaEhMembro = membros.some((m) => (m.documento ?? "").replace(/\D/g, "") === docNorm);
    if (!jaEhMembro) {
      addMembro({
        familiaId: familia.id,
        nome: form.nome.trim(),
        parentesco: "—",
        documento: form.documento.trim(),
        telefone: form.telefone.trim() || undefined,
        nascimento: form.nascimento || undefined,
        gestante: false,
        pcd: form.pcd,
        assistidoId: novo.id,
      });
    }
    registrarAuditoria({
      usuario: "operador",
      acao: "Assistido adicionado à família",
      modulo: "Famílias",
      registro: `${familia.nome} — ${novo.nome}`,
      observacao: `Doc. ${novo.documento}`,
    });
    toast.success("Assistido adicionado.");
    onOpenChange(false);
  };

  const set = <K extends keyof typeof assistidoEmpty>(k: K, v: (typeof assistidoEmpty)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar assistido</DialogTitle>
          <DialogDescription>Vincular novo assistido à família {familia.nome}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <section className="grid gap-3 md:grid-cols-2">
            <F label="Nome do assistido *" erro={erros.nome}>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </F>
            <F label="CPF / RG *" erro={erros.documento}>
              <Input value={form.documento} onChange={(e) => set("documento", e.target.value)} />
            </F>
            <F label="Telefone">
              <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
            </F>
            <F label="Data de nascimento">
              <Input
                type="date"
                value={form.nascimento}
                onChange={(e) => set("nascimento", e.target.value)}
              />
            </F>
          </section>
          <section className="grid gap-3 md:grid-cols-3">
            <F label="Tipo de cadastro">
              <Select
                value={form.tipoCadastro}
                onValueChange={(v) => set("tipoCadastro", v as TipoCadastro)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="definitivo">Definitivo</SelectItem>
                  <SelectItem value="extra">Avaliação</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <F label="Benefício atual">
              <Select value={form.beneficio} onValueChange={(v) => set("beneficio", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cesta Padrão">Cesta Padrão</SelectItem>
                  <SelectItem value="Cesta Extra">Cesta Extra</SelectItem>
                  <SelectItem value="Kit Gestante">Kit Gestante</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <F label="Status">
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as typeof form.status)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </F>
          </section>
          <div className="flex items-center gap-2">
            <Switch checked={form.pcd} onCheckedChange={(v) => set("pcd", v)} id="pcd-assist" />
            <Label htmlFor="pcd-assist" className="text-sm">
              PCD
            </Label>
          </div>
          <F label="Observações">
            <Textarea
              rows={3}
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
            />
          </F>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar}>Salvar assistido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Adicionar membro familiar ============ */
const membroEmpty = {
  nome: "",
  parentesco: "",
  documento: "",
  telefone: "",
  nascimento: "",
  gestante: false,
  pcd: false,
  observacoes: "",
  tambemAssistido: false,
  tipoCadastro: "extra" as TipoCadastro,
  beneficio: "Cesta Extra",
};

export function AdicionarMembroDialog({
  open,
  onOpenChange,
  familia,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familia: Familia;
}) {
  const addMembro = useFamilias((s) => s.addMembro);
  const addAssistido = useFamilias((s) => s.addAssistido);
  const existsAssistidoDoc = useFamilias((s) => s.existsAssistidoDoc);
  const update = useFamilias((s) => s.update);
  const [form, setForm] = useState(membroEmpty);
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(membroEmpty);
      setErros({});
    }
  }, [open]);

  const set = <K extends keyof typeof membroEmpty>(k: K, v: (typeof membroEmpty)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const salvar = () => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Informe o nome.";
    if (form.nascimento) {
      const d = new Date(form.nascimento);
      if (Number.isNaN(d.getTime()) || d.getTime() > Date.now()) {
        e.nascimento = "Data de nascimento inválida.";
      }
    }
    if (form.tambemAssistido) {
      if (!form.documento.trim()) e.documento = "CPF/RG obrigatório para assistido.";
      else if (existsAssistidoDoc(form.documento))
        e.documento = "Já existe assistido com este documento.";
    }
    setErros(e);
    if (Object.keys(e).length) return;

    let assistidoId: string | undefined;
    if (form.tambemAssistido) {
      const novoA = addAssistido({
        familiaId: familia.id,
        nome: form.nome.trim(),
        documento: form.documento.trim(),
        telefone: form.telefone.trim() || undefined,
        nascimento: form.nascimento || undefined,
        tipoCadastro: form.tipoCadastro,
        beneficio: form.beneficio,
        status: "ativo",
        pcd: form.pcd,
      });
      assistidoId = novoA.id;
    }

    const novoM = addMembro({
      familiaId: familia.id,
      nome: form.nome.trim(),
      parentesco: form.parentesco.trim() || "—",
      documento: form.documento.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
      nascimento: form.nascimento || undefined,
      gestante: form.gestante,
      pcd: form.pcd,
      observacoes: form.observacoes.trim() || undefined,
      assistidoId,
    });

    // Contadores de moradores continuam manuais; crianças/adolescentes/idosos
    // são derivados da lista de membros na tela de detalhe.
    update(familia.id, {
      moradores: (familia.moradores ?? 0) + 1,
      gestantes: (familia.gestantes ?? 0) + (form.gestante ? 1 : 0),
      pcd: (familia.pcd ?? 0) + (form.pcd ? 1 : 0),
    });

    registrarAuditoria({
      usuario: "operador",
      acao: "Membro familiar adicionado",
      modulo: "Famílias",
      registro: `${familia.nome} — ${novoM.nome}`,
    });
    if (form.tambemAssistido) {
      registrarAuditoria({
        usuario: "operador",
        acao: "Assistido criado a partir de membro familiar",
        modulo: "Famílias",
        registro: `${familia.nome} — ${novoM.nome}`,
        observacao: `Doc. ${form.documento}`,
      });
    }
    toast.success("Membro adicionado.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar membro familiar</DialogTitle>
          <DialogDescription>Vincular membro à família {familia.nome}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <section className="grid gap-3 md:grid-cols-2">
            <F label="Nome do membro *" erro={erros.nome}>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </F>
            <F label="Parentesco">
              <Input
                value={form.parentesco}
                onChange={(e) => set("parentesco", e.target.value)}
                placeholder="Filho, cônjuge, mãe..."
              />
            </F>
            <F label="CPF / RG (opcional)" erro={erros.documento}>
              <Input value={form.documento} onChange={(e) => set("documento", e.target.value)} />
            </F>
            <F label="Telefone (opcional)">
              <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
            </F>
            <F label="Data de nascimento" erro={erros.nascimento}>
              <div className="space-y-1">
                <Input
                  type="date"
                  value={form.nascimento}
                  onChange={(e) => set("nascimento", e.target.value)}
                />
                {form.nascimento &&
                  !erros.nascimento &&
                  (() => {
                    const idade = calcularIdade(form.nascimento);
                    const faixa = calcularFaixaEtaria(form.nascimento);
                    if (idade === null || !faixa) return null;
                    return (
                      <Badge variant="outline" className="text-xs">
                        Classificação automática: {rotuloFaixaEtaria(faixa)} ({idade}{" "}
                        {idade === 1 ? "ano" : "anos"})
                      </Badge>
                    );
                  })()}
              </div>
            </F>
          </section>
          <p className="text-xs text-muted-foreground">
            Criança (0–12), Adolescente (13–17) e Idoso (60+) são definidos automaticamente pela
            data de nascimento.
          </p>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Toggle label="Gestante" checked={form.gestante} onChange={(v) => set("gestante", v)} />
            <Toggle label="PCD" checked={form.pcd} onChange={(v) => set("pcd", v)} />
          </section>
          <F label="Observações">
            <Textarea
              rows={2}
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
            />
          </F>

          <div className="flex items-center gap-2 rounded-md border p-3">
            <Switch
              id="tambem-assist"
              checked={form.tambemAssistido}
              onCheckedChange={(v) => set("tambemAssistido", v)}
            />
            <Label htmlFor="tambem-assist" className="text-sm">
              Este membro também será assistido?
            </Label>
          </div>

          {form.tambemAssistido && (
            <section className="grid gap-3 md:grid-cols-2 rounded-md bg-muted/30 p-3">
              <F label="Tipo de cadastro">
                <Select
                  value={form.tipoCadastro}
                  onValueChange={(v) => set("tipoCadastro", v as TipoCadastro)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="definitivo">Definitivo</SelectItem>
                    <SelectItem value="extra">Avaliação</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Benefício atual">
                <Select value={form.beneficio} onValueChange={(v) => set("beneficio", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cesta Padrão">Cesta Padrão</SelectItem>
                    <SelectItem value="Cesta Extra">Cesta Extra</SelectItem>
                    <SelectItem value="Kit Gestante">Kit Gestante</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </F>
            </section>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar}>Salvar membro</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} onCheckedChange={onChange} id={`t-${label}`} />
      <Label htmlFor={`t-${label}`} className="text-sm">
        {label}
      </Label>
    </div>
  );
}

/* ============ Registrar observação ============ */
export function RegistrarObservacaoDialog({
  open,
  onOpenChange,
  familia,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familia: Familia;
}) {
  const addObservacao = useFamilias((s) => s.addObservacao);
  const [tipo, setTipo] = useState<
    "Social" | "Atendimento" | "Documento" | "Endereço" | "Saúde/PCD" | "Outro"
  >("Social");
  const [texto, setTexto] = useState("");

  useEffect(() => {
    if (open) {
      setTipo("Social");
      setTexto("");
    }
  }, [open]);

  const salvar = () => {
    if (!texto.trim()) {
      toast.error("Escreva a observação.");
      return;
    }
    addObservacao({ familiaId: familia.id, tipo, texto: texto.trim() });
    registrarAuditoria({
      usuario: "operador",
      acao: "Observação registrada na família",
      modulo: "Famílias",
      registro: familia.nome,
      observacao: `${tipo}: ${texto.trim().slice(0, 80)}`,
    });
    toast.success("Observação registrada.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar observação</DialogTitle>
          <DialogDescription>Nova observação para {familia.nome}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <F label="Tipo de observação">
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Social">Social</SelectItem>
                <SelectItem value="Atendimento">Atendimento</SelectItem>
                <SelectItem value="Documento">Documento</SelectItem>
                <SelectItem value="Endereço">Endereço</SelectItem>
                <SelectItem value="Saúde/PCD">Saúde/PCD</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </F>
          <F label="Observação">
            <Textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </F>
          <p className="text-xs text-muted-foreground">
            Data e usuário serão registrados automaticamente.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar}>Registrar observação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
