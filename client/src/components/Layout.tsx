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
  { href: "/weekly", label: "Weekly Report", icon: CalendarDays },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/sync-sheets"),
    onSuccess: () => toast({ title: "Synced to Google Sheets", description: "Your data is up to date in Drive." }),
    onError: () => toast({ title: "Sync failed", description: "Could not reach Google Sheets.", variant: "destructive" }),
  });

  const SheetsFooter = () => (
    <div className="px-3 py-3 border-t border-border space-y-1.5">
      <a
        href={SHEET_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors font-medium"
        data-testid="link-open-sheet"
      >
        <Sheet size={13} />
        Open Google Sheet
        <ExternalLink size={10} className="ml-auto opacity-60" />
      </a>
      <button
        onClick={() => syncMutation.mutate()}
        disabled={syncMutation.isPending}
        data-testid="button-sync-sheets"
        className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
      >
        <RefreshCw size={13} className={syncMutation.isPending ? "animate-spin" : ""} />
        {syncMutation.isPending ? "Syncing..." : "Force sync"}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <Wrench size={16} className="text-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold text-sm leading-none text-foreground">Pay Tracker</div>
            <div className="text-xs text-muted-foreground mt-0.5">Commission Monitor</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a
                  data-testid={`nav-${label.toLowerCase().replace(" ", "-")}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon size={16} />
                  {label}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Google Sheets */}
        <SheetsFooter />

        {/* Theme toggle */}
        <div className="px-5 py-3 border-t border-border">
          <button
            data-testid="button-theme-toggle"
            onClick={toggleTheme}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary">
            <Wrench size={13} className="text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">Pay Tracker</span>
        </div>
        <div className="flex items-center gap-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    active ? "text-primary bg-primary/10" : "text-muted-foreground"
                  )}
                  title={label}
                >
                  <Icon size={18} />
                </a>
              </Link>
            );
          })}
          <a href={SHEET_URL} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-green-600" title="Open Google Sheet">
            <Sheet size={18} />
          </a>
          <button onClick={toggleTheme} className="p-1.5 rounded-md text-muted-foreground">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-dvh md:overflow-auto">
        <div className="mt-14 md:mt-0 flex-1 px-4 md:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
