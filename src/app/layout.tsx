import type { Metadata } from "next";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Household Nutrition Tracker",
  description: "Invite-only nutrition and fitness logging for a small household",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-100 text-slate-900 antialiased">
        {children}
        <MobileBottomNav />
      </body>
    </html>
  );
}
