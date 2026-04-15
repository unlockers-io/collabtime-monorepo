import { Button } from "@repo/ui/components/button";
import Link from "next/link";

export const metadata = {
  title: "Page not found",
  description: "The page you're looking for doesn't exist or has moved.",
};

const NotFound = () => {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-10 sm:px-6">
      <div className="flex max-w-xl flex-col items-center gap-4 text-center">
        <p className="text-7xl font-semibold tracking-tight text-foreground sm:text-8xl">404</p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          Page not found
        </h1>
        <p className="max-w-[60ch] text-sm text-pretty text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Button render={<Link href="/" />}>Go home</Button>
      </div>
    </main>
  );
};

export default NotFound;
