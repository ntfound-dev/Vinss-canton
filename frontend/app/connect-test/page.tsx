"use client";

import dynamic from "next/dynamic";

const CantonWalletConnect = dynamic(
  () =>
    import("@/components/CantonWalletConnect").then(
      (mod) => mod.CantonWalletConnect,
    ),
  { ssr: false },
);

export default function ConnectTestPage() {
  return (
    <main className="min-h-screen bg-[#07090c] p-6 text-[#f6f5f1]">
      <h1 className="text-lg font-medium">Canton Wallet Connect</h1>
      <p className="mt-2 max-w-md text-sm text-white/40">
        Install a Canton wallet (Console / Nightly / gateway) then connect.
        Party ID will show after success.
      </p>
      <div className="mt-6">
        <CantonWalletConnect
          onConnected={(s) => console.log("party", s)}
        />
      </div>
    </main>
  );
}
