import Link from "next/link";
import { RoomsList } from "@/components/workspace/RoomsList";
import { PeerEntryForm } from "@/components/room/PeerEntryForm";
export default function Page() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PRIVATE MESSAGES</p>
          <h1>Your inbox</h1>
          <p className="muted">
            Conversations, offers, and deliveries — together.
          </p>
        </div>
        <Link className="ui-button primary" href="/invite/new">
          New conversation
        </Link>
      </div>
      <RoomsList />
      <details className="advanced">
        <summary>Advanced / debug connection</summary>
        <div className="advanced-content">
          <PeerEntryForm />
        </div>
      </details>
    </>
  );
}
