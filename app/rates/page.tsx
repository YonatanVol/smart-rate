import { redirect } from "next/navigation";

/** The rate calendar moved to /app; keep the old path working. */
export default function RatesRedirect() {
  redirect("/app");
}
