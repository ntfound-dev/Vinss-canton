import { DealsList } from "@/components/workspace/DealsList";
export default function Page() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">OFFERS & PAYMENTS</p>
          <h1 style={{ marginTop: 10 }}>Your deals</h1>
          <p className="muted">
            Track offers, escrow payments, and delivery approvals.
          </p>
        </div>
      </div>
      <DealsList />
    </>
  );
}
