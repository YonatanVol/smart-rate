import { redirect } from "next/navigation";

// The marketing landing page lands here later; until then "/" is the app.
export default function Home() {
  redirect("/app");
}
