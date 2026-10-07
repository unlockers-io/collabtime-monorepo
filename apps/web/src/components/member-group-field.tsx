"use client";

import { Field, FieldLabel } from "@repo/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";

import { NO_GROUP } from "@/lib/member-input";
import type { TeamGroup } from "@/types";

type MemberGroupFieldProps = {
  errors: Array<unknown>;
  groups: Array<TeamGroup>;
  id: string;
  isInvalid: boolean;
  label: string;
  onBlur: () => void;
  onChange: (groupId: string) => void;
  value: string;
};

// Base UI renders an empty value as the placeholder, so "No group" needs a real item value.
const NO_GROUP_ITEM = "__no_group__";

const MemberGroupField = ({
  errors,
  groups,
  id,
  isInvalid,
  label,
  onBlur,
  onChange,
  value,
}: MemberGroupFieldProps) => {
  const errorId = `${id}-error`;
  const selectedName =
    value === NO_GROUP ? "No group" : groups.find((group) => group.id === value)?.name;

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        onValueChange={(item) => {
          if (item === null) {
            return;
          }
          onChange(item === NO_GROUP_ITEM ? NO_GROUP : item);
          onBlur();
        }}
        value={value === NO_GROUP ? NO_GROUP_ITEM : value}
      >
        <SelectTrigger
          aria-describedby={isInvalid ? errorId : undefined}
          aria-invalid={isInvalid}
          id={id}
        >
          <SelectValue placeholder="No group">{selectedName}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_GROUP_ITEM}>No group</SelectItem>
          {groups.map((group) => (
            <SelectItem key={group.id} value={group.id}>
              {group.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isInvalid && <FormFieldError errors={errors} id={errorId} />}
    </Field>
  );
};

export { MemberGroupField };
