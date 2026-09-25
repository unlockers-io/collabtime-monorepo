import { Skeleton } from "@repo/ui/components/skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

import ResetPasswordForm from "@/app/(auth)/reset-password/form";

import { AuthPage } from "../auth-shell";

const metadata: Metadata = {
  description: "Choose a new password for your account",
  robots: { follow: false, index: false },
  title: "Reset your password",
};

const FormSkeleton = () => (
  <div aria-busy="true" className="flex flex-col gap-5">
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-28 rounded-none" />
      <Skeleton className="h-11 w-full sm:h-10" />
    </div>
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-36 rounded-none" />
      <Skeleton className="h-11 w-full sm:h-10" />
    </div>
    <Skeleton className="h-11 w-full sm:h-10" />
  </div>
);

const Page = () => (
  <AuthPage description="Choose a new password for your account." title="Reset your password">
    <Suspense fallback={<FormSkeleton />}>
      <ResetPasswordForm />
    </Suspense>
  </AuthPage>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export { metadata };
export default Page;
