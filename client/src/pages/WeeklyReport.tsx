import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, AlertTriangle, CheckCircle, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job } from "@shared/schema";

interface Summary {
  totalSales: number;
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

function weekRange(dateStr: string) {
  const monday = new Date(dateStr + "T00:00:00");
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${monday.toLocaleDateString("en-US", opts)} – ${friday.toLocaleDateString("en-US", opts)}`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold">Weekly Report</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Commission earned vs. paid — week by week</p>
      </div>

      {summaryLoading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}</div>
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
            const hasMaterials = (week.materialMarkup ?? 0) > 0;

            return (
              <Card key={week.weekOf} className="border-border" data-testid={`card-week-${week.weekOf}`}>
                <CardHeader className="pb-3 pt-4 px-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base font-semibold leading-tight">{weekRange(week.weekOf)}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {week.jobCount} job{week.jobCount !== 1 ? "s" : ""} · {fmt(week.sales)} sales
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-sm font-semibold tabular-nums shrink-0",
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
                <CardContent className="px-4 pb-4 space-y-3">
                  {/* Commission / Paid / Diff summary */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                      <div className="text-xs text-muted-foreground font-medium leading-tight">Commission</div>
                      <div className="tabular-nums font-bold text-green-600 dark:text-green-400 mt-1">{fmt(week.commission)}</div>
                    </div>
                    <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                      <div className="text-xs text-muted-foreground font-medium leading-tight">Paid</div>
                      <div className="tabular-nums font-bold text-purple-600 dark:text-purple-400 mt-1">{fmt(week.paid)}</div>
                    </div>
                    <div className={cn("rounded-xl px-3 py-2.5", isUnderpaid ? "bg-red-50 dark:bg-red-950/30" : "bg-muted/50")}>
                      <div className="text-xs text-muted-foreground font-medium leading-tight">Difference</div>
                      <div className={cn("tabular-nums font-bold mt-1", isUnderpaid ? "text-red-600 dark:text-red-400" : isOverpaid ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                        {isUnderpaid ? "−" : isOverpaid ? "+" : ""}{fmt(Math.abs(week.delta))}
                      </div>
                    </div>
                  </div>

                  {/* Material deduction row */}
                  {hasMaterials && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/60">
                      <HardHat size={13} className="text-orange-500 dark:text-orange-400 shrink-0" />
                      <span className="text-xs text-orange-700 dark:text-orange-400">
                        Mat. deducted: <span className="tabular-nums font-semibold">{fmt(week.materialMarkup)}</span>
                        {(week.commissionable ?? 0) > 0 && (
                          <> · Commissionable: <span className="tabular-nums font-semibold">{fmt(week.commissionable)}</span></>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Job breakdown */}
                  {weekJobs.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Jobs This Week</div>
                      <div className="space-y-1">
                        {weekJobs.map((job) => (
                          <div
                            key={job.id}
                            className="rounded-xl bg-muted/30 px-3 py-2.5"
                            data-testid={`item-week-job-${job.id}`}
                          >
                            {/* Mobile: stacked */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm truncate">{job.customerName}</span>
                                  <span className="font-mono text-xs text-muted-foreground hidden sm:inline">{job.jobNumber}</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">{job.serviceType} · {fmtDate(job.jobDate)}</div>
                                {(job.materialMarkupAmount ?? 0) > 0 && (
                                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                                    Mat. deducted: <span className="tabular-nums font-medium">{fmt(job.materialMarkupAmount)}</span>
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xs text-muted-foreground tabular-nums">{fmt(job.invoiceTotal)}</div>
                                <div className="font-bold text-sm text-green-600 dark:text-green-400 tabular-nums">{fmt(job.commissionEarned)}</div>
                                <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", `status-${job.status}`)}>
                                  {job.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {weekJobs.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No job entries for this week — payment recorded only.</p>
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
