"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
    } catch {
      toast.error("Failed to sign out");
    } finally {
      setIsSigningOut(false);
    }
  };

  return { handleSignOut, isSigningOut };
};

export { useSignOut };
