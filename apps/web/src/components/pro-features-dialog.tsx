"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, Lock, Shield, Zap, Check, ArrowRight, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";

type ProFeature = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

const proFeatures: ProFeature[] = [
  {
    icon: <Lock className="h-5 w-5" />,
    title: "Private Spaces",
    description:
      "Protect your team workspaces with password authentication. Only authorized members can view your team's timezone data.",
  },
  {
    icon: <Download className="h-5 w-5" />,
    title: "Export Team Data",
    description:
      "Download your team's timezone data as CSV or JSON. Perfect for backups, integrations, or sharing with other tools.",
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: "Access Control",
    description:
      "Set custom passwords for each space. Share access securely with your team without exposing data publicly.",
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Priority Support",
    description:
      "Get faster responses and dedicated assistance when you need help with your team's setup.",
  },
];

type ProFeaturesDialogProps = {
  children?: React.ReactNode;
  isAuthenticated?: boolean;
};

const ProFeaturesDialog = ({
  children,
  isAuthenticated = false,
}: ProFeaturesDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children ? (
        <button onClick={() => setOpen(true)} className="contents">
          {children}
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 transition-colors hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
        >
          <Crown className="h-4 w-4" />
          View PRO features
        </button>
      )}
      <DialogContent className="flex flex-col gap-4 max-w-lg bg-popover">
        <DialogHeader className="flex flex-col gap-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-amber-400 to-amber-600">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-center text-xl text-foreground">
            Upgrade to PRO
          </DialogTitle>
          <DialogDescription className="text-center">
            Unlock powerful features to keep your team&apo;s data secure and
            organized.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {proFeatures.map((feature, index) => (
            <div
              key={index}
              className="flex gap-4 rounded-lg border border-border bg-secondary p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                {feature.icon}
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-green-500" />
            <span>Cancel anytime</span>
            <span className="text-muted-foreground/30">•</span>
            <Check className="h-4 w-4 text-green-500" />
            <span>Instant access</span>
          </div>

          {isAuthenticated ? (
            <Link
              href="/settings"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Upgrade Now
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <div className="flex flex-col gap-2">
              <Link
                href="/signup"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Create Account to Upgrade
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { ProFeaturesDialog };
