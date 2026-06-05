import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Analytics Dashboard",
  description: "Backend skeleton for the social-media engagement dashboard.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
