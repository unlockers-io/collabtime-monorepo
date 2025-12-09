"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Users, X } from "lucide-react";
import { createGroup } from "@/lib/actions";
import type { TeamGroup } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type AddGroupFormProps = {
  teamId: string;
  onGroupAdded: (group: TeamGroup) => void;
};

const formSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(50, "Group name must be 50 characters or less")
    .trim(),
});

type FormValues = z.infer<typeof formSchema>;

const AddGroupForm = ({ teamId, onGroupAdded }: AddGroupFormProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
    },
  });

  const { handleSubmit, control, reset, formState } = form;

  const onSubmit = async (data: FormValues) => {
    const result = await createGroup(teamId, { name: data.name });

    if (result.success) {
      reset({ name: "" });
      setIsOpen(false);
      onGroupAdded(result.data.group);
      toast.success(`Group "${data.name}" created`);
    } else {
      toast.error(result.error);
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        type="button"
        className="group flex h-14 w-full items-center justify-center gap-2 border-2 border-dashed border-neutral-200 bg-neutral-50/50 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-100/50 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/50"
        onClick={() => setIsOpen(true)}
      >
        <Users className="h-5 w-5 transition-transform group-hover:scale-110" />
        <span className="font-medium">Add Group</span>
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card className="flex items-center gap-3 p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 dark:bg-neutral-100">
          <Users className="h-3.5 w-3.5 text-white dark:text-neutral-900" />
        </div>

        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Input
              {...field}
              placeholder="Group name…"
              className="h-9 flex-1"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  reset({ name: "" });
                  setIsOpen(false);
                }
              }}
            />
          )}
        />

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={formState.isSubmitting || !formState.isValid}
            className="h-9"
          >
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            onClick={() => {
              reset({ name: "" });
              setIsOpen(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </form>
  );
};

export { AddGroupForm };
