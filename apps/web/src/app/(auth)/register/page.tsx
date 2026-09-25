import type { Metadata } from "next";
import { Suspense } from "react";

import RegisterForm from "@/app/(auth)/register/form";

import { AuthGate } from "../auth-gate";
import { AuthPage } from "../auth-shell";

const metadata: Metadata = {
  description: "Set up a workspace and find the hours your team shares",
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
    <AuthPage
      description="Set up a workspace and find the hours your team shares."
      title="Create your account"
    >
      <RegisterForm searchParams={searchParams} />
    </AuthPage>
  </>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export { metadata };
export default Page;
