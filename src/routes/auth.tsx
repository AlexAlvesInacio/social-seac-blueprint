import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Heart, Mail, Lock, Eye, ShoppingBasket, Utensils, Baby, Shirt, Palette, HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import seacBrand from "@/assets/seac-brand.jpeg.asset.json";

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
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen w-full lg:grid-cols-2">
        {/* Left: login form */}
        <div className="flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/40 px-4 py-10">
          <Card className="w-full max-w-md border-border/60 shadow-lg">
            <CardContent className="p-8">
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Heart className="h-7 w-7" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  Acesse o <span className="text-primary">SEAC Social</span>
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gestão social para atendimentos, famílias e benefícios.
                </p>
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
        </div>

        {/* Right: institutional side */}
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-secondary/60 via-background to-accent/40 lg:flex">
          <div className="relative z-10 flex w-full flex-col items-center justify-center gap-8 px-10 py-16 text-center">
            <div className="flex flex-col items-center gap-4">
              <img
                src={seacBrand.url}
                alt="SEAC — Sopa, Esperança, Amor e Caridade"
                className="w-full max-w-md rounded-2xl bg-background/60 p-4 shadow-sm ring-1 ring-border"
              />
            </div>
            <div className="max-w-md space-y-3">
              <h2 className="text-3xl font-bold tracking-tight text-secondary-foreground">
                SEAC
              </h2>
              <p className="text-base font-medium text-primary">
                Sopa, Esperança, Amor e Caridade
              </p>
              <p className="text-lg font-semibold text-foreground">
                “Sopa, Esperança, Amor e Caridade em ação.”
              </p>
              <p className="text-sm text-muted-foreground">
                Organizando o cuidado, fortalecendo famílias e levando solidariedade com respeito.
              </p>
            </div>
            <div className="grid w-full max-w-lg grid-cols-3 gap-2 pt-2">
              <ProjectBadge icon={<ShoppingBasket className="h-4 w-4" />} label="Cesta Básica" />
              <ProjectBadge icon={<Utensils className="h-4 w-4" />} label="Comida de Rua" />
              <ProjectBadge icon={<Baby className="h-4 w-4" />} label="Gestantes" />
              <ProjectBadge icon={<Shirt className="h-4 w-4" />} label="Bazar Solidário" />
              <ProjectBadge icon={<Palette className="h-4 w-4" />} label="Oficinas" />
              <ProjectBadge icon={<HandHeart className="h-4 w-4" />} label="Doações" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card/80 px-3 py-2 text-left shadow-sm">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="truncate text-xs font-medium text-foreground">{label}</span>
    </div>
  );
}