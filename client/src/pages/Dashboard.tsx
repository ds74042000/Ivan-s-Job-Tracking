import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, DollarSign, AlertTriangle, CheckCircle, Briefcase, HardHat, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

interface Summary {
  totalSales: number;
  totalMaterialCost: number;
  totalMaterialMarkup: number;
  totalCommissionable: number;
  totalCommissionEarned: number;
  totalPaid: number;
  balance: number;
  jobCount: number;
  weeks: {
    weekOf: string;
    sales: number;
    materialMarkup: number;
    commissionable: number;
    commission: number;
    paid: number;
    delta: number;
    jobCount: number;
  }[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function weekLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<Summary>({ queryKey: ["/api/summary"] });

  const topStats = [
    {
      label: "Total Sales",
      value: data ? fmt(data.totalSales) : null,
      icon: TrendingUp,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      sub: data ? `${data.jobCount} jobs` : null,
      testId: "stat-total-sales",
    },
    {
      label: "Commission Earned",
      value: data ? fmt(data.totalCommissionEarned) : null,
      icon: Percent,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950/40",
      sub: data && data.totalCommissionable > 0
        ? `On ${fmt(data.totalCommissionable)} base`
        : null,
      testId: "stat-commission-earned",
    },
    {
      label: "Total Paid",
      value: data ? fmt(data.totalPaid) : null,
      icon: CheckCircle,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/40",
      testId: "stat-total-paid",
    },
    {
      label: "Balance Owed",
      value: data ? fmt(data.balance) : null,
      icon: AlertTriangle,
      color: data && data.balance > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400",
      bg: data && data.balance > 0 ? "bg-red-50 dark:bg-red-950/40" : "bg-green-50 dark:bg-green-950/40",
      sub: data && data.balance > 0 ? "Company owes you" : data ? "You're paid up ✓" : null,
      testId: "stat-balance",
    },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your independent commission tracker</p>
      </div>

      {/* Top stat cards — 2 col on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {topStats.map((s) => (
          <Card key={s.label} data-testid={s.testId} className="border-border">
            <CardContent className="p-4">
              <div className={cn("inline-flex p-2 rounded-xl mb-3", s.bg)}>
                <s.icon size={17} className={s.color} />
              </div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1 leading-tight">{s.label}</div>
              {isLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <div className={cn("text-lg font-bold tabular-nums leading-tight", s.color)}>{s.value}</div>
              )}
              {s.sub && !isLoading && (
                <div className="text-xs text-muted-foreground mt-1 leading-tight">{s.sub}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Material cost summary — shown when there are materials */}
      {(data?.totalMaterialMarkup ?? 0) > 0 && (
        <Card className="border-orange-200 dark:border-orange-900/60 bg-orange-50/50 dark:bg-orange-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="inline-flex p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/40">
                <HardHat size={15} className="text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-sm font-semibold text-foreground">Material Cost Impact</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-background/70 dark:bg-background/40 border border-border px-3 py-2">
                <div className="text-xs text-muted-foreground leading-tight">Material Cost</div>
                <div className="tabular-nums font-semibold text-sm text-foreground mt-0.5">{fmt(data!.totalMaterialCost)}</div>
              </div>
              <div className="rounded-lg bg-background/70 dark:bg-background/40 border border-border px-3 py-2">
                <div className="text-xs text-muted-foreground leading-tight">Total Deducted</div>
                <div className="tabular-nums font-semibold text-sm text-orange-600 dark:text-orange-400 mt-0.5">−{fmt(data!.totalMaterialMarkup)}</div>
              </div>
              <div className="rounded-lg bg-background/70 dark:bg-background/40 border border-border px-3 py-2">
                <div className="text-xs text-muted-foreground leading-tight">Commissionable</div>
                <div className="tabular-nums font-semibold text-sm text-foreground mt-0.5">{fmt(data!.totalCommissionable)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly breakdown */}
      <Card className="border-border">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-base font-semibold">Weekly Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !data?.weeks.length ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Briefcase size={32} className="mx-auto mb-2 opacity-40" />
              No jobs logged yet. Add your first job to get started.
            </div>
          ) : (
            <>
              {/* Mobile: stacked cards per week */}
              <div className="md:hidden divide-y divide-border">
                {data.weeks.map((w) => {
                  const underpaid = w.delta > 0.01;
                  const overpaid = w.delta < -0.01;
                  return (
                    <div key={w.weekOf} className="px-4 py-3 space-y-2" data-testid={`row-week-${w.weekOf}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-sm">Wk of {weekLabel(w.weekOf)}</span>
                          <span className="text-xs text-muted-foreground ml-2">{w.jobCount} job{w.jobCount !== 1 ? "s" : ""}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "tabular-nums text-xs",
                            underpaid
                              ? "border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-400 dark:bg-red-950/30"
                              : overpaid
                              ? "border-green-300 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-400 dark:bg-green-950/30"
                              : "border-border text-muted-foreground"
                          )}
                        >
                          {underpaid ? `Owed ${fmt(w.delta)}` : overpaid ? `+${fmt(Math.abs(w.delta))}` : "Even"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">Sales</div>
                          <div className="tabular-nums font-semibold">{fmt(w.sales)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Commission</div>
                          <div className="tabular-nums font-semibold text-green-600 dark:text-green-400">{fmt(w.commission)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Paid</div>
                          <div className="tabular-nums font-semibold text-purple-600 dark:text-purple-400">{fmt(w.paid)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Week of</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jobs</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sales</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mat. Deducted</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paid</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.weeks.map((w) => (
                      <tr key={w.weekOf} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-week-${w.weekOf}`}>
                        <td className="px-4 py-3 font-medium">Wk of {weekLabel(w.weekOf)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{w.jobCount}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(w.sales)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-orange-600 dark:text-orange-400">
                          {(w.materialMarkup ?? 0) > 0 ? `−${fmt(w.materialMarkup)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400">{fmt(w.commission)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-purple-600 dark:text-purple-400">{fmt(w.paid)}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge
                            variant="outline"
                            className={cn(
                              "tabular-nums text-xs",
                              w.delta > 0.01
                                ? "border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-400 dark:bg-red-950/30"
                                : w.delta < -0.01
                                ? "border-green-300 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-400 dark:bg-green-950/30"
                                : "border-border text-muted-foreground"
                            )}
                          >
                            {w.delta > 0.01 ? "−" : w.delta < -0.01 ? "+" : ""}
                            {fmt(Math.abs(w.delta))}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
