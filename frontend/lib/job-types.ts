export const JOB_CATEGORIES = [
  "All",
  "Development",
  "Design",
  "Writing",
  "Marketing",
  "Translation",
  "Operations",
] as const;
export interface JobListing {
  id: string;
  title: string;
  description: string;
  category: string;
  budget: string;
  asset: string;
  delivery: string;
  tags: string[];
  publisher: string;
  ownerParty: string;
  ownerInstallation: string;
  network: string;
  createdAt: string;
  demo?: boolean;
}
export function validJob(v: unknown): v is JobListing {
  if (!v || typeof v !== "object") return false;
  const j = v as JobListing;
  return (
    typeof j.id === "string" &&
    /^[\w-]{1,80}$/.test(j.id) &&
    [
      "title",
      "description",
      "category",
      "budget",
      "asset",
      "delivery",
      "publisher",
      "ownerParty",
      "ownerInstallation",
      "network",
      "createdAt",
    ].every(
      (k) => typeof (j as unknown as Record<string, unknown>)[k] === "string",
    ) &&
    j.title.length <= 160 &&
    j.description.length <= 16000 &&
    JOB_CATEGORIES.includes(j.category as (typeof JOB_CATEGORIES)[number]) &&
    /^\d+(?:\.\d+)?$/.test(j.budget) &&
    Number(j.budget) > 0 &&
    Number.isFinite(Number(j.budget)) &&
    Array.isArray(j.tags) &&
    j.tags.length <= 8 &&
    j.tags.every((t) => typeof t === "string" && t.length <= 40) &&
    Number.isFinite(Date.parse(j.createdAt)) &&
    (j.demo === true ||
      Boolean(j.ownerParty && /^[\da-f-]{36}$/i.test(j.ownerInstallation)))
  );
}
export function filterJobs(
  jobs: readonly JobListing[],
  q: string,
  category: string,
  page: number,
  pageSize = 9,
) {
  const term = q.toLowerCase().trim();
  const found = jobs
    .filter(
      (j) =>
        (category === "All" || j.category === category) &&
        (!term ||
          [j.title, j.description, j.publisher, ...j.tags]
            .join(" ")
            .toLowerCase()
            .includes(term)),
    )
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        a.id.localeCompare(b.id),
    );
  const pages = Math.max(1, Math.ceil(found.length / pageSize));
  const current = Math.min(pages, Math.max(1, Math.trunc(page) || 1));
  return {
    items: found.slice((current - 1) * pageSize, current * pageSize),
    total: found.length,
    page: current,
    pages,
  };
}
