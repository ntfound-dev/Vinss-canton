"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CantonWalletConnect } from "@/components/CantonWalletConnect";
import { useWallet } from "./WalletProvider";
import { Icon, type IconName } from "./Icon";
import { cantonNetwork, shortId } from "@/lib/workspace";
const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/rooms", label: "Messages", icon: "chat" },
  { href: "/jobs", label: "Jobs", icon: "jobs" },
  { href: "/deals", label: "Deals", icon: "shield" },
];
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname(),
    wallet = useWallet();
  const [dark, setDark] = useState(false),
    [waiting, setWaiting] = useState(false);
  const accountMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const saved = localStorage.getItem("vinss:theme");
    const next = saved
      ? saved === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
  }, []);
  useEffect(() => {
    if (accountMenu.current) accountMenu.current.open = false;
  }, [path]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (
        !accountMenu.current?.contains(e.target as Node) &&
        accountMenu.current
      )
        accountMenu.current.open = false;
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && accountMenu.current?.open) {
        accountMenu.current.open = false;
        accountMenu.current.querySelector<HTMLElement>("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    setWaiting(false);
    if (!wallet.busy) return;
    const timer = setTimeout(() => setWaiting(true), 12000);
    return () => clearTimeout(timer);
  }, [wallet.busy]);
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("vinss:theme", next ? "dark" : "light");
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <header className="app-header">
        <Link className="brand" href="/" aria-label="VINSS home">
          <span className="brand-mark">
            V<span />
          </span>
          VINSS
        </Link>
        <div className="header-right">
          <span className="network-tag">
            <span className="status-dot" /> Canton{" "}
            <span className="capitalize">{cantonNetwork()}</span>
          </span>
          <CantonWalletConnect />
          <details className="account-menu" ref={accountMenu}>
            <summary className="account-trigger" aria-label="Open account menu">
              <Icon name="account" />
            </summary>
            <div className="account-popover">
              <div className="account-heading">
                <span className="avatar">
                  <Icon name="account" />
                </span>
                <div>
                  <strong>
                    {wallet.session?.hint ||
                      (wallet.session
                        ? shortId(wallet.session.partyId)
                        : "Your account")}
                  </strong>
                  <p>
                    {wallet.session
                      ? "Canton wallet connected"
                      : "Connect a wallet to get started"}
                  </p>
                </div>
              </div>
              <Link
                href="/rewards#points"
                onClick={() => {
                  if (accountMenu.current) accountMenu.current.open = false;
                }}
              >
                <Icon name="gem" />
                <span>Points</span>
                <small>Coming soon</small>
              </Link>
              <Link
                href="/rewards#vip"
                onClick={() => {
                  if (accountMenu.current) accountMenu.current.open = false;
                }}
              >
                <Icon name="shield" />
                <span>VINSS VIP</span>
                <small>Preview</small>
              </Link>
              <button
                className="account-theme"
                onClick={toggleTheme}
                aria-label={dark ? "Use light theme" : "Use dark theme"}
              >
                <Icon name={dark ? "sun" : "moon"} />
                <span>{dark ? "Light appearance" : "Dark appearance"}</span>
                <span className={"theme-switch " + (dark ? "on" : "")} />
              </button>
              <div className="account-network">
                <span className="status-dot" /> Canton {cantonNetwork()}
                <span>Current network</span>
              </div>
            </div>
          </details>
        </div>
      </header>
      <div className="app-body">
        <aside className="app-sidebar">
          <div className="sidebar-caption">YOUR WORKSPACE</div>
          <nav aria-label="Main navigation">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-item"
                aria-current={
                  (
                    item.href === "/"
                      ? path === "/"
                      : path.startsWith(item.href) ||
                        (item.href === "/rooms" && path.startsWith("/room/"))
                  )
                    ? "page"
                    : undefined
                }
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-signature">
              <Icon name="shield" />
              <span>
                Private by design
                <br />
                <small>Encrypted chat. Canton escrow.</small>
              </span>
            </div>
          </div>
        </aside>
        <div className="app-main-wrap">
          {wallet.error && (
            <div className="ui-alert error wallet-error" role="alert">
              <Icon name="wallet" />
              <div>
                <strong>Wallet connection needs attention</strong>
                <p>{wallet.error}</p>
              </div>
            </div>
          )}
          {waiting && !wallet.error && (
            <div className="ui-alert info wallet-error" role="status">
              <span className="ui-spinner" />
              <div>
                <strong>Waiting for your wallet</strong>
                <p>
                  Choose your wallet and approve the connection. If its window
                  shows an error, choose Cancel there and try again.
                </p>
              </div>
            </div>
          )}
          <main id="workspace-main" className="app-main">
            <div className="page-enter" key={path}>
              {children}
            </div>
          </main>
          <footer className="app-footer">
            <span>VINSS · Private Deal Network</span>
            <span>
              <Icon name="shield" /> Built on Canton
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
}
