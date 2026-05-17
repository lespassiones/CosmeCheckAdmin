import { requireAdmin } from "@/lib/authGuard";
import { Sidebar, MobileTopBar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";

/**
 * Layout for every authenticated dashboard page. Redirects to /auth/sign-in
 * via requireAdmin() before rendering anything if the user isn't an admin.
 *
 * The route group `(dashboard)` means this layout wraps every protected page
 * WITHOUT adding a path segment.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-svh">
      <Sidebar adminEmail={admin.email} />
      <MobileTopBar adminEmail={admin.email} />

      <div className="lg:pl-64">
        <main className="px-4 py-4 lg:px-8 lg:py-8">
          <MobileNav />
          {children}
        </main>
      </div>
    </div>
  );
}
