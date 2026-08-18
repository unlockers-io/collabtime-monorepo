import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Nav } from "@/components/nav";
import { getSession } from "@/lib/auth-server";
import { QueryProvider } from "@/providers/query-provider";

const DashboardGate = async () => {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return null;
};

type DashboardLayoutProps = {
  children: React.ReactNode;
};

const DashboardLayout = ({ children }: DashboardLayoutProps) => (
  <QueryProvider>
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={null}>
        <DashboardGate />
      </Suspense>
      <Nav isAuthenticated />
      <main className="flex-1" id="main">
        {children}
      </main>
    </div>
  </QueryProvider>
);

export default DashboardLayout;
