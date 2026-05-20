import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type { Metadata } from "next";

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
      <LoginForm />
    </CardContent>
  </Card>
);

export { metadata };
export default Page;
