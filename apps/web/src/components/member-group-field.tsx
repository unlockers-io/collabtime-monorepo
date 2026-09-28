"use client";

import { Field, FieldLabel } from "@repo/ui/components/field";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";

import type { TeamGroup } from "@/types";

import { GroupSelector } from "./group-selector";

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

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <GroupSelector
        aria-describedby={isInvalid ? errorId : undefined}
        aria-invalid={isInvalid}
        groups={groups}
        id={id}
        onValueChange={(groupId) => {
          onChange(groupId ?? "");
          onBlur();
        }}
        placeholder="No group"
        value={value || undefined}
      />
      {isInvalid && <FormFieldError errors={errors} id={errorId} />}
    </Field>
  );
};

export { MemberGroupField };
