import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Home } from "lucide-react";
import Link from "next/link";

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
            <h1 className="max-w-[28ch] text-xl font-semibold tracking-tight text-balance text-foreground sm:text-2xl">
              This team doesn&apos;t exist
            </h1>

            <p className="max-w-[60ch] text-sm text-pretty text-muted-foreground">
              If you were trying to open a team, the ID might be wrong (or the link expired). If you
              typed a URL, it may have drifted into a parallel timezone.
            </p>

            <Link className="w-full" href="/">
              <Button className="w-full">
                <Home className="size-4" />
                Back to home
              </Button>
            </Link>

            <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Quick checks</div>
              <ul className="list-disc space-y-1 pl-4" role="list">
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
