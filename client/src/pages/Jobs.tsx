import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertJobSchema, type Job, type InsertJob } from "@shared/schema";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Briefcase, HardHat, ChevronRight, Calendar, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = insertJobSchema.extend({
  invoiceTotal: z.coerce.number().min(0),
  materialCost: z.coerce.number().min(0),
  commissionRate: z.coerce.number().min(0).max(1),
  materialMarkupRate: z.coerce.number().min(0).max(1),
});

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function todayLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const SERVICE_TYPES = ["Plumbing", "Drain Cleaning", "Water Heater", "HVAC", "Sewer", "Repipe", "Leak Repair", "Other"];

function JobForm({ defaultValues, onSubmit, isPending }: {
  defaultValues?: Partial<InsertJob>;
  onSubmit: (data: InsertJob) => void;
  isPending: boolean;
}) {
  const form = useForm<InsertJob>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobNumber: "",
      customerName: "",
      serviceType: "Plumbing",
      jobDate: todayLocal(),
      invoiceTotal: 0,
      materialCost: 0,
      materialMarkupRate: 0.30,
      materialMarkupAmount: 0,
      commissionableAmount: 0,
      commissionRate: 0.25,
      commissionEarned: 0,
      status: "completed",
      notes: "",
      weekOf: getMondayOf(todayLocal()),
      ...defaultValues,
    },
  });

  const invoiceTotal = Number(form.watch("invoiceTotal")) || 0;
  const materialCost = Number(form.watch("materialCost")) || 0;
  const materialMarkupRate = Number(form.watch("materialMarkupRate")) || 0.30;
  const commissionRate = Number(form.watch("commissionRate")) || 0.25;

  // Company charges cost + markup %, full amount deducted from commissionable base
  const materialMarkupAmount = materialCost * (1 + materialMarkupRate);
  const materialProfit = materialMarkupAmount - materialCost; // what company pockets on markup
  const commissionableAmount = Math.max(0, invoiceTotal - materialMarkupAmount);
  const commissionEarned = commissionableAmount * commissionRate;
  const companyTake = commissionableAmount * (1 - commissionRate); // company's cut of commissionable
  const hasMaterials = materialCost > 0;

  const handleSubmit = (data: InsertJob) => {
    data.weekOf = getMondayOf(data.jobDate);
    data.materialMarkupAmount = parseFloat((data.materialCost * (1 + data.materialMarkupRate)).toFixed(2));
    data.commissionableAmount = parseFloat((Math.max(0, data.invoiceTotal - data.materialMarkupAmount)).toFixed(2));
    data.commissionEarned = parseFloat((data.commissionableAmount * data.commissionRate).toFixed(2));
    onSubmit(data);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Job / Invoice #</Label>
          <Input data-testid="input-job-number" {...form.register("jobNumber")} placeholder="e.g. ST-10045" />
        </div>
        <div className="space-y-1.5">
          <Label>Job Date</Label>
          <Input data-testid="input-job-date" type="date" {...form.register("jobDate")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Customer Name</Label>
        <Input data-testid="input-customer-name" {...form.register("customerName")} placeholder="e.g. John Smith" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Service Type</Label>
          <Select defaultValue={defaultValues?.serviceType || "Plumbing"} onValueChange={(v) => form.setValue("serviceType", v)}>
            <SelectTrigger data-testid="select-service-type"><SelectValue /></SelectTrigger>
            <SelectContent>{SERVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select defaultValue={defaultValues?.status || "completed"} onValueChange={(v) => form.setValue("status", v)}>
            <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Invoice Total ($)</Label>
        <Input data-testid="input-invoice-total" type="number" step="0.01" min="0" {...form.register("invoiceTotal", { valueAsNumber: true })} placeholder="0.00" />
      </div>

      {/* Materials section */}
      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <HardHat size={14} />
          Material Costs
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Material Cost ($)</Label>
            <Input data-testid="input-material-cost" type="number" step="0.01" min="0" {...form.register("materialCost", { valueAsNumber: true })} placeholder="0.00" />
            <p className="text-xs text-muted-foreground">What materials actually cost</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Company Markup</Label>
            <Select defaultValue={String(defaultValues?.materialMarkupRate ?? 0.30)} onValueChange={(v) => form.setValue("materialMarkupRate", parseFloat(v))}>
              <SelectTrigger data-testid="select-markup-rate"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.20">20%</SelectItem>
                <SelectItem value="0.25">25%</SelectItem>
                <SelectItem value="0.30">30% (default)</SelectItem>
                <SelectItem value="0.35">35%</SelectItem>
                <SelectItem value="0.40">40%</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Markup added on top</p>
          </div>
        </div>

        {hasMaterials && (
          <div className="space-y-2 pt-1">
            {/* Deduction formula */}
            <div className="rounded-lg bg-background border border-border px-3 py-2 text-xs text-muted-foreground">
              <span className="font-mono">{fmt(materialCost)}</span>
              <span className="mx-1">×</span>
              <span className="font-mono">{(1 + materialMarkupRate).toFixed(2)}</span>
              <span className="mx-1">=</span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">{fmt(materialMarkupAmount)}</span>
              <span className="ml-1">deducted from invoice</span>
            </div>

            {/* Commissionable + your cut */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-background border border-border px-3 py-2">
                <div className="text-xs text-muted-foreground">Commissionable base</div>
                <div className="text-sm font-semibold tabular-nums mt-0.5">{fmt(commissionableAmount)}</div>
              </div>
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
                <div className="text-xs text-muted-foreground">Your commission</div>
                <div className="text-sm font-bold text-green-700 dark:text-green-400 tabular-nums mt-0.5">{fmt(commissionEarned)}</div>
              </div>
            </div>

            {/* Who gets what */}
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profit breakdown</div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Your commission</span>
                <span className="tabular-nums font-semibold text-green-600 dark:text-green-400">{fmt(commissionEarned)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Company (labor cut)</span>
                <span className="tabular-nums font-medium text-foreground">{fmt(companyTake)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Company (material markup profit)</span>
                <span className="tabular-nums font-medium text-orange-600 dark:text-orange-400">{fmt(materialProfit)}</span>
              </div>
              <div className="border-t border-border pt-1.5 flex justify-between items-center text-xs">
                <span className="font-semibold text-muted-foreground">Total company takes</span>
                <span className="tabular-nums font-bold text-foreground">{fmt(companyTake + materialProfit)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Commission preview when no materials */}
      {!hasMaterials && invoiceTotal > 0 && (
        <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3">
          <div className="text-xs text-green-700 dark:text-green-400 font-medium">Commission You Should Earn</div>
          <div className="text-xl font-bold text-green-700 dark:text-green-300 tabular-nums mt-0.5">{fmt(commissionEarned)}</div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Commission Rate</Label>
        <Select defaultValue={String(defaultValues?.commissionRate || 0.25)} onValueChange={(v) => form.setValue("commissionRate", parseFloat(v))}>
          <SelectTrigger data-testid="select-commission-rate"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0.20">20%</SelectItem>
            <SelectItem value="0.25">25%</SelectItem>
            <SelectItem value="0.30">30%</SelectItem>
            <SelectItem value="0.35">35%</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Notes (optional)</Label>
        <Textarea data-testid="input-notes" {...form.register("notes")} placeholder="Any discrepancies, customer notes..." rows={2} />
      </div>

      <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isPending} data-testid="button-submit-job">
        {isPending ? "Saving..." : "Save Job"}
      </Button>
    </form>
  );
}

// Mobile job card component
function JobCard({ job, onEdit, onDelete }: { job: Job; onEdit: () => void; onDelete: () => void }) {
  const hasMaterials = (job.materialMarkupAmount ?? 0) > 0;
  return (
    <Card className="border-border active:scale-[0.99] transition-transform" data-testid={`row-job-${job.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{job.customerName}</span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium shrink-0", `status-${job.status}`)}>{job.status}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="font-mono">{job.jobNumber}</span>
              <span>·</span>
              <span>{job.serviceType}</span>
              <span>·</span>
              <span>{fmtDate(job.jobDate)}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div>
            <div className="text-xs text-muted-foreground">Invoice</div>
            <div className="tabular-nums font-semibold text-sm">{fmt(job.invoiceTotal)}</div>
          </div>
          {hasMaterials && (
            <div>
              <div className="text-xs text-muted-foreground">Mat. Deducted</div>
              <div className="tabular-nums font-semibold text-sm text-orange-600 dark:text-orange-400">−{fmt(job.materialMarkupAmount)}</div>
            </div>
          )}
          <div className={hasMaterials ? "" : "col-span-2"}>
            <div className="text-xs text-muted-foreground">Your Commission</div>
            <div className="tabular-nums font-bold text-sm text-green-600 dark:text-green-400">{fmt(job.commissionEarned)}</div>
          </div>
        </div>

        {hasMaterials && (() => {
          const matProfit = job.materialMarkupAmount - job.materialCost;
          const companyLabor = job.commissionableAmount * (1 - job.commissionRate);
          return (
            <div className="mt-2 rounded-lg border border-border bg-muted/20 px-3 py-2 space-y-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Profit Breakdown</div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Your commission</span>
                <span className="tabular-nums font-semibold text-green-600 dark:text-green-400">{fmt(job.commissionEarned)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Company labor cut</span>
                <span className="tabular-nums font-medium">{fmt(companyLabor)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Company markup profit</span>
                <span className="tabular-nums font-medium text-orange-600 dark:text-orange-400">{fmt(matProfit)}</span>
              </div>
              <div className="flex justify-between text-xs border-t border-border pt-1">
                <span className="font-semibold text-muted-foreground">Company total</span>
                <span className="tabular-nums font-bold">{fmt(companyLabor + matProfit)}</span>
              </div>
            </div>
          );
        })()}

        <div className="mt-3 flex items-center gap-2 pt-3 border-t border-border">
          <button
            data-testid={`button-edit-job-${job.id}`}
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
          >
            <Pencil size={14} />Edit
          </button>
          <button
            data-testid={`button-delete-job-${job.id}`}
            onClick={onDelete}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors font-medium"
          >
            <Trash2 size={14} />Delete
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmDeleteDialog({ open, onConfirm, onCancel, label }: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  label: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete this job?</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            <span className="font-medium text-foreground">{label}</span> will be permanently removed. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm}>Yes, Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Jobs() {
  const [open, setOpen] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [deleteJob, setDeleteJob] = useState<Job | null>(null);
  const { toast } = useToast();

  const { data: jobs = [], isLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });

  const createMutation = useMutation({
    mutationFn: (data: InsertJob) => apiRequest("POST", "/api/jobs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      setOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertJob> }) =>
      apiRequest("PATCH", `/api/jobs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      setEditJob(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      setDeleteJob(null);
    },
  });

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{jobs.length} job{jobs.length !== 1 ? "s" : ""} tracked</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-10 px-4 text-sm font-semibold" data-testid="button-add-job">
              <Plus size={16} className="mr-1.5" />Add Job
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[92dvh] overflow-y-auto">
            <DialogHeader><DialogTitle>Log a New Job</DialogTitle></DialogHeader>
            <JobForm onSubmit={(d) => createMutation.mutate(d)} isPending={createMutation.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      <ConfirmDeleteDialog
        open={!!deleteJob}
        label={deleteJob ? `${deleteJob.customerName} — ${deleteJob.jobNumber}` : ""}
        onConfirm={() => deleteJob && deleteMutation.mutate(deleteJob.id)}
        onCancel={() => setDeleteJob(null)}
      />

      <Dialog open={!!editJob} onOpenChange={(o) => !o && setEditJob(null)}>
        <DialogContent className="max-w-md max-h-[92dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Job</DialogTitle></DialogHeader>
          {editJob && (
            <JobForm defaultValues={editJob} onSubmit={(d) => updateMutation.mutate({ id: editJob.id, data: d })} isPending={updateMutation.isPending} />
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
      ) : jobs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-muted-foreground">
            <Briefcase size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No jobs yet</p>
            <p className="text-sm mt-1">Log your first job to start tracking commissions.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onEdit={() => setEditJob(job)}
                onDelete={() => setDeleteJob(job)}
              />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mat. Deducted</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors" data-testid={`row-job-${job.id}`}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{job.jobNumber}</td>
                    <td className="px-4 py-3 font-medium">{job.customerName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(job.jobDate)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(job.invoiceTotal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-orange-600 dark:text-orange-400">
                      {(job.materialMarkupAmount ?? 0) > 0 ? `−${fmt(job.materialMarkupAmount)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400 font-medium">{fmt(job.commissionEarned)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", `status-${job.status}`)}>{job.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button data-testid={`button-edit-job-${job.id}`} onClick={() => setEditJob(job)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Pencil size={13} /></button>
                        <button data-testid={`button-delete-job-${job.id}`} onClick={() => setDeleteJob(job)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
