import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SiftOps - Internal Knowledge Base",
  description: "Policy Search & Retrieval System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
