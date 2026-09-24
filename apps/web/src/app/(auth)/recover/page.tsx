import type { Metadata } from "next";
import { Suspense } from "react";

import RecoverForm from "@/app/(auth)/recover/form";

import { AuthGate } from "../auth-gate";
import { AuthPage } from "../auth-shell";

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
    <AuthPage
      description="Enter your email and we'll send you a link to reset your password."
      title="Recover your account"
    >
      <RecoverForm />
    </AuthPage>
  </>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export { metadata };
export default Page;
