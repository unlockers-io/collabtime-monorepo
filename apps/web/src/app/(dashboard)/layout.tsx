import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Nav } from "@/components/nav";
import { getSession } from "@/lib/auth-server";
import { QueryProvider } from "@/providers/query-provider";

/** @public Next.js app-router reads metadata via the module loader */
export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

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
    <div className="flex flex-1 flex-col">
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
