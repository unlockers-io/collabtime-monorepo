import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { Globe, Settings, LogOut } from "lucide-react";
import { auth } from "@/lib/auth-server";

// Force dynamic rendering for all dashboard pages - they require authentication
export const dynamic = "force-dynamic";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

const DashboardLayout = async ({ children }: DashboardLayoutProps) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-3 text-neutral-900 transition-opacity hover:opacity-80 dark:text-neutral-100"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 dark:bg-neutral-100">
              <Globe className="h-4 w-4 text-white dark:text-neutral-900" />
            </div>
            <span className="text-lg font-bold tracking-tight">Collab Time</span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/settings"
              className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
            <form action="/api/auth/sign-out" method="POST">
              <button
                type="submit"
                className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
};

export default DashboardLayout;
