import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, DollarSign, AlertTriangle, CheckCircle, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface Summary {
  totalSales: number;
  totalCommissionEarned: number;
  totalPaid: number;
  balance: number;
  jobCount: number;
  weeks: {
    weekOf: string;
    sales: number;
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

  const stats = [
    {
      label: "Total Sales",
      value: data ? fmt(data.totalSales) : null,
      icon: TrendingUp,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      testId: "stat-total-sales",
    },
    {
      label: "Commission Earned",
      value: data ? fmt(data.totalCommissionEarned) : null,
      icon: DollarSign,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950/40",
      sub: data ? `${data.jobCount} jobs at 25%` : null,
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
      sub: data && data.balance > 0 ? "Underpaid — company owes you" : data ? "You're paid up" : null,
      testId: "stat-balance",
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your independent commission tracking summary</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} data-testid={s.testId} className="border-border">
            <CardContent className="p-4">
              <div className={cn("inline-flex p-2 rounded-lg mb-3", s.bg)}>
                <s.icon size={18} className={s.color} />
              </div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{s.label}</div>
              {isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <div className={cn("text-lg font-bold tabular-nums", s.color)}>{s.value}</div>
              )}
              {s.sub && !isLoading && (
                <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weekly breakdown */}
      <Card className="border-border">
        <CardHeader className="pb-3">
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Week of</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jobs</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sales</th>
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
                          {w.delta > 0.01 ? "-" : w.delta < -0.01 ? "+" : ""}
                          {fmt(Math.abs(w.delta))}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
