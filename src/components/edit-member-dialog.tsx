"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TeamGroup, TeamMember } from "@/types";
import { updateMember } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GroupSelector } from "@/components/group-selector";
import { COMMON_TIMEZONES, formatTimezoneLabel } from "@/lib/timezones";
import { formatHour } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

type EditMemberDialogProps = {
  member: TeamMember;
  teamId: string;
  groups: TeamGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberUpdated: (member: TeamMember) => void;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

type EditMemberFormProps = {
  member: TeamMember;
  teamId: string;
  groups: TeamGroup[];
  onOpenChange: (open: boolean) => void;
  onMemberUpdated: (member: TeamMember) => void;
};

const EditMemberForm = ({
  member,
  teamId,
  groups,
  onOpenChange,
  onMemberUpdated,
}: EditMemberFormProps) => {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(member.name);
  const [title, setTitle] = useState(member.title);
  const [timezone, setTimezone] = useState(member.timezone);
  const [workingHoursStart, setWorkingHoursStart] = useState(
    member.workingHoursStart
  );
  const [workingHoursEnd, setWorkingHoursEnd] = useState(member.workingHoursEnd);
  const [groupId, setGroupId] = useState<string | undefined>(member.groupId);

  const handleSave = () => {
    if (!name.trim()) return;

    startTransition(async () => {
      const result = await updateMember(teamId, member.id, {
        name: name.trim(),
        title: title.trim(),
        timezone,
        workingHoursStart,
        workingHoursEnd,
        groupId,
      });
      if (result.success) {
        toast.success("Member updated");
        onOpenChange(false);
        onMemberUpdated({
          ...member,
          name: name.trim(),
          title: title.trim(),
          timezone,
          workingHoursStart,
          workingHoursEnd,
          groupId,
        });
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-neutral-900 dark:text-neutral-100">
          Edit Member
        </DialogTitle>
        <DialogDescription>
          Update {member.name}&apos;s profile information.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-name">Name</Label>
          <Input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-title">Title (optional)</Label>
          <Input
            id="edit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Software Engineer"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-timezone">Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="edit-timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {formatTimezoneLabel(tz, true)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {groups.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-group">Group</Label>
            <GroupSelector
              groups={groups}
              value={groupId}
              onValueChange={setGroupId}
              placeholder="No group"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-work-start">Work Starts</Label>
            <Select
              value={String(workingHoursStart)}
              onValueChange={(value) => setWorkingHoursStart(Number(value))}
            >
              <SelectTrigger id="edit-work-start">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour} value={String(hour)}>
                    {formatHour(hour)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-work-end">Work Ends</Label>
            <Select
              value={String(workingHoursEnd)}
              onValueChange={(value) => setWorkingHoursEnd(Number(value))}
            >
              <SelectTrigger id="edit-work-end">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour} value={String(hour)}>
                    {formatHour(hour)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isPending || !name.trim()}>
          {isPending ? (
            <>
              <Spinner className="mr-2" />
              Saving…
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </DialogFooter>
    </>
  );
};

const EditMemberDialog = ({
  member,
  teamId,
  groups,
  open,
  onOpenChange,
  onMemberUpdated,
}: EditMemberDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white dark:bg-neutral-900">
        {open && (
          <EditMemberForm
            key={member.id}
            member={member}
            teamId={teamId}
            groups={groups}
            onOpenChange={onOpenChange}
            onMemberUpdated={onMemberUpdated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export { EditMemberDialog };
