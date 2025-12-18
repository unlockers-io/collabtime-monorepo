"use client";

import * as React from "react";
import type { TeamGroup } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type GroupSelectorProps = {
  groups: TeamGroup[];
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
  placeholder?: string;
} & Omit<React.ComponentPropsWithoutRef<typeof SelectTrigger>, "children">;

const NO_GROUP_VALUE = "__no_group__";

const GroupSelector = ({
  groups,
  value,
  onValueChange,
  placeholder = "Select group",
  ...triggerProps
}: GroupSelectorProps) => {
  const handleChange = (newValue: string) => {
    onValueChange(newValue === NO_GROUP_VALUE ? undefined : newValue);
  };

  return (
    <Select value={value ?? NO_GROUP_VALUE} onValueChange={handleChange}>
      <SelectTrigger {...triggerProps}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_GROUP_VALUE}>No group</SelectItem>
        {groups.map((group) => (
          <SelectItem key={group.id} value={group.id}>
            {group.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export { GroupSelector };
