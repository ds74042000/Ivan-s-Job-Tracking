import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";
import { jobs, payments, type Job, type InsertJob, type Payment, type InsertPayment } from "@shared/schema";

export const sqlite = new Database("data.db");
export const db = drizzle(sqlite);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    service_type TEXT NOT NULL,
    job_date TEXT NOT NULL,
    invoice_total REAL NOT NULL DEFAULT 0,
    material_cost REAL NOT NULL DEFAULT 0,
    material_markup_rate REAL NOT NULL DEFAULT 0.30,
    material_markup_amount REAL NOT NULL DEFAULT 0,
    commissionable_amount REAL NOT NULL DEFAULT 0,
    commission_rate REAL NOT NULL DEFAULT 0.25,
    commission_earned REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    notes TEXT DEFAULT '',
    week_of TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_of TEXT NOT NULL,
    amount_paid REAL NOT NULL DEFAULT 0,
    pay_date TEXT NOT NULL,
    notes TEXT DEFAULT ''
  );
`);

// Add new columns to existing tables if they don't exist (migration)
try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN material_cost REAL NOT NULL DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN material_markup_rate REAL NOT NULL DEFAULT 0.30`); } catch {}
try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN material_markup_amount REAL NOT NULL DEFAULT 0`); } catch {}
try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN commissionable_amount REAL NOT NULL DEFAULT 0`); } catch {}

export interface IStorage {
  getAllJobs(): Job[];
  getJobById(id: number): Job | undefined;
  createJob(job: InsertJob): Job;
  updateJob(id: number, job: Partial<InsertJob>): Job | undefined;
  deleteJob(id: number): void;
  getJobsByWeek(weekOf: string): Job[];
  getAllPayments(): Payment[];
  getPaymentById(id: number): Payment | undefined;
  createPayment(payment: InsertPayment): Payment;
  updatePayment(id: number, payment: Partial<InsertPayment>): Payment | undefined;
  deletePayment(id: number): void;
}

export class Storage implements IStorage {
  getAllJobs(): Job[] {
    return db.select().from(jobs).orderBy(desc(jobs.jobDate)).all();
  }
  getJobById(id: number): Job | undefined {
    return db.select().from(jobs).where(eq(jobs.id, id)).get();
  }
  createJob(job: InsertJob): Job {
    return db.insert(jobs).values(job).returning().get();
  }
  updateJob(id: number, data: Partial<InsertJob>): Job | undefined {
    return db.update(jobs).set(data).where(eq(jobs.id, id)).returning().get();
  }
  deleteJob(id: number): void {
    db.delete(jobs).where(eq(jobs.id, id)).run();
  }
  getJobsByWeek(weekOf: string): Job[] {
    return db.select().from(jobs).where(eq(jobs.weekOf, weekOf)).all();
  }
  getAllPayments(): Payment[] {
    return db.select().from(payments).orderBy(desc(payments.weekOf)).all();
  }
  getPaymentById(id: number): Payment | undefined {
    return db.select().from(payments).where(eq(payments.id, id)).get();
  }
  createPayment(payment: InsertPayment): Payment {
    return db.insert(payments).values(payment).returning().get();
  }
  updatePayment(id: number, data: Partial<InsertPayment>): Payment | undefined {
    return db.update(payments).set(data).where(eq(payments.id, id)).returning().get();
  }
  deletePayment(id: number): void {
    db.delete(payments).where(eq(payments.id, id)).run();
  }
}

export const storage = new Storage();
