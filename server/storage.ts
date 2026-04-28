import supabase from "./supabase";
import type { Job, InsertJob, Payment, InsertPayment } from "@shared/schema";

// ── Type helpers ──────────────────────────────────────────────────────────────

function toJob(row: any): Job {
  return {
    id: row.id,
    jobNumber: row.job_number,
    customerName: row.customer_name,
    serviceType: row.service_type,
    jobDate: row.job_date,
    weekOf: row.week_of,
    invoiceTotal: Number(row.invoice_total),
    materialCost: Number(row.material_cost),
    materialMarkupRate: Number(row.material_markup_rate),
    materialMarkupAmount: Number(row.material_markup_amount),
    commissionableAmount: Number(row.commissionable_amount),
    commissionRate: Number(row.commission_rate),
    commissionEarned: Number(row.commission_earned),
    status: row.status,
    notes: row.notes ?? "",
  };
}

function toPayment(row: any): Payment {
  return {
    id: row.id,
    weekOf: row.week_of,
    amountPaid: Number(row.amount_paid),
    payDate: row.pay_date,
    notes: row.notes ?? "",
  };
}

// ── Storage class ─────────────────────────────────────────────────────────────

export class Storage {
  // ── Jobs ──

  async getAllJobs(): Promise<Job[]> {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("job_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toJob);
  }

  async getJobById(id: number): Promise<Job | undefined> {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return undefined;
    return toJob(data);
  }

  async createJob(job: InsertJob): Promise<Job> {
    const { data, error } = await supabase
      .from("jobs")
      .insert({
        job_number: job.jobNumber,
        customer_name: job.customerName,
        service_type: job.serviceType,
        job_date: job.jobDate,
        week_of: job.weekOf,
        invoice_total: job.invoiceTotal,
        material_cost: job.materialCost,
        material_markup_rate: job.materialMarkupRate,
        material_markup_amount: job.materialMarkupAmount,
        commissionable_amount: job.commissionableAmount,
        commission_rate: job.commissionRate,
        commission_earned: job.commissionEarned,
        status: job.status,
        notes: job.notes ?? "",
      })
      .select()
      .single();
    if (error) throw error;
    return toJob(data);
  }

  async updateJob(id: number, job: Partial<InsertJob>): Promise<Job | undefined> {
    const update: any = {};
    if (job.jobNumber !== undefined) update.job_number = job.jobNumber;
    if (job.customerName !== undefined) update.customer_name = job.customerName;
    if (job.serviceType !== undefined) update.service_type = job.serviceType;
    if (job.jobDate !== undefined) update.job_date = job.jobDate;
    if (job.weekOf !== undefined) update.week_of = job.weekOf;
    if (job.invoiceTotal !== undefined) update.invoice_total = job.invoiceTotal;
    if (job.materialCost !== undefined) update.material_cost = job.materialCost;
    if (job.materialMarkupRate !== undefined) update.material_markup_rate = job.materialMarkupRate;
    if (job.materialMarkupAmount !== undefined) update.material_markup_amount = job.materialMarkupAmount;
    if (job.commissionableAmount !== undefined) update.commissionable_amount = job.commissionableAmount;
    if (job.commissionRate !== undefined) update.commission_rate = job.commissionRate;
    if (job.commissionEarned !== undefined) update.commission_earned = job.commissionEarned;
    if (job.status !== undefined) update.status = job.status;
    if (job.notes !== undefined) update.notes = job.notes;

    const { data, error } = await supabase
      .from("jobs")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) return undefined;
    return toJob(data);
  }

  async deleteJob(id: number): Promise<void> {
    await supabase.from("jobs").delete().eq("id", id);
  }

  async getJobsByWeek(weekOf: string): Promise<Job[]> {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("week_of", weekOf);
    if (error) throw error;
    return (data ?? []).map(toJob);
  }

  // ── Payments ──

  async getAllPayments(): Promise<Payment[]> {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("week_of", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toPayment);
  }

  async getPaymentById(id: number): Promise<Payment | undefined> {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return undefined;
    return toPayment(data);
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const { data, error } = await supabase
      .from("payments")
      .insert({
        week_of: payment.weekOf,
        amount_paid: payment.amountPaid,
        pay_date: payment.payDate,
        notes: payment.notes ?? "",
      })
      .select()
      .single();
    if (error) throw error;
    return toPayment(data);
  }

  async updatePayment(id: number, payment: Partial<InsertPayment>): Promise<Payment | undefined> {
    const update: any = {};
    if (payment.weekOf !== undefined) update.week_of = payment.weekOf;
    if (payment.amountPaid !== undefined) update.amount_paid = payment.amountPaid;
    if (payment.payDate !== undefined) update.pay_date = payment.payDate;
    if (payment.notes !== undefined) update.notes = payment.notes;

    const { data, error } = await supabase
      .from("payments")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) return undefined;
    return toPayment(data);
  }

  async deletePayment(id: number): Promise<void> {
    await supabase.from("payments").delete().eq("id", id);
  }
}

export const storage = new Storage();
