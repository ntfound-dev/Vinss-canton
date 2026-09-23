import type {
  Metadata,
} from "next";

import "./globals.css";

export const metadata:
  Metadata = {
    title:
      "VINSS — Private Deal Network",
    description:
      "Private communication and deal coordination powered by OpenMLS and Canton.",
  };

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
