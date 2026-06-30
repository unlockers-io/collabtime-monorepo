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

/**
 * Auth-entry route gated by a layout that reads the session to bounce signed-in
 * users; there is no per-user shell worth streaming, so block the navigation.
 * @public Next.js app-router reads the `instant` route config via the module loader
 */
export const instant = false;

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
          <div aria-busy="true" className="flex flex-col gap-4">
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
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
