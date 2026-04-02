import { Card } from "@repo/ui";
import { Button } from "@repo/ui";
import { Home } from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";

export const metadata = {
  title: "404",
  description:
    "This page doesn't exist (or this team ID can't be found). Head back home and create a new team.",
};

const NotFound = () => {
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      <div className="px-4 py-10 sm:px-6 flex flex-1 items-center justify-center">
        <main className="max-w-xl w-full">
          <Card className="p-6 sm:p-8">
            <div className="gap-4 flex flex-col">
              <div className="gap-4 flex items-start justify-between">
                <div className="gap-3 flex items-center">
                  <h1 className="text-xl font-bold tracking-tight sm:text-2xl text-foreground">
                    This team doesn&apos;t exist
                  </h1>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                If you were trying to open a team, the ID might be wrong (or the link expired). If
                you typed a URL, it may have drifted into a parallel timezone.
              </p>

              <Link href="/" transitionTypes={["nav-back"]} className="w-full">
                <Button className="w-full">
                  <Home className="h-4 w-4" />
                  Back to home
                </Button>
              </Link>

              <div className="gap-2 p-4 text-xs flex flex-col rounded-xl border border-border bg-muted text-muted-foreground">
                <div className="font-medium text-foreground">Quick checks</div>
                <ul className="space-y-1 pl-4 list-disc">
                  <li>Double-check the team ID in the address bar.</li>
                  <li>Ask an admin for a fresh link if you&apos;re locked out.</li>
                  <li>Start a new team from the home page.</li>
                </ul>
              </div>
            </div>
          </Card>
        </main>
      </div>
    </ViewTransition>
  );
};

export default NotFound;
