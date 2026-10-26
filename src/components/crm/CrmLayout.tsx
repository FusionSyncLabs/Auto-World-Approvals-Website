import { Link, useNavigate, useRouterState } from "../../lib/router-compat";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "../../integrations/supabase/client";
import { Logo } from "../site/Logo";
import { Button } from "../ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, BarChart3, Contact, UserCircle, LogOut, Menu, X, Shield } from "lucide-react";

const NAV = [
  { to: "/crm", label: "Leads", icon: LayoutGrid },
  { to: "/crm/performance", label: "Performance", icon: BarChart3 },
  { to: "/crm/contacts", label: "Contacts", icon: Contact },
  { to: "/crm/account", label: "My account", icon: UserCircle },
];

export function CrmLayout({ children, role }: { children: ReactNode; role?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s: any) => s.location.pathname });
  const [email, setEmail] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => setEmail(data?.user?.email ?? ""));
  }, []);
  useEffect(() => setDrawerOpen(false), [pathname]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const NavList = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex-1 space-y-1 p-3">
      {NAV.map((n) => {
        const active = n.to === "/crm" ? pathname === "/crm" : pathname.startsWith(n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onClick}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-[var(--electric)] text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <n.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{n.label}</span>
          </Link>
        );
      })}
      {(role === "admin" || role === "superadmin") && (
        <Link
          to="/admin"
          onClick={onClick}
          className="mt-4 flex items-center gap-3 rounded-lg border border-white/15 px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
        >
          <Shield className="h-4 w-4 shrink-0" />
          <span className="truncate">Admin dashboard</span>
        </Link>
      )}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-soft">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-[var(--navy)] text-[var(--navy-foreground)] lg:flex">
        <div className="border-b border-white/10 p-5">
          <Logo variant="light" />
          <p className="mt-2 text-[17px] uppercase tracking-widest text-white/45">Lead CRM</p>
        </div>
        <NavList />
        <div className="border-t border-white/10 p-3">
          <p className="truncate px-3 text-xs text-white/55">{email}</p>
          <Button variant="ghost" onClick={signOut} className="mt-2 w-full justify-start text-white/85 hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85%] flex-col bg-[var(--navy)] text-[var(--navy-foreground)]">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <Logo variant="light" />
              <button onClick={() => setDrawerOpen(false)} className="text-white/70" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList onClick={() => setDrawerOpen(false)} />
            <div className="border-t border-white/10 p-3">
              <p className="truncate px-3 text-xs text-white/55">{email}</p>
              <Button variant="ghost" onClick={signOut} className="mt-2 w-full justify-start text-white/85 hover:bg-white/10">
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="rounded-md p-1.5 hover:bg-muted">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">Lead CRM</span>
        </header>
        <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">{children}</main>

        {/* Mobile bottom tabs */}
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card/98 backdrop-blur lg:hidden">
          {NAV.map((n) => {
            const active = n.to === "/crm" ? pathname === "/crm" : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex flex-col items-center gap-1 py-2.5 text-[17px] font-medium ${
                  active ? "text-[var(--electric)]" : "text-muted-foreground"
                }`}
              >
                <n.icon className="h-5 w-5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
