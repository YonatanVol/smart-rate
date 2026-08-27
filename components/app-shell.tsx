import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
        <path d="M3 17l5-6 4 3 5-8" />
        <circle cx="20" cy="5" r="1.6" fill="currentColor" stroke="none" />
      </svg>
      <span className="text-base font-bold tracking-tight">smart-rate</span>
    </span>
  );
}

export function AppShell({
  unitName,
  unitMeta,
  children,
}: {
  unitName: string;
  unitMeta?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
          <Logo />

          {/* Unit switcher — one unit today, but the control is the shape of many. */}
          <button className="flex min-w-0 items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm transition hover:border-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <span className="truncate font-semibold">{unitName}</span>
            {unitMeta && <span className="hidden truncate text-ink-3 sm:inline">{unitMeta}</span>}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-3">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <div className="flex-1" />

          <nav className="hidden items-center gap-6 text-sm sm:flex">
            <Link href="/app" className="border-b-2 border-accent pb-0.5 font-semibold text-ink">
              לוח מחירים
            </Link>
            <span className="text-ink-3">הזמנות</span>
            <span className="text-ink-3">הגדרות</span>
          </nav>

          <span className="hidden h-5 w-px bg-line sm:block" />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </>
  );
}
