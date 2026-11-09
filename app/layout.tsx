import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Salah | Your daily prayer companion",
  description: "A calm, personal prayer journal for daily salah, Qaza, and prayer streaks.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
