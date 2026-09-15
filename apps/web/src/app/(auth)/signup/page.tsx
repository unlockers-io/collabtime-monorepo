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
import { APP_NAME } from "@/lib/constants";

import { AuthGate } from "../auth-gate";

const metadata: Metadata = {
  description: `Enter your details to get started with ${APP_NAME}`,
  robots: { follow: false, index: false },
  title: "Create your account",
};

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

const Page = ({ searchParams }: Props) => (
  <>
    <Suspense fallback={null}>
      <AuthGate searchParams={searchParams} />
    </Suspense>
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl" display>
          Create your account
        </CardTitle>
        <CardDescription>Enter your details to get started with {APP_NAME}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm searchParams={searchParams} />
      </CardContent>
    </Card>
  </>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export { metadata };
export default Page;
