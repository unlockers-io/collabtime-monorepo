"use client";

import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";
import { Nav } from "@/components/nav";

type HomeShellProps = {
  children: React.ReactNode;
};

const HomeShell = ({ children }: HomeShellProps) => {
  return (
    <div className="flex flex-1 flex-col">
      <Nav isAuthenticated />

      <main
        className="mx-auto flex w-full max-w-450 flex-1 flex-col gap-14 px-4 py-14 sm:px-6 sm:py-20 lg:px-8 xl:px-12"
        id="main"
      >
        <div className="grid items-end gap-8 sm:grid-cols-content-action">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-5xl font-semibold tracking-hero text-balance sm:text-7xl">
              Your workspaces
            </h1>
            <p className="max-w-lg text-base text-pretty text-muted-foreground sm:text-lg">
              Open a team to read the shared day, or create a new workspace.
            </p>
          </div>
          <CreateWorkspaceDialog />
        </div>
        {children}
      </main>
    </div>
  );
};

export { HomeShell };
