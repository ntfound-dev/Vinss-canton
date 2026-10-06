import { NextRequest, NextResponse } from "next/server";
import { catalog } from "@/lib/job-catalog";
import { filterJobs } from "@/lib/job-types";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  return NextResponse.json(
    filterJobs(
      catalog(q.get("demo") === "1"),
      (q.get("q") || "").slice(0, 200),
      q.get("category") || "All",
      Number(q.get("page") || 1),
    ),
    { headers: { "Cache-Control": "no-store" } },
  );
}
