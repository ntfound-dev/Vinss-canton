import type { Metadata } from "next";

import "./globals.css";
import { WalletProvider } from "@/components/workspace/WalletProvider";
import { AppShell } from "@/components/workspace/AppShell";

export const metadata: Metadata = {
  title: "VINSS — Private Deal Network",
  description:
    "Private communication and deal coordination powered by OpenMLS and Canton.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <AppShell>{children}</AppShell>
        </WalletProvider>
      </body>
    </html>
  );
}
