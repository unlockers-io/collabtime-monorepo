import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

import ResetPasswordForm from "@/app/(auth)/reset-password/form";

const metadata: Metadata = {
  description: "Enter a new password for your account",
  robots: { follow: false, index: false },
  title: "Reset your password",
};

const Page = () => (
  <Card>
    <CardHeader className="text-center">
      <CardTitle className="text-xl">Reset your password</CardTitle>
      <CardDescription>Enter a new password for your account</CardDescription>
    </CardHeader>
    <CardContent>
      <Suspense
        fallback={
          <div aria-busy="true" className="flex flex-col gap-7">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-28 rounded-none" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-36 rounded-none" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="mx-auto h-4 w-32 rounded-none" />
            </div>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </CardContent>
  </Card>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export { metadata };
export default Page;
