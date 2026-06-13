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
          <div aria-busy="true" className="flex flex-col gap-4">
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
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
