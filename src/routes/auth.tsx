import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Heart, Mail, Lock, Eye, ShieldCheck, Clock, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — SEAC Social" },
      { name: "description", content: "Acesse o painel do SEAC Social." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/20 px-4 py-10">
      <div className="grid w-full max-w-5xl items-center gap-8 md:grid-cols-2">
        <Card className="border-border/60 shadow-lg">
          <CardContent className="p-8">
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Heart className="h-7 w-7" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">
                  SEAC <span className="text-primary">Social</span>
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">Acesse sua conta</p>
              </div>
            </div>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ to: "/painel" });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="seu@email.com" className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="Digite sua senha" className="pl-9 pr-9" />
                  <Eye className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 cursor-pointer text-muted-foreground" />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full">
                Entrar
              </Button>
              <div className="relative py-2 text-center">
                <span className="bg-card px-3 text-xs uppercase tracking-wide text-muted-foreground">ou</span>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Ainda não tem uma conta?{" "}
                <Link to="/painel" className="font-medium text-primary hover:underline">
                  Cadastre-se
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70">
          <CardContent className="space-y-5 p-8">
            <h2 className="text-lg font-semibold">Status de acesso</h2>
            <StatusRow
              icon={<ShieldCheck className="h-5 w-5 text-primary" />}
              title="Administrador"
              text="Acesso total ao sistema. Gerencia usuários, famílias, estoque e entregas."
            />
            <StatusRow
              icon={<Clock className="h-5 w-5 text-amber-600" />}
              title="Pendente"
              text="Cadastro enviado e aguardando aprovação do administrador."
            />
            <StatusRow
              icon={<UserX className="h-5 w-5 text-destructive" />}
              title="Inativo"
              text="Usuário desativado. Entre em contato com o administrador."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusRow({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}