import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type { Metadata } from "next";

import RecoverForm from "@/app/(auth)/recover/form";

const metadata: Metadata = {
  description: "Enter your email and we'll send you a link to reset your password",
  robots: { follow: false, index: false },
  title: "Recover your account",
};

const Page = () => (
  <Card>
    <CardHeader className="text-center">
      <CardTitle className="text-xl">Recover your account</CardTitle>
      <CardDescription>
        Enter your email and we&apos;ll send you a link to reset your password
      </CardDescription>
    </CardHeader>
    <CardContent>
      <RecoverForm />
    </CardContent>
  </Card>
);

export { metadata };
export default Page;
