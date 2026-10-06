"use client";
import { Icon } from "@/components/workspace/Icon";
export type RoomTab = "message" | "escrow" | "activity";
export function RoomTabs({
  value,
  onChange,
}: {
  value: RoomTab;
  onChange(v: RoomTab): void;
}) {
  return (
    <div className="room-tabs" role="tablist" aria-label="Private room">
      {(
        [
          { id: "message", label: "Conversation", icon: "chat" },
          { id: "escrow", label: "Escrow / rekber", icon: "shield" },
          { id: "activity", label: "Activity", icon: "clock" },
        ] as const
      ).map((t) => (
        <button
          type="button"
          key={t.id}
          id={"tab-" + t.id}
          role="tab"
          aria-selected={value === t.id}
          aria-controls="room-tab-panel"
          onClick={() => onChange(t.id)}
        >
          <Icon name={t.icon} />
          {t.label}
        </button>
      ))}
    </div>
  );
}
