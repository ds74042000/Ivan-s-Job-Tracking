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
      timeout: 15000,
      env: { ...process.env },
    }).toString();
    return JSON.parse(result);
  } catch (err) {
    // Never let Sheets errors crash the app — log and continue
    console.error("[Sheets sync error]", err);
    return null;
  }
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export function sheetsAddJob(job: Job) {
  callTool("google_sheets-add-single-row", {
    spreadsheetId: SPREADSHEET_ID,
    sheetName: "Jobs",
    row: JSON.stringify({
      ID: job.id,
      "Job Number": job.jobNumber,
      "Customer Name": job.customerName,
      "Service Type": job.serviceType,
      "Job Date": job.jobDate,
      "Week Of": job.weekOf,
      "Invoice Total": job.invoiceTotal,
      "Commission Rate": `${(job.commissionRate * 100).toFixed(0)}%`,
      "Commission Earned": job.commissionEarned,
      Status: job.status,
      Notes: job.notes || "",
      "Created At": new Date().toISOString(),
    }),
  });
}

export async function sheetsSyncAllJobs(jobs: Job[]) {
  if (!jobs.length) return;
  // Clear existing data rows (keep header) then re-add all
  callTool("google_sheets-clear-rows", {
    spreadsheetId: SPREADSHEET_ID,
    sheetName: "Jobs",
    range: "A2:L1000",
  });
  if (jobs.length === 0) return;
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
        "Commission Rate": `${(job.commissionRate * 100).toFixed(0)}%`,
        "Commission Earned": job.commissionEarned,
        Status: job.status,
        Notes: job.notes || "",
        "Created At": new Date().toISOString(),
      }))
    ),
    hasHeaders: true,
  });
}

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
