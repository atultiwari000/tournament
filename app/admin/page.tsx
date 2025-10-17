import { redirect } from "next/navigation";

/**
 * Redirect /admin -> /admin/overview
 *
 * This server component lives at `app/admin/page.tsx` and immediately
 * redirects the index route to the overview sub-route.
 */
export default function AdminIndexPage() {
  redirect("/admin/overview");
}
