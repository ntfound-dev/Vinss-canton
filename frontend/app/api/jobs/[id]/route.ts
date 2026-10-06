import { NextRequest, NextResponse } from "next/server";
import { catalog } from "@/lib/job-catalog";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = catalog(request.nextUrl.searchParams.get("demo") === "1").find(
    (j) => j.id === id,
  );
  return job
    ? NextResponse.json(job)
    : NextResponse.json(
        { error: "This job is no longer available." },
        { status: 404 },
      );
}
