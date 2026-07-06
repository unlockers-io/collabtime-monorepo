"use client";

import { toast } from "@repo/ui/components/sonner";
import { captureException } from "@sentry/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signOut } from "@/lib/auth-client";

const useSignOut = () => {
  const { push, refresh } = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await signOut({
        fetchOptions: {
          onError: () => {
            toast.error("Failed to sign out");
          },
          onSuccess: () => {
            toast.success("Signed out successfully");
            push("/");
            refresh();
          },
        },
      });
    } catch (error) {
      captureException(error);
      toast.error("Failed to sign out");
    }
    setIsSigningOut(false);
  };

  return { handleSignOut, isSigningOut };
};

export { useSignOut };
