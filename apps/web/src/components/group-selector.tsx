"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import React from "react";

import type { TeamGroup } from "@/types";

type GroupSelectorProps = {
  groups: Array<TeamGroup>;
  onValueChange: (value: string | undefined) => void;
  placeholder?: string;
  value: string | undefined;
} & Omit<React.ComponentPropsWithoutRef<typeof SelectTrigger>, "children">;

const NO_GROUP_VALUE = "__no_group__";

const GroupSelector = ({
  groups,
  onValueChange,
  placeholder = "Select group",
  value,
  ...triggerProps
}: GroupSelectorProps) => {
  const handleChange = (newValue: string | null) => {
    if (newValue === null) {
      return;
    }
    onValueChange(newValue === NO_GROUP_VALUE ? undefined : newValue);
  };

  const displayLabel = value ? groups.find((g) => g.id === value)?.name : "No group";

  return (
    <Select onValueChange={handleChange} value={value ?? NO_GROUP_VALUE}>
      <SelectTrigger {...triggerProps}>
        <SelectValue placeholder={placeholder}>{displayLabel}</SelectValue>
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
