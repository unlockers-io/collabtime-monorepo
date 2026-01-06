"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Settings, Globe, Lock, Crown, Eye, EyeOff } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Spinner,
} from "@repo/ui";

type Space = {
  id: string;
  teamId: string;
  isPrivate: boolean;
  hasPassword: boolean;
};

type SpaceSettingsDialogProps = {
  teamId: string;
  isPro: boolean;
  space: Space | null;
  onSpaceUpdated: (space: Space) => void;
};

const spaceSettingsSchema = z.object({
  isPrivate: z.boolean(),
  changePassword: z.boolean(),
  accessPassword: z
    .string()
    .min(4, "Password must be at least 4 characters")
    .optional()
    .or(z.literal("")),
});

type SpaceSettingsFormValues = z.infer<typeof spaceSettingsSchema>;

const SpaceSettingsDialog = ({
  teamId,
  isPro,
  space,
  onSpaceUpdated,
}: SpaceSettingsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SpaceSettingsFormValues>({
    resolver: zodResolver(spaceSettingsSchema),
    mode: "onChange",
    defaultValues: {
      isPrivate: space?.isPrivate ?? false,
      changePassword: false,
      accessPassword: "",
    },
  });

  const { handleSubmit, control, formState, watch, reset, setValue } = form;

  const isPrivate = watch("isPrivate");
  const changePassword = watch("changePassword");

  // Reset form when space changes or dialog opens
  useEffect(() => {
    if (open) {
      reset({
        isPrivate: space?.isPrivate ?? false,
        changePassword: false,
        accessPassword: "",
      });
      setShowPassword(false);
    }
  }, [open, space, reset]);

  const handleClaimSpace = async () => {
    setIsClaiming(true);

    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Failed to claim space");
        return;
      }

      onSpaceUpdated(data.space);
      toast.success("Space claimed successfully!");
    } catch {
      toast.error("Failed to claim space");
    } finally {
      setIsClaiming(false);
    }
  };

  const onSubmit = async (data: SpaceSettingsFormValues) => {
    if (!space) return;

    setIsLoading(true);

    try {
      const updates: Record<string, unknown> = {};

      if (data.isPrivate !== space.isPrivate) {
        updates.isPrivate = data.isPrivate;
      }

      // Only update password if explicitly requested
      if (data.changePassword) {
        updates.updatePassword = true;
        if (data.accessPassword) {
          updates.accessPassword = data.accessPassword;
        } else {
          // Clear password
          updates.accessPassword = null;
        }
      }

      if (Object.keys(updates).length === 0) {
        setOpen(false);
        return;
      }

      const response = await fetch(`/api/spaces/${space.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 402) {
          toast.error("This feature requires a PRO subscription");
        } else {
          toast.error(result.error ?? "Failed to update space");
        }
        return;
      }

      onSpaceUpdated(result.space);
      toast.success("Space settings updated!");
      setOpen(false);
    } catch {
      toast.error("Failed to update space");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Space Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-white dark:bg-neutral-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-neutral-900 dark:text-neutral-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 dark:bg-neutral-100">
              <Settings className="h-5 w-5 text-white dark:text-neutral-900" />
            </div>
            Space Settings
          </DialogTitle>
          <DialogDescription>
            Configure privacy settings for this team.
          </DialogDescription>
        </DialogHeader>

        {!space ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
              <Globe className="h-8 w-8 text-neutral-400" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                Claim this team
              </h3>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Claim ownership to configure privacy settings.
              </p>
            </div>
            <Button onClick={handleClaimSpace} disabled={isClaiming}>
              {isClaiming ? (
                <>
                  <Spinner className="mr-2" />
                  Claiming...
                </>
              ) : (
                "Claim Space"
              )}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-4 py-4">
              {/* Privacy Toggle */}
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Privacy
                  {!isPro && (
                    <span className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <Crown className="h-3 w-3" />
                      PRO
                    </span>
                  )}
                </Label>
                <Controller
                  control={control}
                  name="isPrivate"
                  render={({ field }) => (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={!field.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => field.onChange(false)}
                        disabled={!isPro && !space.isPrivate}
                        className="flex-1"
                      >
                        <Globe className="mr-2 h-4 w-4" />
                        Public
                      </Button>
                      <Button
                        type="button"
                        variant={field.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => field.onChange(true)}
                        disabled={!isPro}
                        className="flex-1"
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        Private
                      </Button>
                    </div>
                  )}
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {isPrivate
                    ? "Only people with the password can access this team."
                    : "Anyone with the link can view this team."}
                </p>
              </div>

              {/* Access Password */}
              {isPrivate && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="accessPassword">Access Password</Label>
                    {space.hasPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          setValue("changePassword", !changePassword);
                          if (!changePassword) {
                            setValue("accessPassword", "");
                          }
                        }}
                        className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                      >
                        {changePassword ? "Cancel" : "Change password"}
                      </button>
                    )}
                  </div>

                  {(!space.hasPassword || changePassword) && (
                    <>
                      <div className="relative">
                        <Controller
                          control={control}
                          name="accessPassword"
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="accessPassword"
                              type={showPassword ? "text" : "password"}
                              placeholder={
                                space.hasPassword
                                  ? "Enter new password"
                                  : "Set a password"
                              }
                              className="pr-10"
                            />
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {formState.errors.accessPassword && (
                        <p className="text-xs text-red-500">
                          {formState.errors.accessPassword.message}
                        </p>
                      )}
                      {space.hasPassword && changePassword && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Leave blank to remove password protection
                        </p>
                      )}
                    </>
                  )}

                  {space.hasPassword && !changePassword && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Password is set. Click &quot;Change password&quot; to
                      update.
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Spinner className="mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export { SpaceSettingsDialog };
export type { Space };
