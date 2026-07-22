import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type { Metadata } from "next";
import { Suspense } from "react";

import LoginForm from "@/app/(auth)/login/form";

const metadata: Metadata = {
  description: "Sign in to your account to continue",
  robots: { follow: false, index: false },
  title: "Welcome back",
};

const Page = () => (
  <Card>
    <CardHeader className="text-center">
      <CardTitle className="text-xl">Welcome back</CardTitle>
      <CardDescription>Sign in to your account to continue</CardDescription>
    </CardHeader>
    <CardContent>
      {/* The form reads ?redirect= via useSearchParams, which needs a Suspense boundary. */}
      <Suspense
        fallback={
          <div aria-busy="true" className="flex flex-col gap-7">
            <div className="flex flex-col gap-3">
              <div className="h-4 w-16 animate-pulse rounded-md bg-muted" />
              <div className="h-9 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-36 animate-pulse rounded-md bg-muted" />
              </div>
              <div className="h-9 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="flex flex-col gap-3">
              <div className="h-8 animate-pulse rounded-md bg-muted" />
              <div className="mx-auto h-4 w-44 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </CardContent>
  </Card>
);

export { metadata };
export default Page;
