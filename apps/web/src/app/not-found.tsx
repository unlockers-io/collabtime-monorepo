import { buttonVariants } from "@repo/ui/components/button";
import Link from "next/link";

/** @public Next.js app-router reads metadata via the module loader */
export const metadata = {
  description: "The page you're looking for doesn't exist or has moved.",
  title: "Page not found",
};

const NotFound = () => {
  return (
    <main
      className="flex min-h-dvh flex-1 items-center justify-center px-4 py-10 sm:px-6"
      id="main"
    >
      <div className="flex max-w-xl flex-col items-center gap-4 text-center">
        <p className="font-display text-7xl font-semibold tracking-tight text-foreground tabular-nums sm:text-8xl">
          404
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          Page not found
        </h1>
        <p className="max-w-[60ch] text-sm text-pretty text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Link className={buttonVariants()} href="/">
          Go home
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
