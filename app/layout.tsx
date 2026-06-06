import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web Traffic Dashboard",
  description: "Social-media engagement analytics, framed as web traffic.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink">{children}</body>
    </html>
  );
}
