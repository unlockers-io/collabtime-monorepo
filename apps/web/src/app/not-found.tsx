import Link from "next/link";
import { Home } from "lucide-react";

import { Card } from "@repo/ui";
import { Button } from "@repo/ui";

export const metadata = {
  title: "404",
  description:
    "This page doesn't exist (or this team ID can't be found). Head back home and create a new team.",
};

const NotFound = () => {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
      <main className="w-full max-w-xl">
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  This team doesn&apos;t exist
                </h1>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              If you were trying to open a team, the ID might be wrong (or the
              link expired). If you typed a URL, it may have drifted into a
              parallel timezone.
            </p>

            <Link href="/" className="w-full">
              <Button className="w-full">
                <Home className="h-4 w-4" />
                Back to home
              </Button>
            </Link>

            <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted p-4 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">
                Quick checks
              </div>
              <ul className="list-disc space-y-1 pl-4">
                <li>Double-check the team ID in the address bar.</li>
                <li>Ask an admin for a fresh link if you&apos;re locked out.</li>
                <li>Start a new team from the home page.</li>
              </ul>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default NotFound;
