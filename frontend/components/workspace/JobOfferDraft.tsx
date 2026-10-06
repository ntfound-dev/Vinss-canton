"use client";
import { useEffect, useState } from "react";
import { validJob } from "@/lib/job-types";
export function useJobOfferDraft(id: string | null) {
  const [value, setValue] = useState<Record<string, string> | undefined>();
  useEffect(() => {
    setValue(undefined);
    if (!id) return;
    const controller = new AbortController();
    void fetch(`/api/jobs/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!controller.signal.aborted && validJob(j) && !j.demo)
          setValue({
            freelance_project: j.title,
            freelance_payment_amount: j.budget,
            freelance_payment_asset: j.asset,
            freelance_deadline: j.delivery,
            freelance_deliverables: j.description,
          });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [id]);
  return value;
}
