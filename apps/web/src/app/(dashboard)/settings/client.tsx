"use client";

import { Button, Card, Input, Label, Spinner } from "@repo/ui";
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
    <div className="max-w-3xl px-4 py-8 mx-auto">
      <div className="gap-8 flex flex-col">
        <div className="gap-1 flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account</p>
        </div>

        <div className="gap-6 flex flex-col">
          {/* Profile Section */}
          <Card className="gap-6 p-6 flex flex-col">
            <div className="gap-3 flex items-center">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-secondary">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Profile</h2>
                <p className="text-sm text-muted-foreground">Your account information</p>
              </div>
            </div>

            <div className="gap-4 flex flex-col">
              <div className="gap-2 flex flex-col">
                <Label htmlFor="name">Name</Label>
                <div className="gap-2 flex">
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

              <div className="gap-2 flex flex-col">
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
