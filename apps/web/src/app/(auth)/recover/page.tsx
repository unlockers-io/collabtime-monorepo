import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type { Metadata } from "next";
import { Suspense } from "react";

import RecoverForm from "@/app/(auth)/recover/form";

import { AuthGate } from "../auth-gate";

const metadata: Metadata = {
  description: "Enter your email and we'll send you a link to reset your password",
  robots: { follow: false, index: false },
  title: "Recover your account",
};

const Page = () => (
  <>
    <Suspense fallback={null}>
      <AuthGate />
    </Suspense>
    <Card>
      <CardHeader className="text-center">
        <CardTitle>
          <h2 className="font-display text-xl">Recover your account</h2>
        </CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a link to reset your password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RecoverForm />
      </CardContent>
    </Card>
  </>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export { metadata };
export default Page;
