import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web Traffic Analytics — Live Console",
  description: "Full-dataset web-traffic analytics, rendered as a live ops console.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistMono.variable}>
      <body className="min-h-screen bg-black font-mono text-[var(--ds-gray-1000)] antialiased">
        {children}
      </body>
    </html>
  );
}
