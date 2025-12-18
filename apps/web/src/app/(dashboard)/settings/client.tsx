"use client";

import { useState } from "react";
import { toast } from "sonner";
import { User, CreditCard, Crown, Check, Loader2 } from "lucide-react";
import {
  Button,
  Card,
  Input,
  Label,
  Spinner,
} from "@repo/ui";

type SettingsClientProps = {
  user: {
    id: string;
    name: string;
    email: string;
    subscriptionPlan: string;
  };
  subscription: {
    status: string;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
};

const PRO_FEATURES = [
  "Custom subdomain (acme.collabtime.io)",
  "Password protection for spaces",
  "Priority support",
  "Custom branding (coming soon)",
];

const SettingsClient = ({ user, subscription }: SettingsClientProps) => {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [name, setName] = useState(user.name);
  const [isSaving, setIsSaving] = useState(false);

  const isPro = user.subscriptionPlan === "PRO";
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  const handleUpgrade = async () => {
    setIsUpgrading(true);

    try {
      const response = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          successUrl: `${window.location.origin}/settings?success=true`,
          cancelUrl: `${window.location.origin}/settings?canceled=true`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Failed to start checkout");
        setIsUpgrading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error("Failed to start checkout");
      setIsUpgrading(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsManaging(true);

    try {
      const response = await fetch("/api/subscription/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/settings`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Failed to open billing portal");
        setIsManaging(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error("Failed to open billing portal");
      setIsManaging(false);
    }
  };

  const handleSaveName = async () => {
    if (name.trim() === user.name) return;

    setIsSaving(true);

    try {
      const response = await fetch("/api/auth/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error ?? "Failed to update name");
        return;
      }

      toast.success("Name updated successfully");
    } catch {
      toast.error("Failed to update name");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Settings
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Manage your account and subscription
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Profile Section */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
              <User className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
                Profile
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Your account information
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <div className="flex gap-2">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
                <Button
                  onClick={handleSaveName}
                  disabled={isSaving || name.trim() === user.name}
                  variant="outline"
                >
                  {isSaving ? <Spinner /> : "Save"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-neutral-50 dark:bg-neutral-900"
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Email cannot be changed
              </p>
            </div>
          </div>
        </Card>

        {/* Subscription Section */}
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
              <CreditCard className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
                Subscription
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Manage your plan
              </p>
            </div>
          </div>

          {isPro && isActive ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
                <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <span className="font-medium text-amber-700 dark:text-amber-300">
                  PRO Plan Active
                </span>
              </div>

              {subscription?.periodEnd && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {subscription.cancelAtPeriodEnd
                    ? `Your subscription will end on ${formatDate(subscription.periodEnd)}`
                    : `Next billing date: ${formatDate(subscription.periodEnd)}`}
                </p>
              )}

              <Button
                onClick={handleManageSubscription}
                disabled={isManaging}
                variant="outline"
              >
                {isManaging ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Manage Subscription"
                )}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="rounded-xl border border-neutral-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 dark:border-neutral-700 dark:from-amber-900/20 dark:to-orange-900/20">
                <div className="mb-4 flex items-center gap-2">
                  <Crown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    Upgrade to PRO
                  </h3>
                </div>

                <p className="mb-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  $10
                  <span className="text-base font-normal text-neutral-500 dark:text-neutral-400">
                    /year
                  </span>
                </p>

                <ul className="mb-6 flex flex-col gap-2">
                  {PRO_FEATURES.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300"
                    >
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={handleUpgrade}
                  disabled={isUpgrading}
                  className="w-full bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
                >
                  {isUpgrading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting to checkout...
                    </>
                  ) : (
                    <>
                      <Crown className="mr-2 h-4 w-4" />
                      Upgrade to PRO
                    </>
                  )}
                </Button>
              </div>

              <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
                Secure checkout powered by Stripe. Cancel anytime.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export { SettingsClient };
