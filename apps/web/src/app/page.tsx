"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Crown, Users, X } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useVisitedTeams } from "@/hooks/use-visited-teams";
import { authenticateTeam, createTeam } from "@/lib/actions";
import { useSession } from "@/lib/auth-client";
import { writeTeamSession } from "@/lib/team-session";
import { PasswordSchema } from "@/lib/validation";
import { ProFeaturesDialog } from "@/components/pro-features-dialog";
import { Nav } from "@/components/nav";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Spinner,
} from "@repo/ui";

const formSchema = z.object({
  adminPassword: PasswordSchema,
});

type FormValues = z.infer<typeof formSchema>;

const Home = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { visitedTeams, removeVisitedTeam, isHydrated } = useVisitedTeams();

  const isAuthenticated = Boolean(session?.user);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      adminPassword: "",
    },
  });

  const handleCreateTeam = () => {
    form.reset({ adminPassword: "" });
    setIsCreateDialogOpen(true);
  };

  const handleSubmitCreateTeam = async (values: FormValues) => {
    setIsCreating(true);
    try {
      const createResult = await createTeam(values.adminPassword);
      if (!createResult.success) {
        toast.error(createResult.error);
        return;
      }

      // Authenticate to get admin session token
      const authResult = await authenticateTeam(
        createResult.data,
        values.adminPassword,
      );
      if (!authResult.success) {
        toast.error(authResult.error);
        return;
      }

      await writeTeamSession(createResult.data, authResult.data.token);
      router.push(`/${createResult.data}`);
    } catch {
      toast.error("Failed to create team. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemoveTeam = (teamId: string) => {
    removeVisitedTeam(teamId);
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-1 flex-col">
      <Nav />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-10 px-4 py-8 sm:gap-12 sm:px-6">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col gap-2 sm:gap-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Collab Time
            </h1>
            <p className="max-w-sm text-base leading-relaxed text-muted-foreground sm:text-lg">
              Visualize your team&apos;s working hours across timezones. Find
              the perfect moment to connect.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="flex w-full flex-col items-center gap-4">
          <button
            onClick={handleCreateTeam}
            disabled={isCreating}
            className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:w-auto sm:min-w-72 sm:gap-3 sm:px-8 sm:text-lg"
          >
            {isCreating ? (
              <>
                <Spinner className="h-5 w-5 text-primary-foreground" />
                Creating workspace...
              </>
            ) : (
              <>
                Create Team Workspace
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </>
            )}
          </button>

          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">
              No account needed &middot; Share the link with your team
            </p>
            <div className="flex items-center gap-3 text-sm">
              {!isAuthenticated && (
                <>
                  <Link
                    href="/signup"
                    className="font-medium text-foreground transition-colors hover:underline"
                  >
                    or sign in for more features
                  </Link>
                  <span className="text-border">
                    &middot;
                  </span>
                </>
              )}
              <ProFeaturesDialog isAuthenticated={isAuthenticated}>
                <span className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-amber-600 transition-colors hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300">
                  <Crown className="h-4 w-4" />
                  PRO features
                </span>
              </ProFeaturesDialog>
            </div>
          </div>
        </div>

        {/* Visited Teams */}
        <AnimatePresence>
          {isHydrated && visitedTeams.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{
                duration: 0.6,
                delay: 0.3,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex w-full flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Recent Workspaces
                </h2>
              </div>

              <div className="flex flex-col gap-2">
                <AnimatePresence mode="popLayout">
                  {visitedTeams.map((team) => (
                    <motion.div
                      key={team.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="group flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:border-input"
                    >
                      <Link
                        href={`/${team.id}`}
                        className="flex flex-1 items-center gap-3"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {team.name || "Team Workspace"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {team.memberCount === 0
                              ? "Empty"
                              : `${team.memberCount} member${team.memberCount !== 1 ? "s" : ""}`}
                            {" · "}
                            {formatRelativeTime(team.lastVisited)}
                          </span>
                        </div>
                      </Link>
                      <button
                        onClick={() => handleRemoveTeam(team.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-accent-foreground group-hover:opacity-100"
                        aria-label="Remove from list"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          if (isCreating) return;
          setIsCreateDialogOpen(open);
          if (open) {
            form.reset({ adminPassword: "" });
          }
        }}
      >
        <DialogContent className="max-w-md bg-popover">
          <form onSubmit={form.handleSubmit(handleSubmitCreateTeam)} noValidate>
            <DialogHeader>
              <DialogTitle className="text-popover-foreground">
                Create a team workspace
              </DialogTitle>
              <DialogDescription>
                Set an admin password to manage your team. Anyone with the link
                can view, but only admins can make changes.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <FieldGroup>
                <Controller
                  control={form.control}
                  name="adminPassword"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="create-admin-password">
                        Admin password
                      </FieldLabel>
                      <Input
                        {...field}
                        id="create-admin-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="At least 6 characters"
                        disabled={isCreating}
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </FieldGroup>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreating || !form.formState.isValid}
              >
                {isCreating ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Creating…
                  </span>
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
