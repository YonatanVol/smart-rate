import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "smart-rate — תמחור דינמי",
  description: "מנוע תמחור דינמי ו-PMS קל לדירות, ישראל-first",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white">{children}</body>
    </html>
  );
}
