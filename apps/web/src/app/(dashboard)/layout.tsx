import { redirect } from "next/navigation";

import { Nav } from "@/components/nav";
import { getSession } from "@/lib/auth-server";

// Force dynamic rendering for all dashboard pages - they require authentication
export const dynamic = "force-dynamic";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

const DashboardLayout = async ({ children }: DashboardLayoutProps) => {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex-1">{children}</main>
    </div>
  );
};

export default DashboardLayout;
