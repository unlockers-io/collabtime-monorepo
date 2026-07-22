import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
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
              <div className="h-4 w-28 animate-pulse rounded-md bg-muted" />
              <div className="h-9 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="flex flex-col gap-3">
              <div className="h-4 w-36 animate-pulse rounded-md bg-muted" />
              <div className="h-9 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="flex flex-col gap-3">
              <div className="h-8 animate-pulse rounded-md bg-muted" />
              <div className="mx-auto h-4 w-32 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </CardContent>
  </Card>
);

export { metadata };
export default Page;
