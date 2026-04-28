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
  DialogFooter,
  DialogDescription,
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

function PaymentForm({
  defaultValues,
  onSubmit,
  isPending,
}: {
  defaultValues?: Partial<InsertPayment>;
  onSubmit: (data: InsertPayment) => void;
  isPending: boolean;
}) {
  const today = todayLocal();
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

      <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isPending} data-testid="button-submit-payment">
        {isPending ? "Saving..." : "Save Payment"}
      </Button>
    </form>
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
          <DialogTitle>Delete this payment?</DialogTitle>
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

export default function Payments() {
  const [open, setOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [deletePayment, setDeletePayment] = useState<Payment | null>(null);
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
      setDeletePayment(null);
      toast({ title: "Payment deleted" });
    },
  });

  const totalPaid = payments.reduce((s, p) => s + p.amountPaid, 0);

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Total received: <span className="tabular-nums font-semibold text-foreground">{fmt(totalPaid)}</span>
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-10 px-4 text-sm font-semibold" data-testid="button-add-payment">
              <Plus size={16} className="mr-1.5" />
              Log Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm max-h-[92dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log a Payment Received</DialogTitle>
            </DialogHeader>
            <PaymentForm onSubmit={(d) => createMutation.mutate(d)} isPending={createMutation.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      <ConfirmDeleteDialog
        open={!!deletePayment}
        label={deletePayment ? `${fmt(deletePayment.amountPaid)} on ${fmtDate(deletePayment.payDate)}` : ""}
        onConfirm={() => deletePayment && deleteMutation.mutate(deletePayment.id)}
        onCancel={() => setDeletePayment(null)}
      />

      <Dialog open={!!editPayment} onOpenChange={(o) => !o && setEditPayment(null)}>
        <DialogContent className="max-w-sm max-h-[92dvh] overflow-y-auto">
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
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : payments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-muted-foreground">
            <DollarSign size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No payments logged yet</p>
            <p className="text-sm mt-1">Record each paycheck to compare against what you earned.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {payments.map((p) => (
              <Card key={p.id} className="border-border" data-testid={`row-payment-${p.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{fmtDate(p.payDate)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Wk of {fmtDate(p.weekOf)}
                      </div>
                      {p.notes && <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">{p.notes}</div>}
                    </div>
                    <div className="text-right">
                      <div className="tabular-nums font-bold text-lg text-purple-600 dark:text-purple-400">{fmt(p.amountPaid)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 pt-3 border-t border-border">
                    <button
                      data-testid={`button-edit-payment-${p.id}`}
                      onClick={() => setEditPayment(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
                    >
                      <Pencil size={14} />Edit
                    </button>
                    <button
                      data-testid={`button-delete-payment-${p.id}`}
                      onClick={() => setDeletePayment(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors font-medium"
                    >
                      <Trash2 size={14} />Delete
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pay Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Week Of</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount Paid</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors" data-testid={`row-payment-${p.id}`}>
                    <td className="px-4 py-3 font-medium">{fmtDate(p.payDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground">Wk of {fmtDate(p.weekOf)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-purple-600 dark:text-purple-400">{fmt(p.amountPaid)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.notes || "—"}</td>
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
                          onClick={() => setDeletePayment(p)}
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
        </>
      )}
    </div>
  );
}
