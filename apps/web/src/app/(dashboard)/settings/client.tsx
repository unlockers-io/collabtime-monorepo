"use client";

import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Spinner } from "@repo/ui/components/spinner";
import { User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

type SettingsClientProps = {
  user: {
    email: string;
    id: string;
    name: string;
  };
};

const SettingsClient = ({ user }: SettingsClientProps) => {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveName = async () => {
    const trimmedName = name.trim();
    if (trimmedName === user.name) {
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await authClient.updateUser({
        name: trimmedName,
      });

      if (error) {
        console.error("[Settings] Failed to update name:", error);
        toast.error(error.message ?? "Failed to update name");
        return;
      }

      toast.success("Name updated successfully");
      router.refresh();
    } catch (error) {
      console.error("[Settings] Unexpected error updating name:", error);
      toast.error("Failed to update name");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account</p>
        </div>

        <div className="flex flex-col gap-6">
          {/* Profile Section */}
          <Card className="flex flex-col gap-6 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Profile</h2>
                <p className="text-sm text-muted-foreground">Your account information</p>
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
                <Input id="email" value={user.email} disabled className="bg-secondary" />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export { SettingsClient };
