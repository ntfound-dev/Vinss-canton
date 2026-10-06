import { Suspense } from "react";
import { JobDetail } from "@/components/workspace/JobDetail";
export default function Page() {
  return (
    <Suspense fallback={<div className="loading">Loading job…</div>}>
      <JobDetail />
    </Suspense>
  );
}
