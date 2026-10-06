import Link from "next/link";
import { RoomsList } from "@/components/workspace/RoomsList";
import { Icon } from "@/components/workspace/Icon";
import { DealsList } from "@/components/workspace/DealsList";
import { IncomingJobs } from "@/components/workspace/IncomingJobs";
import { DealPath } from "@/components/workspace/DealPath";
export default function Home() {
  return (
    <>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">VINSS WORKSPACE</span>
          <h2>Let’s get to work.</h2>
        </div>
        <span className="workspace-security">
          <Icon name="shield" /> OpenMLS encrypted
        </span>
      </div>
      <section className="hero hero-v2">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span className="signal-orb" /> PRIVATE DEALS ON CANTON
          </span>
          <h1>
            Private chat.
            <br />
            <span>Protected payments.</span>
          </h1>
          <p>
            Agree on the work. Hold payment in escrow.
            <br className="desktop-break" /> Release it after approval.
          </p>
          <div className="actions">
            <Link className="ui-button primary" href="/invite/new">
              <Icon name="plus" /> Start private deal <Icon name="arrow" />
            </Link>
            <Link className="ui-button" href="/jobs">
              <Icon name="jobs" /> Find a job
            </Link>
          </div>
          <div className="hero-proof">
            <span>
              <Icon name="chat" /> Encrypted messages
            </span>
            <span>
              <Icon name="shield" /> Canton escrow
            </span>
          </div>
        </div>
        <DealPath />
      </section>
      <IncomingJobs />
      <div className="home-grid">
        <section>
          <div className="section-heading">
            <h2>Recent messages</h2>
            <Link href="/rooms" className="text-link">
              Open inbox <Icon name="arrow" />
            </Link>
          </div>
          <RoomsList compact />
        </section>
        <section>
          <div className="section-heading">
            <h2>My deals</h2>
            <Link href="/deals" className="text-link">
              View deals <Icon name="arrow" />
            </Link>
          </div>
          <DealsList compact />
        </section>
      </div>
      <section className="start-guide">
        <span className="guide-icon">
          <Icon name="link" />
        </span>
        <div>
          <h3>Already have someone to work with?</h3>
          <p>
            Share an invite. They connect their wallet, and your private room
            opens.
          </p>
        </div>
        <Link className="text-link" href="/invite/new">
          Create invite <Icon name="arrow" />
        </Link>
      </section>
    </>
  );
}
