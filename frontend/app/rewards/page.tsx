import Link from "next/link";
import { Icon } from "@/components/workspace/Icon";
export default function Page() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>Points & VIP</h1>
          <p className="muted">
            Rewards and membership for your VINSS account.
          </p>
        </div>
        <Link className="text-link" href="/">
          Back to workspace <Icon name="arrow" />
        </Link>
      </div>
      <nav className="reward-nav" aria-label="Account sections">
        <a href="#points">
          <Icon name="gem" /> Points
        </a>
        <a href="#vip">
          <Icon name="shield" /> VIP membership
        </a>
      </nav>
      <div className="reward-grid">
        <section className="surface padded points-panel" id="points">
          <div className="section-heading">
            <span className="points-emblem">
              <Icon name="gem" />
            </span>
            <span className="badge amber">Coming soon</span>
          </div>
          <h2>VINSS Points</h2>
          <p className="muted">A rewards program for activity on VINSS.</p>
          <div className="points-preview">
            <span>Program status</span>
            <strong>Not launched</strong>
            <p>
              Your points balance and activity history will appear here when the
              program opens.
            </p>
          </div>
          <p className="small muted">
            Earning rules and rewards are still being defined.
          </p>
          <Link className="text-link" href="/deals">
            View deal history <Icon name="arrow" />
          </Link>
        </section>
        <section className="surface padded vip-panel" id="vip">
          <div className="vip-watermark" aria-hidden="true">
            V
          </div>
          <div className="section-heading">
            <span className="vip-wordmark">
              <Icon name="gem" /> VINSS VIP
            </span>
            <span className="vip-badge">MEMBERSHIP PREVIEW</span>
          </div>
          <h2>
            Tools for your
            <br />
            next chapter.
          </h2>
          <p>Planned extras for people who manage multiple projects.</p>
          <ul className="benefits">
            <li>
              <Icon name="check" /> Reusable offer templates
            </li>
            <li>
              <Icon name="check" /> More marketplace listings
            </li>
            <li>
              <Icon name="check" /> Deal activity exports
            </li>
          </ul>
          <div className="vip-foot">
            <Icon name="clock" />
            <span>
              Subscriptions are not open yet.
              <br />
              <small>Benefits and pricing are not final.</small>
            </span>
          </div>
        </section>
      </div>
      <p className="account-core-note">
        <Icon name="shield" /> Private chat and escrow are core features. VIP is
        optional.
      </p>
    </>
  );
}
