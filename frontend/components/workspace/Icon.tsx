import type { ReactNode } from "react";
export type IconName =
  | "home"
  | "chat"
  | "jobs"
  | "shield"
  | "gem"
  | "arrow"
  | "plus"
  | "search"
  | "wallet"
  | "copy"
  | "check"
  | "sun"
  | "moon"
  | "close"
  | "send"
  | "file"
  | "clock"
  | "link"
  | "refresh"
  | "account"
  | "pause"
  | "play";
const paths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10H3Z" />
      <path d="M9 20v-7h6v7" />
    </>
  ),
  chat: (
    <>
      <path d="M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z" />
      <path d="M7 10h10M7 14h6" />
    </>
  ),
  jobs: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="3" />
      <path d="M8 7V3h8v4M3 12a24 24 0 0 0 18 0M12 11v4" />
    </>
  ),
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  gem: (
    <>
      <path d="m3 8 4-5h10l4 5-9 13Z" />
      <path d="M3 8h18M8 8l4 13 4-13" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  plus: <path d="M12 4v16M4 12h16" />,
  search: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 6 6" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 8V5H5a2 2 0 0 0-2 2v12h18V8H5a2 2 0 0 1 0-4" />
      <path d="M21 11h-6v5h6" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M15 8V3H3v13h5" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
    </>
  ),
  moon: <path d="M20 15a9 9 0 0 1-11-11A9 9 0 1 0 20 15Z" />,
  close: <path d="m5 5 14 14M5 19 19 5" />,
  send: (
    <>
      <path d="m3 3 18 9-18 9 4-9Z" />
      <path d="M7 12h14" />
    </>
  ),
  file: (
    <>
      <path d="M5 3h10l4 4v14H5Z" />
      <path d="M14 3v5h5M8 12h8M8 16h6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  link: (
    <>
      <path d="m10 13 4-4M8 15l-2 2a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0m2 8a3 3 0 0 0 4 0l5-5a3 3 0 0 0-4-4l-2 2" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  play: <path d="m8 4 12 8-12 8Z" />,
  refresh: (
    <>
      <path d="M20 7V2m0 5h-5M4 17v5m0-5h5M4 8a8 8 0 0 1 14-3l2 2M20 16a8 8 0 0 1-14 3l-2-2" />
    </>
  ),
};
export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={`ui-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
