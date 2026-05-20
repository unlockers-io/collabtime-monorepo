import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type { Metadata } from "next";

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
      <SignupForm />
    </CardContent>
  </Card>
);

export { metadata };
export default Page;
