import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPaymentSchema, type Payment, type InsertPayment } from "@shared/schema";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, DollarSign } from "lucide-react";

const formSchema = insertPaymentSchema.extend({
  amountPaid: z.coerce.number().min(0, "Must be positive"),
});

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function PaymentForm({
  defaultValues,
  onSubmit,
  isPending,
}: {
  defaultValues?: Partial<InsertPayment>;
  onSubmit: (data: InsertPayment) => void;
  isPending: boolean;
}) {
  const today = new Date().toISOString().split("T")[0];
  const form = useForm<InsertPayment>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      weekOf: getMondayOf(today),
      amountPaid: 0,
      payDate: today,
      notes: "",
      ...defaultValues,
    },
  });

  const handleSubmit = (data: InsertPayment) => {
    data.weekOf = getMondayOf(data.payDate);
    onSubmit(data);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="payDate">Pay Date</Label>
          <Input id="payDate" data-testid="input-pay-date" type="date" {...form.register("payDate")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amountPaid">Amount Paid ($)</Label>
          <Input
            id="amountPaid"
            data-testid="input-amount-paid"
            type="number"
            step="0.01"
            min="0"
            {...form.register("amountPaid", { valueAsNumber: true })}
            placeholder="0.00"
          />
          {form.formState.errors.amountPaid && (
            <p className="text-xs text-destructive">{form.formState.errors.amountPaid.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="payNotes">Notes (optional)</Label>
        <Textarea id="payNotes" data-testid="input-pay-notes" {...form.register("notes")} placeholder="Check number, direct deposit reference..." rows={2} />
      </div>

      <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit-payment">
        {isPending ? "Saving..." : "Save Payment"}
      </Button>
    </form>
  );
}

export default function Payments() {
  const [open, setOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const { toast } = useToast();

  const { data: payments = [], isLoading } = useQuery<Payment[]>({ queryKey: ["/api/payments"] });

  const createMutation = useMutation({
    mutationFn: (data: InsertPayment) => apiRequest("POST", "/api/payments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      setOpen(false);
      toast({ title: "Payment logged" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertPayment> }) =>
      apiRequest("PATCH", `/api/payments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      setEditPayment(null);
      toast({ title: "Payment updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      toast({ title: "Payment deleted" });
    },
  });

  const totalPaid = payments.reduce((s, p) => s + p.amountPaid, 0);

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Total received: <span className="tabular-nums font-semibold text-foreground">{fmt(totalPaid)}</span></p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-payment">
              <Plus size={15} className="mr-1.5" />
              Log Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Log a Payment Received</DialogTitle>
            </DialogHeader>
            <PaymentForm onSubmit={(d) => createMutation.mutate(d)} isPending={createMutation.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!editPayment} onOpenChange={(o) => !o && setEditPayment(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
          </DialogHeader>
          {editPayment && (
            <PaymentForm
              defaultValues={editPayment}
              onSubmit={(d) => updateMutation.mutate({ id: editPayment.id, data: d })}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : payments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-muted-foreground">
            <DollarSign size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No payments logged yet</p>
            <p className="text-sm mt-1">Record each paycheck to compare against what you earned.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pay Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Week Of</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount Paid</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Notes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors" data-testid={`row-payment-${p.id}`}>
                  <td className="px-4 py-3 font-medium">
                    {new Date(p.payDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Wk of {new Date(p.weekOf + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-purple-600 dark:text-purple-400">{fmt(p.amountPaid)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">{p.notes || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        data-testid={`button-edit-payment-${p.id}`}
                        onClick={() => setEditPayment(p)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        data-testid={`button-delete-payment-${p.id}`}
                        onClick={() => deleteMutation.mutate(p.id)}
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
