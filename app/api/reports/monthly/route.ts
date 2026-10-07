import { NextResponse, type NextRequest } from "next/server";
import { generateMonthlyReport } from "@/lib/monthly-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePeriod(request: NextRequest) {
  const month = Number(request.nextUrl.searchParams.get("month"));
  const year = Number(request.nextUrl.searchParams.get("year"));
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return { month, year };
}

export async function GET(request: NextRequest) {
  const selected = parsePeriod(request);
  if (!selected) return NextResponse.json({ error: "Choose a valid month and year." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  try {
    const report = await generateMonthlyReport(selected.month, selected.year);
    return NextResponse.json(report, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to generate the report. Please try again." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
