import { NextRequest } from "next/server";
import { generateMonthlyReport } from "@/lib/monthly-report";
import { createMonthlyPdf } from "@/lib/monthly-exports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const month = Number(request.nextUrl.searchParams.get("month")); const year = Number(request.nextUrl.searchParams.get("year"));
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) return Response.json({ error: "Choose a valid month and year." }, { status: 400 });
  try {
    const report = await generateMonthlyReport(month, year); const file = await createMonthlyPdf(report);
    return new Response(new Uint8Array(file), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="RRF-HR-Monthly-Report-${year}-${String(month).padStart(2, "0")}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Unable to prepare the PDF report. Please try again." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
