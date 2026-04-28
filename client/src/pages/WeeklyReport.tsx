import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, TrendingUp, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job } from "@shared/schema";

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

function weekRange(dateStr: string) {
  const monday = new Date(dateStr + "T00:00:00");
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${monday.toLocaleDateString("en-US", opts)} – ${friday.toLocaleDateString("en-US", opts)}`;
}

export default function WeeklyReport() {
  const { data: summary, isLoading: summaryLoading } = useQuery<Summary>({ queryKey: ["/api/summary"] });
  const { data: allJobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });

  // Group jobs by week
  const jobsByWeek: Record<string, Job[]> = {};
  allJobs.forEach((j) => {
    if (!jobsByWeek[j.weekOf]) jobsByWeek[j.weekOf] = [];
    jobsByWeek[j.weekOf].push(j);
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold">Weekly Report</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Full breakdown per week — commission earned vs. paid</p>
      </div>

      {summaryLoading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
      ) : !summary?.weeks.length ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-muted-foreground">
            <CalendarDays size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No data yet</p>
            <p className="text-sm mt-1">Add jobs and payments to generate weekly reports.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {summary.weeks.map((week) => {
            const weekJobs = jobsByWeek[week.weekOf] || [];
            const isUnderpaid = week.delta > 0.01;
            const isOverpaid = week.delta < -0.01;

            return (
              <Card key={week.weekOf} className="border-border" data-testid={`card-week-${week.weekOf}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-base font-semibold">{weekRange(week.weekOf)}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{week.jobCount} job{week.jobCount !== 1 ? "s" : ""} · {fmt(week.sales)} in sales</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        isUnderpaid
                          ? "border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-400 dark:bg-red-950/30"
                          : isOverpaid
                          ? "border-green-300 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-400 dark:bg-green-950/30"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {isUnderpaid && <AlertTriangle size={12} className="mr-1" />}
                      {isOverpaid && <CheckCircle size={12} className="mr-1" />}
                      {isUnderpaid ? `Owed ${fmt(week.delta)}` : isOverpaid ? `Overpaid ${fmt(Math.abs(week.delta))}` : "Balanced"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                      <div className="text-xs text-muted-foreground font-medium">Commission Earned</div>
                      <div className="tabular-nums font-bold text-green-600 dark:text-green-400 mt-0.5">{fmt(week.commission)}</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                      <div className="text-xs text-muted-foreground font-medium">Amount Paid</div>
                      <div className="tabular-nums font-bold text-purple-600 dark:text-purple-400 mt-0.5">{fmt(week.paid)}</div>
                    </div>
                    <div className={cn("rounded-lg px-3 py-2.5", isUnderpaid ? "bg-red-50 dark:bg-red-950/30" : "bg-muted/50")}>
                      <div className="text-xs text-muted-foreground font-medium">Difference</div>
                      <div className={cn("tabular-nums font-bold mt-0.5", isUnderpaid ? "text-red-600 dark:text-red-400" : isOverpaid ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                        {isUnderpaid ? "-" : isOverpaid ? "+" : ""}{fmt(Math.abs(week.delta))}
                      </div>
                    </div>
                  </div>

                  {/* Job breakdown */}
                  {weekJobs.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Jobs This Week</div>
                      <div className="space-y-1">
                        {weekJobs.map((job) => (
                          <div key={job.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-md hover:bg-muted/40 transition-colors" data-testid={`item-week-job-${job.id}`}>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs text-muted-foreground">{job.jobNumber}</span>
                              <span className="font-medium">{job.customerName}</span>
                              <span className="text-muted-foreground hidden sm:inline">{job.serviceType}</span>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                              <span className="tabular-nums text-muted-foreground">{fmt(job.invoiceTotal)}</span>
                              <span className="tabular-nums text-green-600 dark:text-green-400 font-medium w-20">{fmt(job.commissionEarned)}</span>
                              <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium hidden sm:inline", `status-${job.status}`)}>
                                {job.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {weekJobs.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No job entries for this week — payment was recorded only.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
