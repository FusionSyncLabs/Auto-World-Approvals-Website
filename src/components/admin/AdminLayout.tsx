import { Link, useNavigate, useRouterState } from "@/lib/router-compat";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Settings, LogOut, Sparkles, Shield, Menu, X, Palette, Library, MessageSquare, FileText, Heart, Megaphone, Image as ImageIcon, Share2, BarChart3 } from "lucide-react";
import { BackgroundTasksPanel } from "@/components/admin/BackgroundTasksPanel";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/report", label: "Funnel Report", icon: BarChart3 },
  { to: "/admin/leads", label: "Leads", icon: Users },
  { to: "/admin/distribution", label: "Lead Distribution", icon: Share2 },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare },
  { to: "/admin/happy-clients", label: "Happy Clients", icon: Heart },
  { to: "/admin/team", label: "Team", icon: Shield },
  { to: "/admin/blog", label: "Blog / Resources", icon: FileText },
  { to: "/admin/legal", label: "Legal Docs", icon: FileText },
  { to: "/admin/ad-studio", label: "Ad Studio", icon: Megaphone },
  { to: "/admin/banners", label: "Banner Studio", icon: Sparkles },
  { to: "/admin/logos", label: "Logo Studio", icon: Palette },
  { to: "/admin/hero", label: "Hero Images", icon: ImageIcon },
  { to: "/admin/library", label: "Brand Library", icon: Library },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const NavList = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex-1 space-y-1 p-3">
      {NAV.map((n) => {
        const active = pathname === n.to || (n.to !== "/admin" && pathname.startsWith(n.to));
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onClick}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-[var(--electric)] text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-soft">
      <aside className="hidden w-64 shrink-0 bg-[var(--navy)] text-[var(--navy-foreground)] lg:flex lg:flex-col">
        <div className="border-b border-white/10 p-5"><Logo variant="light" /></div>
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
              <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)} className="text-white hover:bg-white/10"><X className="h-5 w-5" /></Button>
            </div>
            <NavList onClick={() => setDrawerOpen(false)} />
            <div className="border-t border-white/10 p-3">
              <p className="truncate px-3 text-xs text-white/55">{email}</p>
              <Button variant="ghost" onClick={signOut} className="mt-2 w-full justify-start text-white/85 hover:bg-white/10 hover:text-white">
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(true)} className="lg:hidden"><Menu className="h-5 w-5" /></Button>
            <p className="text-sm font-semibold">Admin</p>
          </div>
          <div className="flex items-center gap-1">
            <BackgroundTasksPanel />
            <Button variant="ghost" size="sm" onClick={signOut} className="lg:hidden"><LogOut className="h-4 w-4" /></Button>
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
