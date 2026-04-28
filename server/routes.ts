import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertJobSchema, insertPaymentSchema } from "@shared/schema";
import { sheetsSyncAllJobs, sheetsSyncAllPayments } from "./sheets";

export function registerRoutes(httpServer: Server, app: Express) {

  // ── Jobs ──────────────────────────────────────────────────────────
  app.get("/api/jobs", (_req, res) => {
    res.json(storage.getAllJobs());
  });

  app.get("/api/jobs/:id", (req, res) => {
    const job = storage.getJobById(Number(req.params.id));
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  });

  app.post("/api/jobs", (req, res) => {
    const parsed = insertJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = parsed.data;
    data.commissionEarned = parseFloat((data.invoiceTotal * data.commissionRate).toFixed(2));
    const job = storage.createJob(data);
    // Sync full jobs list to Sheets in background
    setImmediate(() => sheetsSyncAllJobs(storage.getAllJobs()));
    res.status(201).json(job);
  });

  app.patch("/api/jobs/:id", (req, res) => {
    const id = Number(req.params.id);
    const data = req.body;
    if (data.invoiceTotal !== undefined && data.commissionRate !== undefined) {
      data.commissionEarned = parseFloat((data.invoiceTotal * data.commissionRate).toFixed(2));
    } else if (data.invoiceTotal !== undefined) {
      const existing = storage.getJobById(id);
      if (existing) {
        data.commissionEarned = parseFloat((data.invoiceTotal * existing.commissionRate).toFixed(2));
      }
    }
    const job = storage.updateJob(id, data);
    if (!job) return res.status(404).json({ error: "Job not found" });
    setImmediate(() => sheetsSyncAllJobs(storage.getAllJobs()));
    res.json(job);
  });

  app.delete("/api/jobs/:id", (req, res) => {
    storage.deleteJob(Number(req.params.id));
    setImmediate(() => sheetsSyncAllJobs(storage.getAllJobs()));
    res.status(204).send();
  });

  app.get("/api/jobs/week/:weekOf", (req, res) => {
    res.json(storage.getJobsByWeek(req.params.weekOf));
  });

  // ── Payments ──────────────────────────────────────────────────────
  app.get("/api/payments", (_req, res) => {
    res.json(storage.getAllPayments());
  });

  app.post("/api/payments", (req, res) => {
    const parsed = insertPaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const payment = storage.createPayment(parsed.data);
    setImmediate(() => sheetsSyncAllPayments(storage.getAllPayments()));
    res.status(201).json(payment);
  });

  app.patch("/api/payments/:id", (req, res) => {
    const payment = storage.updatePayment(Number(req.params.id), req.body);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    setImmediate(() => sheetsSyncAllPayments(storage.getAllPayments()));
    res.json(payment);
  });

  app.delete("/api/payments/:id", (req, res) => {
    storage.deletePayment(Number(req.params.id));
    setImmediate(() => sheetsSyncAllPayments(storage.getAllPayments()));
    res.status(204).send();
  });

  // ── Summary ───────────────────────────────────────────────────────
  app.get("/api/summary", (_req, res) => {
    const allJobs = storage.getAllJobs();
    const allPayments = storage.getAllPayments();

    const totalSales = allJobs.reduce((sum, j) => sum + j.invoiceTotal, 0);
    const totalCommissionEarned = allJobs.reduce((sum, j) => sum + j.commissionEarned, 0);
    const totalPaid = allPayments.reduce((sum, p) => sum + p.amountPaid, 0);
    const balance = totalCommissionEarned - totalPaid;

    const weekMap: Record<string, { sales: number; commission: number; paid: number; jobCount: number }> = {};
    allJobs.forEach((j) => {
      if (!weekMap[j.weekOf]) weekMap[j.weekOf] = { sales: 0, commission: 0, paid: 0, jobCount: 0 };
      weekMap[j.weekOf].sales += j.invoiceTotal;
      weekMap[j.weekOf].commission += j.commissionEarned;
      weekMap[j.weekOf].jobCount += 1;
    });
    allPayments.forEach((p) => {
      if (!weekMap[p.weekOf]) weekMap[p.weekOf] = { sales: 0, commission: 0, paid: 0, jobCount: 0 };
      weekMap[p.weekOf].paid += p.amountPaid;
    });

    const weeks = Object.entries(weekMap)
      .map(([weekOf, data]) => ({ weekOf, ...data, delta: data.commission - data.paid }))
      .sort((a, b) => b.weekOf.localeCompare(a.weekOf));

    res.json({ totalSales, totalCommissionEarned, totalPaid, balance, jobCount: allJobs.length, weeks });
  });

  // ── Manual full sync endpoint ─────────────────────────────────────
  app.post("/api/sync-sheets", (_req, res) => {
    const allJobs = storage.getAllJobs();
    const allPayments = storage.getAllPayments();
    setImmediate(async () => {
      await sheetsSyncAllJobs(allJobs);
      await sheetsSyncAllPayments(allPayments);
    });
    res.json({ message: "Sync started", jobs: allJobs.length, payments: allPayments.length });
  });
}
