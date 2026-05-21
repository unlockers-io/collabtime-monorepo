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
          <div aria-busy="true" className="flex flex-col gap-4">
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
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
