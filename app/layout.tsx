import type { Metadata } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";

// Assistant carries real Hebrew and Latin; the default system stack renders
// Hebrew poorly, and this is a Hebrew-first product.
const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-assistant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "smart-rate — תמחור דינמי",
  description: "מנוע תמחור דינמי ו-PMS קל לדירות, ישראל-first",
};

/**
 * Resolve the theme before first paint: a saved choice wins, otherwise the OS
 * preference. Without this the page flashes light before the toggle applies.
 */
const THEME_INIT = `(function(){try{var t=localStorage.getItem("sr-theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="light";}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="he"
      dir="rtl"
      data-theme="light"
      // THEME_INIT rewrites data-theme before React hydrates, so the server's
      // "light" default and the client's resolved theme legitimately differ.
      suppressHydrationWarning
      className={`${assistant.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-bg text-ink">{children}</body>
    </html>
  );
}
