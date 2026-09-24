import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/nav/logo";
import { PageHeader, PageMain } from "@/components/page-layout";

/** @public Next.js app-router reads metadata via the module loader */
export const metadata: Metadata = {
  description: "There is no page at this address.",
  robots: { follow: false, index: false },
  title: "Page not found",
};

const NotFound = () => (
  <div className="flex flex-1 flex-col">
    <header className="mx-auto flex min-h-20 w-full max-w-450 items-center px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <Logo />
    </header>
    <PageMain>
      <PageHeader
        description="The link may be mistyped, or the page may have moved. If someone shared a workspace link with you, ask them to send it again."
        title="Page not found"
      />
      <div>
        <Link className={cn(buttonVariants({ size: "lg" }))} href="/">
          Back to home
        </Link>
      </div>
    </PageMain>
  </div>
);

export default NotFound;
