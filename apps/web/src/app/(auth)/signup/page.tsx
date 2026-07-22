import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type { Metadata } from "next";
import { Suspense } from "react";

import SignupForm from "@/app/(auth)/signup/form";

const metadata: Metadata = {
  description: "Enter your details to get started with Collab Time",
  robots: { follow: false, index: false },
  title: "Create your account",
};

const Page = () => (
  <Card>
    <CardHeader className="text-center">
      <CardTitle className="text-xl">Create your account</CardTitle>
      <CardDescription>Enter your details to get started with Collab Time</CardDescription>
    </CardHeader>
    <CardContent>
      {/* The form reads ?redirect= via useSearchParams, which needs a Suspense boundary. */}
      <Suspense
        fallback={
          <div aria-busy="true" className="flex flex-col gap-7">
            <div className="flex flex-col gap-3">
              <div className="h-4 w-20 animate-pulse rounded-md bg-muted" />
              <div className="h-9 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="flex flex-col gap-3">
              <div className="h-4 w-16 animate-pulse rounded-md bg-muted" />
              <div className="h-9 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="flex flex-col gap-3">
              <div className="h-4 w-20 animate-pulse rounded-md bg-muted" />
              <div className="h-9 animate-pulse rounded-md bg-muted" />
              <div className="h-3 w-48 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="flex flex-col gap-3">
              <div className="h-8 animate-pulse rounded-md bg-muted" />
              <div className="mx-auto h-4 w-44 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        }
      >
        <SignupForm />
      </Suspense>
    </CardContent>
  </Card>
);

export { metadata };
export default Page;
