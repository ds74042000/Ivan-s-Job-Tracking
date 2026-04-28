import { execSync } from "child_process";
import type { Job, Payment } from "@shared/schema";

const SPREADSHEET_ID = "1m3plr0n_YAAFldaWIa2wmBeY_pqSxtSP7ZzbVrNne10";

function callTool(toolName: string, args: Record<string, unknown>) {
  try {
    const params = JSON.stringify({
      source_id: "google_sheets__pipedream",
      tool_name: toolName,
      arguments: args,
    });
    const result = execSync(`external-tool call '${params}'`, {
      timeout: 20000,
      env: { ...process.env },
    }).toString();
    return JSON.parse(result);
  } catch (err) {
    console.error("[Sheets sync error]", err);
    return null;
  }
}

// ── Jobs sync ─────────────────────────────────────────────────────────────────

export async function sheetsSyncAllJobs(jobs: Job[]) {
  callTool("google_sheets-clear-rows", {
    spreadsheetId: SPREADSHEET_ID,
    sheetName: "Jobs",
    range: "A2:P1000",
  });
  if (!jobs.length) return;
  callTool("google_sheets-add-rows", {
    spreadsheetId: SPREADSHEET_ID,
    sheetName: "Jobs",
    rows: JSON.stringify(
      jobs.map((job) => ({
        ID: job.id,
        "Job Number": job.jobNumber,
        "Customer Name": job.customerName,
        "Service Type": job.serviceType,
        "Job Date": job.jobDate,
        "Week Of": job.weekOf,
        "Invoice Total": job.invoiceTotal,
        "Material Cost": job.materialCost ?? 0,
        "Material Markup Rate": job.materialMarkupRate ?? 0.30,
        "Material Markup Amount": job.materialMarkupAmount ?? 0,
        "Commissionable Amount": job.commissionableAmount ?? 0,
        "Commission Rate": job.commissionRate ?? 0.25,
        "Commission Earned": job.commissionEarned,
        Status: job.status,
        Notes: job.notes || "",
        "Created At": new Date().toISOString(),
      }))
    ),
    hasHeaders: true,
  });
}

// ── Payments sync ─────────────────────────────────────────────────────────────

export async function sheetsSyncAllPayments(payments: Payment[]) {
  callTool("google_sheets-clear-rows", {
    spreadsheetId: SPREADSHEET_ID,
    sheetName: "Payments",
    range: "A2:F1000",
  });
  if (!payments.length) return;
  callTool("google_sheets-add-rows", {
    spreadsheetId: SPREADSHEET_ID,
    sheetName: "Payments",
    rows: JSON.stringify(
      payments.map((p) => ({
        ID: p.id,
        "Week Of": p.weekOf,
        "Pay Date": p.payDate,
        "Amount Paid": p.amountPaid,
        Notes: p.notes || "",
        "Created At": new Date().toISOString(),
      }))
    ),
    hasHeaders: true,
  });
}

// ── Startup restore ───────────────────────────────────────────────────────────
// Called once on boot. Reads both sheets and re-seeds local SQLite so data
// survives Render restarts (free tier has no persistent disk).

export function sheetsRestoreToDb() {
  try {
    console.log("[Sheets restore] Reading from Google Sheets...");

    const jobsResult = callTool("google_sheets-read-rows", {
      spreadsheetId: SPREADSHEET_ID,
      sheetName: "Jobs",
    });

    const paymentsResult = callTool("google_sheets-read-rows", {
      spreadsheetId: SPREADSHEET_ID,
      sheetName: "Payments",
    });

    // Use the raw sqlite instance for INSERT OR REPLACE with explicit IDs
    const { sqlite } = require("./storage");

    // Parse rows — handle both direct array and wrapped response
    function parseRows(result: any): any[] {
      if (!result) return [];
      const raw = typeof result === "string" ? JSON.parse(result) : result;
      if (Array.isArray(raw)) return raw;
      return raw?.rows ?? raw?.data ?? raw?.values ?? [];
    }

    const jobRows = parseRows(jobsResult);
    const paymentRows = parseRows(paymentsResult);

    if (jobRows.length === 0 && paymentRows.length === 0) {
      console.log("[Sheets restore] Sheets are empty — starting fresh.");
      return;
    }

    console.log(`[Sheets restore] Restoring ${jobRows.length} jobs, ${paymentRows.length} payments...`);

    // Prepare statements for fast bulk insert
    const insertJob = sqlite.prepare(`
      INSERT OR REPLACE INTO jobs (
        id, job_number, customer_name, service_type, job_date, week_of,
        invoice_total, material_cost, material_markup_rate, material_markup_amount,
        commissionable_amount, commission_rate, commission_earned, status, notes
      ) VALUES (
        @id, @jobNumber, @customerName, @serviceType, @jobDate, @weekOf,
        @invoiceTotal, @materialCost, @materialMarkupRate, @materialMarkupAmount,
        @commissionableAmount, @commissionRate, @commissionEarned, @status, @notes
      )
    `);

    const insertPayment = sqlite.prepare(`
      INSERT OR REPLACE INTO payments (id, week_of, pay_date, amount_paid, notes)
      VALUES (@id, @weekOf, @payDate, @amountPaid, @notes)
    `);

    // Run all inserts in a transaction for speed
    const restoreAll = sqlite.transaction(() => {
      for (const row of jobRows) {
        const id = parseInt(row["ID"] ?? row[0]);
        if (!id || isNaN(id)) continue;
        try {
          insertJob.run({
            id,
            jobNumber: String(row["Job Number"] ?? row[1] ?? ""),
            customerName: String(row["Customer Name"] ?? row[2] ?? ""),
            serviceType: String(row["Service Type"] ?? row[3] ?? "Plumbing"),
            jobDate: String(row["Job Date"] ?? row[4] ?? ""),
            weekOf: String(row["Week Of"] ?? row[5] ?? ""),
            invoiceTotal: parseFloat(row["Invoice Total"] ?? row[6] ?? 0) || 0,
            materialCost: parseFloat(row["Material Cost"] ?? row[7] ?? 0) || 0,
            materialMarkupRate: parseFloat(row["Material Markup Rate"] ?? row[8] ?? 0.30) || 0.30,
            materialMarkupAmount: parseFloat(row["Material Markup Amount"] ?? row[9] ?? 0) || 0,
            commissionableAmount: parseFloat(row["Commissionable Amount"] ?? row[10] ?? 0) || 0,
            commissionRate: parseFloat(row["Commission Rate"] ?? row[11] ?? 0.25) || 0.25,
            commissionEarned: parseFloat(row["Commission Earned"] ?? row[12] ?? 0) || 0,
            status: String(row["Status"] ?? row[13] ?? "completed"),
            notes: String(row["Notes"] ?? row[14] ?? ""),
          });
        } catch (e) {
          console.error("[Sheets restore] Job row failed:", row, e);
        }
      }

      for (const row of paymentRows) {
        const id = parseInt(row["ID"] ?? row[0]);
        if (!id || isNaN(id)) continue;
        try {
          insertPayment.run({
            id,
            weekOf: String(row["Week Of"] ?? row[1] ?? ""),
            payDate: String(row["Pay Date"] ?? row[2] ?? ""),
            amountPaid: parseFloat(row["Amount Paid"] ?? row[3] ?? 0) || 0,
            notes: String(row["Notes"] ?? row[4] ?? ""),
          });
        } catch (e) {
          console.error("[Sheets restore] Payment row failed:", row, e);
        }
      }
    });

    restoreAll();
    console.log("[Sheets restore] Done.");
  } catch (err) {
    console.error("[Sheets restore] Error:", err);
    // Never crash the server on restore failure
  }
}
