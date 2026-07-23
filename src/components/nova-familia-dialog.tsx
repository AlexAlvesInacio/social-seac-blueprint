import { useNavigate } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { registrarAuditoria } from "@/lib/auditoria-store";
import { useFamilias, type FamiliaStatus, type TipoCadastro } from "@/lib/familias-store";
import {
  FamiliasSupabaseWriteQueryError,
  type PessoaTipoDocumentoSupabase,
} from "@/lib/familias/familias-supabase-types";
import { useCriarFamiliaSupabase } from "@/lib/familias/use-familias-supabase";

type CadastroFamiliaDestino = "supabase" | "local";
type FonteListaFamilias = "supabase" | "local";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: { origem: CadastroFamiliaDestino; nome: string }) => void;
  destinoInicial: CadastroFamiliaDestino;
  fonteLista: FonteListaFamilias;
};

type FormState = {
  nome: string;
  responsavel: string;
  tipoDocumento: PessoaTipoDocumentoSupabase;
  documento: string;
  telefone: string;
  bairro: string;
  endereco: string;
  numero: string;
  complemento: string;
  cidade: string;
  uf: string;
  cep: string;
  tipoCadastro: TipoCadastro;
  status: FamiliaStatus;
  moradores: string;
  criancas: string;
  idosos: string;
  gestantes: string;
  pcd: string;
  observacoes: string;
};

const emptyForm: FormState = {
  nome: "",
  responsavel: "",
  tipoDocumento: "cpf",
  documento: "",
  telefone: "",
  bairro: "",
  endereco: "",
  numero: "",
  complemento: "",
  cidade: "",
  uf: "",
  cep: "",
  tipoCadastro: "extra",
  status: "liberado",
  moradores: "",
  criancas: "",
  idosos: "",
  gestantes: "",
  pcd: "",
  observacoes: "",
};

function getSupabaseErrorMessage(error: unknown): string {
  if (!(error instanceof FamiliasSupabaseWriteQueryError)) {
    return "Não foi possível confirmar o cadastro no Supabase. Nenhum dado foi salvo localmente; atualize a lista antes de tentar novamente.";
  }

  switch (error.code) {
    case "23505":
      return "Já existe uma pessoa cadastrada com este documento.";
    case "22023":
      return "Revise os dados informados e tente novamente.";
    case "42501":
      return "Apenas administrador ou atendente ativo pode cadastrar famílias.";
    default:
      return "Não foi possível confirmar o cadastro no Supabase. Nenhum dado foi salvo localmente; atualize a lista antes de tentar novamente.";
  }
}

export function NovaFamiliaDialog({
  open,
  onOpenChange,
  onCreated,
  destinoInicial,
  fonteLista,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [destino, setDestino] = useState<CadastroFamiliaDestino>(destinoInicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [acaoPendente, setAcaoPendente] = useState<"salvar" | "abrir" | null>(null);
  const add = useFamilias((state) => state.add);
  const existsDocumento = useFamilias((state) => state.existsDocumento);
  const criarFamiliaSupabase = useCriarFamiliaSupabase();
  const navigate = useNavigate();
  const envioRemotoEmAndamento = useRef(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErros((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setErroEnvio(null);
  };

  const reset = () => {
    setForm(emptyForm);
    setDestino(destinoInicial);
    setErros({});
    setErroEnvio(null);
    setAcaoPendente(null);
    criarFamiliaSupabase.reset();
  };

  const validar = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.nome.trim()) nextErrors.nome = "Informe o nome da família.";
    if (!form.responsavel.trim()) nextErrors.responsavel = "Informe o responsável.";
    if (!form.documento.trim()) {
      nextErrors.documento = "Informe o documento do responsável.";
    } else if (destino === "local" && existsDocumento(form.documento)) {
      nextErrors.documento = "Já existe uma família local cadastrada com este documento.";
    }

    setErros(nextErrors);
    setErroEnvio(null);
    return Object.keys(nextErrors).length === 0;
  };

  const concluirCadastro = (id: string, irParaDetalhe: boolean) => {
    reset();
    onOpenChange(false);

    if (irParaDetalhe) {
      navigate({ to: "/familias/$id", params: { id } });
    }
  };

  const salvarLocal = (irParaDetalhe: boolean) => {
    const nova = add({
      nome: form.nome.trim(),
      responsavel: form.responsavel.trim(),
      documento: form.documento.trim(),
      telefone: form.telefone.trim(),
      bairro: form.bairro.trim(),
      endereco: form.endereco.trim() || undefined,
      numero: form.numero.trim() || undefined,
      complemento: form.complemento.trim() || undefined,
      cidade: form.cidade.trim() || undefined,
      uf: form.uf.trim() || undefined,
      cep: form.cep.trim() || undefined,
      tipoCadastro: form.tipoCadastro,
      progressoExtra: form.tipoCadastro === "extra" ? "novo" : null,
      ultimaRetirada: "—",
      proximaData: "—",
      acompanhamento: "em_dia",
      status: form.status,
      moradores: form.moradores ? Number(form.moradores) : undefined,
      criancas: form.criancas ? Number(form.criancas) : undefined,
      idosos: form.idosos ? Number(form.idosos) : undefined,
      gestantes: form.gestantes ? Number(form.gestantes) : undefined,
      pcd: form.pcd ? Number(form.pcd) : undefined,
      observacoes: form.observacoes.trim() || undefined,
    });

    registrarAuditoria({
      usuario: "operador",
      acao: "Família criada",
      modulo: "Famílias",
      registro: `${nova.nome} (${nova.responsavel})`,
      observacao: `Doc. ${nova.documento}`,
    });
    toast.success("Família salva somente neste navegador.");
    onCreated({ origem: "local", nome: nova.nome });
    concluirCadastro(String(nova.id), irParaDetalhe);
  };

  const salvarRemoto = async (irParaDetalhe: boolean) => {
    if (envioRemotoEmAndamento.current) return;

    envioRemotoEmAndamento.current = true;
    setAcaoPendente(irParaDetalhe ? "abrir" : "salvar");

    try {
      const nova = await criarFamiliaSupabase.mutateAsync({
        nomeReferencia: form.nome,
        responsavelNome: form.responsavel,
        responsavelTipoDocumento: form.tipoDocumento,
        responsavelDocumento: form.documento,
        responsavelTelefone: form.telefone,
        endereco: form.endereco,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
        cep: form.cep,
      });

      toast.success("Família cadastrada no Supabase com sucesso.");
      onCreated({ origem: "supabase", nome: form.nome.trim() });
      concluirCadastro(nova.familia_id, irParaDetalhe);
    } catch (error) {
      const message = getSupabaseErrorMessage(error);

      if (error instanceof FamiliasSupabaseWriteQueryError && error.code === "23505") {
        setErros((current) => ({ ...current, documento: message }));
      }

      setErroEnvio(message);
      toast.error(message);
    } finally {
      envioRemotoEmAndamento.current = false;
      setAcaoPendente(null);
    }
  };

  const salvar = async (irParaDetalhe: boolean) => {
    if (envioRemotoEmAndamento.current || criarFamiliaSupabase.isPending) return;
    if (!validar()) return;

    if (destino === "local") {
      salvarLocal(irParaDetalhe);
      return;
    }

    await salvarRemoto(irParaDetalhe);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && criarFamiliaSupabase.isPending) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const handleDestinoChange = (value: string) => {
    if (criarFamiliaSupabase.isPending) return;
    setDestino(value as CadastroFamiliaDestino);
    setErros({});
    setErroEnvio(null);
    criarFamiliaSupabase.reset();
  };

  const mensagemFonteDivergente =
    destino === "supabase" && fonteLista === "local"
      ? " Após o primeiro cadastro remoto, a listagem passará a exibir o Supabase."
      : destino === "local" && fonteLista === "supabase"
        ? " A família local não aparecerá enquanto a listagem estiver exibindo o Supabase; use “Salvar e abrir detalhes” para acessá-la agora."
        : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
        aria-busy={criarFamiliaSupabase.isPending}
        onEscapeKeyDown={(event) => {
          if (criarFamiliaSupabase.isPending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (criarFamiliaSupabase.isPending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Nova família</DialogTitle>
          <DialogDescription>
            Escolha explicitamente onde salvar e preencha os dados do cadastro.
          </DialogDescription>
        </DialogHeader>

        <fieldset
          disabled={criarFamiliaSupabase.isPending}
          className="m-0 grid min-w-0 gap-4 border-0 p-0 py-2"
        >
          <legend className="sr-only">Dados da nova família</legend>
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <F label="Destino do cadastro">
              <Select
                value={destino}
                disabled={criarFamiliaSupabase.isPending}
                onValueChange={handleDestinoChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supabase">Supabase — cadastro institucional</SelectItem>
                  <SelectItem value="local">Somente neste navegador — temporário</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <p className="text-xs text-muted-foreground">
              {destino === "supabase"
                ? "A RPC cria família, pessoa responsável e vínculo principal na mesma operação."
                : "Este modo preserva o cadastro local anterior e não chama o Supabase."}
              {mensagemFonteDivergente}
            </p>
          </div>

          {erroEnvio && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{erroEnvio}</AlertDescription>
            </Alert>
          )}

          {criarFamiliaSupabase.isPending && (
            <p
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              Salvando no Supabase e atualizando a lista…
            </p>
          )}

          <section className="grid gap-3 md:grid-cols-2">
            <F label="Nome da família *" erro={erros.nome}>
              <Input
                value={form.nome}
                onChange={(event) => set("nome", event.target.value)}
                placeholder="Ex.: Família Silva"
              />
            </F>
            <F label="Responsável *" erro={erros.responsavel}>
              <Input
                value={form.responsavel}
                onChange={(event) => set("responsavel", event.target.value)}
                placeholder="Nome do responsável"
              />
            </F>
            {destino === "supabase" && (
              <F label="Tipo de documento *">
                <Select
                  value={form.tipoDocumento}
                  onValueChange={(value) =>
                    set("tipoDocumento", value as PessoaTipoDocumentoSupabase)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="rg">RG</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </F>
            )}
            <F label={destino === "supabase" ? "Documento *" : "CPF / RG *"} erro={erros.documento}>
              <Input
                value={form.documento}
                onChange={(event) => set("documento", event.target.value)}
                placeholder="000.000.000-00"
              />
            </F>
            <F label="Telefone / WhatsApp">
              <Input
                value={form.telefone}
                onChange={(event) => set("telefone", event.target.value)}
                placeholder="(00) 00000-0000"
              />
            </F>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <F label="Endereço">
                <Input
                  value={form.endereco}
                  onChange={(event) => set("endereco", event.target.value)}
                />
              </F>
            </div>
            <F label="Número">
              <Input value={form.numero} onChange={(event) => set("numero", event.target.value)} />
            </F>
            <F label="Complemento">
              <Input
                value={form.complemento}
                onChange={(event) => set("complemento", event.target.value)}
              />
            </F>
            <F label="Bairro">
              <Input value={form.bairro} onChange={(event) => set("bairro", event.target.value)} />
            </F>
            <F label="Cidade">
              <Input value={form.cidade} onChange={(event) => set("cidade", event.target.value)} />
            </F>
            <F label="UF">
              <Input
                maxLength={2}
                value={form.uf}
                onChange={(event) => set("uf", event.target.value.toUpperCase())}
              />
            </F>
            <F label="CEP">
              <Input value={form.cep} onChange={(event) => set("cep", event.target.value)} />
            </F>
          </section>

          {destino === "local" ? (
            <>
              <section className="grid gap-3 md:grid-cols-2">
                <F label="Tipo de cadastro">
                  <Select
                    value={form.tipoCadastro}
                    onValueChange={(value) => set("tipoCadastro", value as TipoCadastro)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="extra">Avaliação</SelectItem>
                      <SelectItem value="definitivo">Definitivo</SelectItem>
                    </SelectContent>
                  </Select>
                </F>
                <F label="Status inicial">
                  <Select
                    value={form.status}
                    onValueChange={(value) => set("status", value as FamiliaStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="liberado">Ativo</SelectItem>
                      <SelectItem value="bloqueado">Bloqueado</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </F>
              </section>

              <section className="grid gap-3 md:grid-cols-5">
                <F label="Moradores">
                  <Input
                    type="number"
                    min={0}
                    value={form.moradores}
                    onChange={(event) => set("moradores", event.target.value)}
                  />
                </F>
                <F label="Crianças">
                  <Input
                    type="number"
                    min={0}
                    value={form.criancas}
                    onChange={(event) => set("criancas", event.target.value)}
                  />
                </F>
                <F label="Idosos">
                  <Input
                    type="number"
                    min={0}
                    value={form.idosos}
                    onChange={(event) => set("idosos", event.target.value)}
                  />
                </F>
                <F label="Gestantes">
                  <Input
                    type="number"
                    min={0}
                    value={form.gestantes}
                    onChange={(event) => set("gestantes", event.target.value)}
                  />
                </F>
                <F label="PCD">
                  <Input
                    type="number"
                    min={0}
                    value={form.pcd}
                    onChange={(event) => set("pcd", event.target.value)}
                  />
                </F>
              </section>

              <F label="Observações sociais">
                <Textarea
                  rows={3}
                  value={form.observacoes}
                  onChange={(event) => set("observacoes", event.target.value)}
                />
              </F>
            </>
          ) : (
            <p className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              Tipo de cadastro, status, contagens e observações sociais não são parâmetros desta
              RPC. O banco aplica seus valores iniciais e não cria assistido nesta etapa.
            </p>
          )}
        </fieldset>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            disabled={criarFamiliaSupabase.isPending}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="outline"
            disabled={criarFamiliaSupabase.isPending}
            onClick={() => void salvar(true)}
          >
            {criarFamiliaSupabase.isPending && acaoPendente === "abrir" && (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Salvar e abrir detalhes
          </Button>
          <Button disabled={criarFamiliaSupabase.isPending} onClick={() => void salvar(false)}>
            {criarFamiliaSupabase.isPending && acaoPendente === "salvar" && (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {destino === "supabase" ? "Salvar no Supabase" : "Salvar localmente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, erro, children }: { label: string; erro?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
