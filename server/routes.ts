import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertJobSchema, insertPaymentSchema } from "@shared/schema";
import { sheetsSyncAllJobs, sheetsSyncAllPayments } from "./sheets";

// Calculate all derived fields for a job
function calcJobFields(data: any) {
  const materialCost = parseFloat(data.materialCost ?? data.material_cost ?? 0);
  const materialMarkupRate = parseFloat(data.materialMarkupRate ?? data.material_markup_rate ?? 0.30);
  const invoiceTotal = parseFloat(data.invoiceTotal ?? data.invoice_total ?? 0);
  const commissionRate = parseFloat(data.commissionRate ?? data.commission_rate ?? 0.25);

  // Full marked-up material amount = cost + markup (e.g. $500 + 30% = $650)
  const materialMarkupAmount = parseFloat((materialCost * (1 + materialMarkupRate)).toFixed(2));
  const commissionableAmount = parseFloat((Math.max(0, invoiceTotal - materialMarkupAmount)).toFixed(2));
  const commissionEarned = parseFloat((commissionableAmount * commissionRate).toFixed(2));

  return { materialMarkupAmount, commissionableAmount, commissionEarned };
}

export function registerRoutes(httpServer: Server, app: Express) {

  // ── Jobs ──────────────────────────────────────────────────────────────────

  app.get("/api/jobs", async (_req, res) => {
    try {
      res.json(await storage.getAllJobs());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    const job = await storage.getJobById(Number(req.params.id));
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  });

  app.post("/api/jobs", async (req, res) => {
    const parsed = insertJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = parsed.data;
    const calc = calcJobFields(data);
    Object.assign(data, calc);
    try {
      const job = await storage.createJob(data);
      setImmediate(() => storage.getAllJobs().then(jobs => sheetsSyncAllJobs(jobs)));
      res.status(201).json(job);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/jobs/:id", async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getJobById(id);
    if (!existing) return res.status(404).json({ error: "Job not found" });
    const merged = { ...existing, ...req.body };
    const calc = calcJobFields(merged);
    const data = { ...req.body, ...calc };
    try {
      const job = await storage.updateJob(id, data);
      setImmediate(() => storage.getAllJobs().then(jobs => sheetsSyncAllJobs(jobs)));
      res.json(job);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    await storage.deleteJob(Number(req.params.id));
    setImmediate(() => storage.getAllJobs().then(jobs => sheetsSyncAllJobs(jobs)));
    res.status(204).send();
  });

  app.get("/api/jobs/week/:weekOf", async (req, res) => {
    res.json(await storage.getJobsByWeek(req.params.weekOf));
  });

  // ── Payments ──────────────────────────────────────────────────────────────

  app.get("/api/payments", async (_req, res) => {
    try {
      res.json(await storage.getAllPayments());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/payments", async (req, res) => {
    const parsed = insertPaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const payment = await storage.createPayment(parsed.data);
      setImmediate(() => storage.getAllPayments().then(payments => sheetsSyncAllPayments(payments)));
      res.status(201).json(payment);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/payments/:id", async (req, res) => {
    const payment = await storage.updatePayment(Number(req.params.id), req.body);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    setImmediate(() => storage.getAllPayments().then(payments => sheetsSyncAllPayments(payments)));
    res.json(payment);
  });

  app.delete("/api/payments/:id", async (req, res) => {
    await storage.deletePayment(Number(req.params.id));
    setImmediate(() => storage.getAllPayments().then(payments => sheetsSyncAllPayments(payments)));
    res.status(204).send();
  });

  // ── Summary ───────────────────────────────────────────────────────────────

  app.get("/api/summary", async (_req, res) => {
    try {
      const allJobs = await storage.getAllJobs();
      const allPayments = await storage.getAllPayments();

      const totalSales = allJobs.reduce((s, j) => s + j.invoiceTotal, 0);
      const totalMaterialCost = allJobs.reduce((s, j) => s + j.materialCost, 0);
      const totalMaterialMarkup = allJobs.reduce((s, j) => s + j.materialMarkupAmount, 0);
      const totalCommissionable = allJobs.reduce((s, j) => s + j.commissionableAmount, 0);
      const totalCommissionEarned = allJobs.reduce((s, j) => s + j.commissionEarned, 0);
      const totalPaid = allPayments.reduce((s, p) => s + p.amountPaid, 0);
      const balance = totalCommissionEarned - totalPaid;

      const weekMap: Record<string, { sales: number; materialMarkup: number; commissionable: number; commission: number; paid: number; jobCount: number }> = {};
      allJobs.forEach((j) => {
        if (!weekMap[j.weekOf]) weekMap[j.weekOf] = { sales: 0, materialMarkup: 0, commissionable: 0, commission: 0, paid: 0, jobCount: 0 };
        weekMap[j.weekOf].sales += j.invoiceTotal;
        weekMap[j.weekOf].materialMarkup += j.materialMarkupAmount;
        weekMap[j.weekOf].commissionable += j.commissionableAmount;
        weekMap[j.weekOf].commission += j.commissionEarned;
        weekMap[j.weekOf].jobCount += 1;
      });
      allPayments.forEach((p) => {
        if (!weekMap[p.weekOf]) weekMap[p.weekOf] = { sales: 0, materialMarkup: 0, commissionable: 0, commission: 0, paid: 0, jobCount: 0 };
        weekMap[p.weekOf].paid += p.amountPaid;
      });

      const weeks = Object.entries(weekMap)
        .map(([weekOf, data]) => ({ weekOf, ...data, delta: data.commission - data.paid }))
        .sort((a, b) => b.weekOf.localeCompare(a.weekOf));

      res.json({ totalSales, totalMaterialCost, totalMaterialMarkup, totalCommissionable, totalCommissionEarned, totalPaid, balance, jobCount: allJobs.length, weeks });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/sync-sheets", async (_req, res) => {
    try {
      const allJobs = await storage.getAllJobs();
      const allPayments = await storage.getAllPayments();
      setImmediate(async () => {
        await sheetsSyncAllJobs(allJobs);
        await sheetsSyncAllPayments(allPayments);
      });
      res.json({ message: "Sync started", jobs: allJobs.length, payments: allPayments.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
