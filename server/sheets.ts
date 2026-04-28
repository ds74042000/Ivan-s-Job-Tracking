import { execSync } from "child_process";
import type { Job, Payment } from "@shared/schema";

const SPREADSHEET_ID = "1m3plr0n_YAAFldaWIa2wmBeY_pqSxtSP7ZzbVrNne10";

function callTool(toolName: string, args: Record<string, unknown>): any {
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
    console.error("[Sheets error]", err);
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
// Reads both sheets and re-seeds local SQLite so data survives Render restarts.
// Imported and called from server/index.ts BEFORE routes are registered.

export function sheetsRestoreToDb(sqlite: import("better-sqlite3").Database) {
  try {
    console.log("[Restore] Reading jobs from Google Sheets...");
    const jobsRes = callTool("google_sheets-read-rows", {
      spreadsheetId: SPREADSHEET_ID,
      sheetName: "Jobs",
      hasHeaders: true,
    });

    console.log("[Restore] Reading payments from Google Sheets...");
    const paymentsRes = callTool("google_sheets-read-rows", {
      spreadsheetId: SPREADSHEET_ID,
      sheetName: "Payments",
      hasHeaders: true,
    });

    // Response shape: { headers: [...], rows: [...], rowCount: N }
    const jobRows: any[] = jobsRes?.rows ?? [];
    const paymentRows: any[] = paymentsRes?.rows ?? [];

    if (jobRows.length === 0 && paymentRows.length === 0) {
      console.log("[Restore] Sheets are empty — nothing to restore.");
      return;
    }

    console.log(`[Restore] Restoring ${jobRows.length} jobs, ${paymentRows.length} payments...`);

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

    const restoreAll = sqlite.transaction(() => {
      for (const row of jobRows) {
        const id = parseInt(row["ID"]);
        if (!id || isNaN(id)) continue;
        insertJob.run({
          id,
          jobNumber:            String(row["Job Number"]          ?? ""),
          customerName:         String(row["Customer Name"]       ?? ""),
          serviceType:          String(row["Service Type"]        ?? "Plumbing"),
          jobDate:              String(row["Job Date"]            ?? ""),
          weekOf:               String(row["Week Of"]             ?? ""),
          invoiceTotal:         parseFloat(row["Invoice Total"]   ?? 0) || 0,
          materialCost:         parseFloat(row["Material Cost"]   ?? 0) || 0,
          materialMarkupRate:   parseFloat(row["Material Markup Rate"]   ?? 0.30) || 0.30,
          materialMarkupAmount: parseFloat(row["Material Markup Amount"] ?? 0) || 0,
          commissionableAmount: parseFloat(row["Commissionable Amount"]  ?? 0) || 0,
          commissionRate:       parseFloat(row["Commission Rate"] ?? 0.25) || 0.25,
          commissionEarned:     parseFloat(row["Commission Earned"] ?? 0) || 0,
          status:               String(row["Status"]              ?? "completed"),
          notes:                String(row["Notes"]               ?? ""),
        });
      }

      for (const row of paymentRows) {
        const id = parseInt(row["ID"]);
        if (!id || isNaN(id)) continue;
        insertPayment.run({
          id,
          weekOf:     String(row["Week Of"]      ?? ""),
          payDate:    String(row["Pay Date"]      ?? ""),
          amountPaid: parseFloat(row["Amount Paid"] ?? 0) || 0,
          notes:      String(row["Notes"]         ?? ""),
        });
      }
    });

    restoreAll();
    console.log("[Restore] Done.");
  } catch (err) {
    console.error("[Restore] Error:", err);
  }
}
