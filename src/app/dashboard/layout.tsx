import Link from "next/link";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  UserCog,
  Wallet,
  Percent,
  Tag,
  ListChecks,
  Images,
  Settings,
  LogOut,
} from "lucide-react";
import { signOut } from "@/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users },
  { href: "/dashboard/servicios", label: "Servicios", icon: Scissors },
  { href: "/dashboard/profesionales", label: "Profesionales", icon: UserCog },
  { href: "/dashboard/caja", label: "Caja", icon: Wallet },
  { href: "/dashboard/comisiones", label: "Comisiones", icon: Percent },
  { href: "/dashboard/promociones", label: "Promociones", icon: Tag },
  { href: "/dashboard/lista-espera", label: "Lista de espera", icon: ListChecks },
  { href: "/dashboard/galeria", label: "Galería", icon: Images },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:block">
        <div className="p-6">
          <span className="font-display text-xl font-semibold">Estética</span>
        </div>
        <nav className="space-y-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-border bg-card px-6 py-3">
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-4" /> Salir
            </button>
          </form>
        </header>
        <main className="flex-1 p-6 md:p-8">{children}</main>

        {/* Bottom nav (mobile) */}
        <nav className="sticky bottom-0 flex items-center justify-around border-t border-border bg-card p-2 md:hidden">
          {NAV.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] text-muted-foreground"
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
