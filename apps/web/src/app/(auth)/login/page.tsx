import type { Metadata } from "next";
import { Suspense } from "react";

import LoginForm from "@/app/(auth)/login/form";

import { AuthGate } from "../auth-gate";
import { AuthPage } from "../auth-shell";

import { LoginNotice } from "./login-notice";

const metadata: Metadata = {
  description: "Sign in to get back to your team's timeline",
  robots: { follow: false, index: false },
  title: "Welcome back",
};

type SearchParams = Promise<{ message?: string | Array<string>; redirect?: string }>;

type Props = {
  searchParams: SearchParams;
};

const Page = ({ searchParams }: Props) => (
  <>
    <Suspense fallback={null}>
      <AuthGate searchParams={searchParams} />
    </Suspense>
    <AuthPage
      description="Sign in to get back to your team's timeline."
      notice={
        <Suspense fallback={null}>
          <LoginNotice searchParams={searchParams} />
        </Suspense>
      }
      title="Welcome back"
    >
      <LoginForm searchParams={searchParams} />
    </AuthPage>
  </>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export { metadata };
export default Page;
