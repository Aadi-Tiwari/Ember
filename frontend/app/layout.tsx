import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ember - Burnout Detection",
  description: "Early burnout detection through behavioral pattern analysis. No messages read.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
