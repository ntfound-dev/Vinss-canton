import { Suspense } from "react";
import { JobsBrowser } from "@/components/workspace/JobsBrowser";
export default function Page() {
  return (
    <Suspense fallback={<div className="loading">Loading jobs…</div>}>
      <JobsBrowser />
    </Suspense>
  );
}
