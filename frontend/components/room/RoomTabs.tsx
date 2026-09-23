"use client";

export type RoomTab =
  | "message"
  | "group"
  | "activity"
  | "loyalty";

interface RoomTabsProps {
  value: RoomTab;
  onChange(
    value: RoomTab,
  ): void;
}

export function RoomTabs({
  value,
  onChange,
}: RoomTabsProps) {
  const items = [
    ["message", "Message"],
    ["group", "Group"],
    ["activity", "Activity"],
    ["loyalty", "Loyalty"],
  ] as const;

  return (
    <nav
      aria-label="Deal room navigation"
      className="mb-3 rounded-2xl bg-vault/35 p-1 ring-1 ring-wire/65"
    >
      <div className="flex snap-x gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-4">
        {items.map(
          ([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                onChange(key)
              }
              className={
                value === key
                  ? "min-w-[108px] flex-1 snap-start rounded-xl bg-signal/[0.09] px-3 py-2.5 text-[11px] font-medium text-signal ring-1 ring-signal/15 sm:min-w-0"
                  : "min-w-[108px] flex-1 snap-start rounded-xl px-3 py-2.5 text-[11px] font-medium text-paper/38 transition hover:bg-white/[0.02] hover:text-paper/70 sm:min-w-0"
              }
            >
              {label}
            </button>
          ),
        )}
      </div>
    </nav>
  );
}
