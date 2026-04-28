import { Link, useLocation } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard,
  ClipboardList,
  DollarSign,
  CalendarDays,
  Sun,
  Moon,
  Wrench,
  Sheet,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1m3plr0n_YAAFldaWIa2wmBeY_pqSxtSP7ZzbVrNne10/edit";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: ClipboardList },
  { href: "/payments", label: "Payments", icon: DollarSign },
  { href: "/weekly", label: "Weekly", icon: CalendarDays },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/sync-sheets"),
    onSuccess: () => toast({ title: "Synced to Google Sheets" }),
    onError: () => toast({ title: "Sync failed", variant: "destructive" }),
  });

  return (
    <div className="flex min-h-dvh bg-background">

      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <Wrench size={16} className="text-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold text-sm leading-none text-foreground">Pay Tracker</div>
            <div className="text-xs text-muted-foreground mt-0.5">Commission Monitor</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}>
                  <Icon size={16} />{label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-border space-y-1.5">
          <a href={SHEET_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors font-medium">
            <Sheet size={13} />Open Google Sheet<ExternalLink size={10} className="ml-auto opacity-60" />
          </a>
          <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full">
            <RefreshCw size={13} className={syncMutation.isPending ? "animate-spin" : ""} />
            {syncMutation.isPending ? "Syncing..." : "Force sync"}
          </button>
        </div>

        <div className="px-5 py-3 border-t border-border">
          <button onClick={toggleTheme}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </aside>

      {/* ── Mobile header ────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border px-4 flex items-center justify-between"
        style={{ height: "56px", paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary">
            <Wrench size={13} className="text-primary-foreground" />
          </div>
          <span className="font-bold text-sm tracking-tight">Pay Tracker</span>
        </div>
        <div className="flex items-center gap-1">
          <a href={SHEET_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center w-9 h-9 rounded-xl text-green-600 dark:text-green-400">
            <Sheet size={20} />
          </a>
          <button onClick={toggleTheme}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground">
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-dvh">
        {/* top padding: header on mobile, none on desktop */}
        <div className="flex-1 px-4 md:px-8 py-5"
          style={{ paddingTop: undefined }}
          >
          {/* spacer for fixed mobile header */}
          <div className="md:hidden" style={{ height: "56px" }} />
          {children}
          {/* spacer for fixed mobile bottom nav */}
          <div className="md:hidden" style={{ height: "80px" }} />
        </div>
      </main>

      {/* ── Mobile bottom tab bar ────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-stretch">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a className={cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 py-2 min-w-0 transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )} style={{ minHeight: "60px", minWidth: "60px" }}>
                  <div className={cn(
                    "flex items-center justify-center rounded-xl transition-all",
                    active ? "bg-primary/10 scale-110" : ""
                  )} style={{ width: "36px", height: "28px" }}>
                    <Icon size={active ? 22 : 20} strokeWidth={active ? 2.2 : 1.8} />
                  </div>
                  <span className={cn("text-xs font-medium", active ? "font-semibold" : "")}>{label}</span>
                </a>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
