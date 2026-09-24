import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";

import { Logo } from "@/components/nav/logo";
import { PageHeader, PageMain } from "@/components/page-layout";

const WorkspaceNotFound = () => (
  <div className="flex flex-1 flex-col">
    <header className="mx-auto flex min-h-20 w-full max-w-450 items-center px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <Logo />
    </header>
    <PageMain>
      <PageHeader
        description="This link doesn't match a workspace. It may have been deleted, or part of the link is missing. Ask whoever shared it to send it again."
        title="Workspace not found"
      />
      <div>
        <Link className={cn(buttonVariants({ size: "lg" }))} href="/">
          Back to home
        </Link>
      </div>
    </PageMain>
  </div>
);

export default WorkspaceNotFound;
