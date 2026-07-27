import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getSupabaseClient, supabase } from "@/lib/supabase/client";

export const Route = createFileRoute("/definir-senha")({
  head: () => ({ meta: [{ title: "Definir senha — SEAC Social" }] }),
  component: DefinirSenhaPage,
});

const SENHA_MINIMA = 8;

function DefinirSenhaPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [temSessao, setTemSessao] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) {
      setTemSessao(false);
      return;
    }
    let ativo = true;
    // O link do e-mail traz o token no fragmento da URL; o cliente processa e cria
    // a sessão. Verificamos agora e também reagimos ao evento de auth.
    void supabase.auth.getSession().then(({ data }) => {
      if (ativo && data.session) setTemSessao(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (ativo && session) setTemSessao(true);
    });
    const t = setTimeout(() => {
      if (ativo) setTemSessao((v) => (v === null ? false : v));
    }, 2500);
    return () => {
      ativo = false;
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha deve ter pelo menos ${SENHA_MINIMA} caracteres.`);
      return;
    }
    if (senha !== confirmar) {
      setErro("As senhas não conferem.");
      return;
    }

    setEnviando(true);
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ password: senha });
      if (error) {
        setErro(
          "Não foi possível definir a senha. O link pode ter expirado — peça um novo convite à administração.",
        );
        return;
      }
      await navigate({ to: "/painel", replace: true });
    } catch {
      setErro("Não foi possível definir a senha agora. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-secondary/40 px-4 py-10">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardContent className="p-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <img
              src="/seac-logo.svg"
              alt="SEAC Social"
              className="h-14 w-14 rounded-2xl object-contain"
            />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Defina sua senha</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie uma senha para acessar o SEAC Social.
              </p>
            </div>
          </div>

          {temSessao === false ? (
            <Alert variant="destructive" aria-live="polite">
              <AlertDescription>
                Não encontramos um convite válido. Abra o sistema pelo link enviado ao seu e-mail —
                se ele expirou, peça um novo convite à administração.
              </AlertDescription>
            </Alert>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="senha">Nova senha</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="senha"
                    type="password"
                    className="pl-9"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    autoComplete="new-password"
                    disabled={enviando || temSessao === null}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmar">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmar"
                    type="password"
                    className="pl-9"
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    autoComplete="new-password"
                    disabled={enviando || temSessao === null}
                    required
                  />
                </div>
              </div>
              {erro && (
                <Alert variant="destructive" aria-live="polite">
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={enviando || temSessao === null}
              >
                {temSessao === null
                  ? "Validando convite…"
                  : enviando
                    ? "Salvando…"
                    : "Definir senha e entrar"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
