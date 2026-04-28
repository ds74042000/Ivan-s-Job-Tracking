import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Jobs table
export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobNumber: text("job_number").notNull(),
  customerName: text("customer_name").notNull(),
  serviceType: text("service_type").notNull(),
  jobDate: text("job_date").notNull(),
  invoiceTotal: real("invoice_total").notNull().default(0),
  // Material cost fields
  materialCost: real("material_cost").notNull().default(0),       // actual cost of materials
  materialMarkupRate: real("material_markup_rate").notNull().default(0.30), // 30% default
  materialMarkupAmount: real("material_markup_amount").notNull().default(0), // markup $ added to invoice
  commissionableAmount: real("commissionable_amount").notNull().default(0),  // invoice - markup amount
  // Commission fields
  commissionRate: real("commission_rate").notNull().default(0.25),
  commissionEarned: real("commission_earned").notNull().default(0), // 25% of commissionable amount
  status: text("status").notNull().default("completed"),
  notes: text("notes").default(""),
  weekOf: text("week_of").notNull(),
});

// Payments table
export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weekOf: text("week_of").notNull(),
  amountPaid: real("amount_paid").notNull().default(0),
  payDate: text("pay_date").notNull(),
  notes: text("notes").default(""),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true });

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
