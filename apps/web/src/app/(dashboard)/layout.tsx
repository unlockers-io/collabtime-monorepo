import type { Metadata } from "next";

import { Nav } from "@/components/nav";
import { PageMain } from "@/components/page-main";

/** @public Next.js app-router reads metadata via the module loader */
export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

type DashboardLayoutProps = {
  children: React.ReactNode;
};

const DashboardLayout = ({ children }: DashboardLayoutProps) => (
  <div className="flex flex-1 flex-col">
    <Nav isAuthenticated />
    <PageMain>{children}</PageMain>
  </div>
);

export default DashboardLayout;
