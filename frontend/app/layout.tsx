import type { Metadata } from "next";

import "./globals.css";
import { WalletProvider } from "@/components/workspace/WalletProvider";
import { AppShell } from "@/components/workspace/AppShell";

export const metadata: Metadata = {
  metadataBase: new URL("https://vinss-canton.vercel.app"),
  title: "VINSS — Private Deal Network",
  description:
    "Private communication and deal coordination powered by OpenMLS and Canton.",
  icons: {
    icon: [{ url: "/brand/vinss-mark.png", type: "image/png" }],
    shortcut: "/brand/vinss-mark.png",
    apple: "/brand/vinss-mark.png",
  },
  openGraph: {
    title: "VINSS — Private Deal Network",
    description:
      "Private conversation, agreed terms and escrow settlement on Canton.",
    images: [{ url: "/brand/vinss-logo.png", width: 1254, height: 1254, alt: "VINSS" }],
  },
  twitter: {
    card: "summary",
    title: "VINSS — Private Deal Network",
    images: ["/brand/vinss-logo.png"],
  },
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
