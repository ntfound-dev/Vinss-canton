import { Suspense } from "react";
import { DemoRoom } from "@/components/workspace/DemoRoom";
export default function Page() {
  return (
    <Suspense fallback={<div className="loading">Opening walkthrough…</div>}>
      <DemoRoom />
    </Suspense>
  );
}
