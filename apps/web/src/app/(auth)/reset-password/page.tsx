import type { Metadata } from "next";
import { SkeletonSuspense } from "skullet/react";

import ResetPasswordForm, { NewPasswordForm } from "@/app/(auth)/reset-password/form";

import { AuthPage } from "../auth-shell";

const metadata: Metadata = {
  description: "Choose a new password for your account",
  robots: { follow: false, index: false },
  title: "Reset your password",
};

const Page = () => (
  <AuthPage description="Choose a new password for your account." title="Reset your password">
    <SkeletonSuspense label="Loading the reset form" skeleton={<NewPasswordForm token="sample" />}>
      <ResetPasswordForm />
    </SkeletonSuspense>
  </AuthPage>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export { metadata };

export default Page;
