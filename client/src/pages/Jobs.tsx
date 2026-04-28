import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertJobSchema, type Job, type InsertJob } from "@shared/schema";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = insertJobSchema.extend({
  invoiceTotal: z.coerce.number().min(0, "Must be positive"),
  commissionRate: z.coerce.number().min(0).max(1),
});

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// Get Monday of the week for a given date
function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

const SERVICE_TYPES = ["Plumbing", "Drain Cleaning", "Water Heater", "HVAC", "Sewer", "Repipe", "Leak Repair", "Other"];

function JobForm({
  defaultValues,
  onSubmit,
  isPending,
}: {
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
      jobDate: new Date().toISOString().split("T")[0],
      invoiceTotal: 0,
      commissionRate: 0.25,
      commissionEarned: 0,
      status: "completed",
      notes: "",
      weekOf: getMondayOf(new Date().toISOString().split("T")[0]),
      ...defaultValues,
    },
  });

  const watchDate = form.watch("jobDate");
  const watchTotal = form.watch("invoiceTotal");
  const watchRate = form.watch("commissionRate");
  const estimatedCommission = (Number(watchTotal) || 0) * (Number(watchRate) || 0.25);

  const handleSubmit = (data: InsertJob) => {
    data.weekOf = getMondayOf(data.jobDate);
    data.commissionEarned = parseFloat((data.invoiceTotal * data.commissionRate).toFixed(2));
    onSubmit(data);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="jobNumber">Job / Invoice #</Label>
          <Input id="jobNumber" data-testid="input-job-number" {...form.register("jobNumber")} placeholder="e.g. ST-10045" />
          {form.formState.errors.jobNumber && (
            <p className="text-xs text-destructive">{form.formState.errors.jobNumber.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jobDate">Job Date</Label>
          <Input id="jobDate" data-testid="input-job-date" type="date" {...form.register("jobDate")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="customerName">Customer Name</Label>
        <Input id="customerName" data-testid="input-customer-name" {...form.register("customerName")} placeholder="e.g. John Smith" />
        {form.formState.errors.customerName && (
          <p className="text-xs text-destructive">{form.formState.errors.customerName.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Service Type</Label>
          <Select
            defaultValue={defaultValues?.serviceType || "Plumbing"}
            onValueChange={(v) => form.setValue("serviceType", v)}
          >
            <SelectTrigger data-testid="select-service-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            defaultValue={defaultValues?.status || "completed"}
            onValueChange={(v) => form.setValue("status", v)}
          >
            <SelectTrigger data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="invoiceTotal">Invoice Total ($)</Label>
          <Input
            id="invoiceTotal"
            data-testid="input-invoice-total"
            type="number"
            step="0.01"
            min="0"
            {...form.register("invoiceTotal", { valueAsNumber: true })}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="commissionRate">Commission Rate</Label>
          <Select
            defaultValue={String(defaultValues?.commissionRate || 0.25)}
            onValueChange={(v) => form.setValue("commissionRate", parseFloat(v))}
          >
            <SelectTrigger data-testid="select-commission-rate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.20">20%</SelectItem>
              <SelectItem value="0.25">25%</SelectItem>
              <SelectItem value="0.30">30%</SelectItem>
              <SelectItem value="0.35">35%</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Live commission preview */}
      <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3">
        <div className="text-xs text-green-700 dark:text-green-400 font-medium">Commission You Should Earn</div>
        <div className="text-lg font-bold text-green-700 dark:text-green-300 tabular-nums mt-0.5">
          {fmt(estimatedCommission)}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" data-testid="input-notes" {...form.register("notes")} placeholder="Any discrepancies, customer notes..." rows={2} />
      </div>

      <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit-job">
        {isPending ? "Saving..." : "Save Job"}
      </Button>
    </form>
  );
}

export default function Jobs() {
  const [open, setOpen] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const { toast } = useToast();

  const { data: jobs = [], isLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });

  const createMutation = useMutation({
    mutationFn: (data: InsertJob) => apiRequest("POST", "/api/jobs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      setOpen(false);
      toast({ title: "Job added", description: "Commission tracked successfully." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertJob> }) =>
      apiRequest("PATCH", `/api/jobs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      setEditJob(null);
      toast({ title: "Job updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      toast({ title: "Job deleted" });
    },
  });

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{jobs.length} jobs tracked</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-job">
              <Plus size={15} className="mr-1.5" />
              Add Job
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log a New Job</DialogTitle>
            </DialogHeader>
            <JobForm onSubmit={(d) => createMutation.mutate(d)} isPending={createMutation.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editJob} onOpenChange={(o) => !o && setEditJob(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Job</DialogTitle>
          </DialogHeader>
          {editJob && (
            <JobForm
              defaultValues={editJob}
              onSubmit={(d) => updateMutation.mutate({ id: editJob.id, data: d })}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : jobs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-muted-foreground">
            <Briefcase size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No jobs yet</p>
            <p className="text-sm mt-1">Log your first job to start tracking commissions.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Service</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice</th>
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
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{job.serviceType}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{new Date(job.jobDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(job.invoiceTotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400 font-medium">{fmt(job.commissionEarned)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", `status-${job.status}`)}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        data-testid={`button-edit-job-${job.id}`}
                        onClick={() => setEditJob(job)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        data-testid={`button-delete-job-${job.id}`}
                        onClick={() => deleteMutation.mutate(job.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
