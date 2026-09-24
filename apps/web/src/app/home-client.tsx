"use client";

import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";
import { Nav } from "@/components/nav";
import { PageHeader, PageMain } from "@/components/page-layout";

type HomeShellProps = {
  children: React.ReactNode;
};

const HomeShell = ({ children }: HomeShellProps) => {
  return (
    <div className="flex flex-1 flex-col">
      <Nav isAuthenticated />

      <PageMain>
        <PageHeader
          action={<CreateWorkspaceDialog />}
          description="Open a team to read the shared day, or create a new workspace."
          title="Your workspaces"
        />
        {children}
      </PageMain>
    </div>
  );
};

export { HomeShell };
