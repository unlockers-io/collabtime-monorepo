"use client";

import {
  Button,
  FieldError,
  FieldLabel,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Spinner,
} from "@repo/ui";
import { useForm } from "@tanstack/react-form";
import { Settings, Globe, Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

type Space = {
  hasPassword: boolean;
  id: string;
  isPrivate: boolean;
  teamId: string;
};

type SpaceSettingsDialogProps = {
  onSpaceUpdated: (space: Space) => void;
  space: Space | null;
  teamId: string;
};

const spaceSettingsSchema = z.object({
  isPrivate: z.boolean(),
  changePassword: z.boolean(),
  accessPassword: z.union([
    z.string().min(4, "Password must be at least 4 characters"),
    z.literal(""),
  ]),
});

const SpaceSettingsDialog = ({ teamId, space, onSpaceUpdated }: SpaceSettingsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    defaultValues: {
      isPrivate: space?.isPrivate ?? false,
      changePassword: false,
      accessPassword: "",
    },
    validators: {
      onBlur: spaceSettingsSchema,
      onChange: spaceSettingsSchema,
    },
    onSubmit: async ({ value }) => {
      if (!space) {
        return;
      }

      setIsLoading(true);

      try {
        const updates: Record<string, unknown> = {};

        if (value.isPrivate !== space.isPrivate) {
          updates.isPrivate = value.isPrivate;
        }

        if (value.changePassword) {
          updates.updatePassword = true;
          if (value.accessPassword) {
            updates.accessPassword = value.accessPassword;
          } else {
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

        const result = (await response.json()) as { error?: string; space?: Space };

        if (!response.ok) {
          toast.error(result.error ?? "Failed to update space");
          return;
        }

        onSpaceUpdated(result.space!);
        toast.success("Space settings updated!");
        setOpen(false);
      } catch {
        toast.error("Failed to update space");
      } finally {
        setIsLoading(false);
      }
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      form.reset();
      form.setFieldValue("isPrivate", space?.isPrivate ?? false);
      form.setFieldValue("changePassword", false);
      form.setFieldValue("accessPassword", "");
      setShowPassword(false);
    }
  };

  const handleClaimSpace = async () => {
    setIsClaiming(true);

    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });

      const data = (await response.json()) as { error?: string; space?: Space };

      if (!response.ok) {
        toast.error(data.error ?? "Failed to claim space");
        return;
      }

      onSpaceUpdated(data.space!);
      toast.success("Space claimed successfully!");
    } catch {
      toast.error("Failed to claim space");
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Space Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Settings className="h-5 w-5 text-primary-foreground" />
            </div>
            Space Settings
          </DialogTitle>
          <DialogDescription>Configure privacy settings for this team.</DialogDescription>
        </DialogHeader>

        {!space ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-foreground">Claim this team</h3>
              <p className="text-sm text-muted-foreground">
                Claim ownership to configure privacy settings.
              </p>
            </div>
            <Button onClick={handleClaimSpace} disabled={isClaiming}>
              {isClaiming ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Claiming...
                </span>
              ) : (
                "Claim Space"
              )}
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <div className="flex flex-col gap-4 py-4">
              <form.Field name="isPrivate">
                {(field) => (
                  <div className="flex flex-col gap-2">
                    <FieldLabel className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Privacy
                    </FieldLabel>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={!field.state.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => field.handleChange(false)}
                        className="flex-1"
                      >
                        <span className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Public
                        </span>
                      </Button>
                      <Button
                        type="button"
                        variant={field.state.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => field.handleChange(true)}
                        className="flex-1"
                      >
                        <span className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          Private
                        </span>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {field.state.value
                        ? "Only people with the password can access this team."
                        : "Anyone with the link can view this team."}
                    </p>
                  </div>
                )}
              </form.Field>

              <form.Subscribe
                selector={(state) => ({
                  isPrivate: state.values.isPrivate,
                  changePassword: state.values.changePassword,
                })}
              >
                {({ isPrivate: isPrivateValue, changePassword: changePasswordValue }) => (
                  <>
                    {isPrivateValue && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <FieldLabel htmlFor="accessPassword">Access Password</FieldLabel>
                          {space.hasPassword && (
                            <button
                              type="button"
                              onClick={() => {
                                const current = form.getFieldValue("changePassword");
                                form.setFieldValue("changePassword", !current);
                                if (!current) {
                                  form.setFieldValue("accessPassword", "");
                                }
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              {changePasswordValue ? "Cancel" : "Change password"}
                            </button>
                          )}
                        </div>

                        {(!space.hasPassword || changePasswordValue) && (
                          <form.Field name="accessPassword">
                            {(field) => (
                              <>
                                <div className="relative">
                                  <Input
                                    id="accessPassword"
                                    type={showPassword ? "text" : "password"}
                                    placeholder={
                                      space.hasPassword ? "Enter new password" : "Set a password"
                                    }
                                    className="pr-10"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  >
                                    {showPassword ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                                {field.state.meta.isTouched && !field.state.meta.isValid && (
                                  <FieldError errors={field.state.meta.errors} />
                                )}
                                {space.hasPassword && changePasswordValue && (
                                  <p className="text-xs text-muted-foreground">
                                    Leave blank to remove password protection
                                  </p>
                                )}
                              </>
                            )}
                          </form.Field>
                        )}

                        {space.hasPassword && !changePasswordValue && (
                          <p className="text-xs text-muted-foreground">
                            Password is set. Click &quot;Change password&quot; to update.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </form.Subscribe>
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
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Saving...
                  </span>
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
