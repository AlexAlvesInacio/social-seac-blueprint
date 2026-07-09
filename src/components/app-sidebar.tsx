import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  UserRound,
  HandHeart,
  Package,
  PackagePlus,
  Boxes,
  Settings,
  UserCog,
  BarChart3,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import seacLogo from "@/assets/seac-logo.png.asset.json";

const operacional = [
  { title: "Painel", url: "/painel", icon: LayoutDashboard },
  { title: "Famílias", url: "/familias", icon: Users },
  { title: "Atendimento", url: "/atendimento", icon: HandHeart },
];

const estoque = [
  { title: "Estoque", url: "/estoque", icon: Package },
  { title: "Recebimentos", url: "/recebimentos", icon: PackagePlus },
  { title: "Composição por benefício", url: "/composicao-cesta", icon: Boxes },
];

const admin = [
  { title: "Usuários", url: "/usuarios", icon: UserCog },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Auditoria", url: "/auditoria", icon: ShieldCheck },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) =>
    pathname === url || (url !== "/painel" && pathname.startsWith(url));

  const renderGroup = (
    label: string,
    items: { title: string; url: string; icon: typeof Users }[],
  ) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                tooltip={item.title}
              >
                <Link to={item.url} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/painel" className="flex items-center gap-2 px-2 py-3">
          <img
            src={seacLogo.url}
            alt="SEAC Social"
            className="h-9 w-9 rounded-lg object-contain"
          />
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold text-foreground">
              SEAC <span className="text-primary">Social</span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              Gestão social
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Operacional", operacional)}
        {renderGroup("Estoque", estoque)}
        {renderGroup("Administração", admin)}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Sair">
              <Link to="/auth" className="flex items-center gap-3">
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}