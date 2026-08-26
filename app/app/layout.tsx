import { UNITS } from "@/config/units";
import { AppShell } from "@/components/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const unit = UNITS[0];
  return (
    <AppShell unitName={unit.name} unitMeta={unit.city}>
      {children}
    </AppShell>
  );
}
