import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Jobs table — each job/invoice from ServiceTitan
export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobNumber: text("job_number").notNull(),
  customerName: text("customer_name").notNull(),
  serviceType: text("service_type").notNull(), // plumbing, hvac, drain, etc.
  jobDate: text("job_date").notNull(), // ISO date string
  invoiceTotal: real("invoice_total").notNull().default(0),
  commissionRate: real("commission_rate").notNull().default(0.25), // 25% default
  commissionEarned: real("commission_earned").notNull().default(0),
  status: text("status").notNull().default("completed"), // completed, pending, disputed
  notes: text("notes").default(""),
  weekOf: text("week_of").notNull(), // ISO date string of week start (Monday)
});

// Weekly payments — what you actually received
export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weekOf: text("week_of").notNull(), // ISO date string of week start
  amountPaid: real("amount_paid").notNull().default(0),
  payDate: text("pay_date").notNull(),
  notes: text("notes").default(""),
});

// Insert schemas
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true });

// Types
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
