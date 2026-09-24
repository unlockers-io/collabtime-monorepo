"use client";

import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import type { ReactNode } from "react";

import { isCommonTimezone } from "@/lib/timezones";
import type { TeamGroup } from "@/types";

import { GroupSelector } from "./group-selector";
import { getTimezoneOption } from "./timezone-field-options";

const TITLE_PLACEHOLDER = "e.g. Product designer";

type MemberTextFieldProps = {
  autoComplete?: string;
  description?: string;
  errors: Array<unknown>;
  id: string;
  isInvalid: boolean;
  label: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "email" | "text";
  value: string;
};

const MemberTextField = ({
  autoComplete,
  description,
  errors,
  id,
  isInvalid,
  label,
  onBlur,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: MemberTextFieldProps) => {
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = [
    description === undefined ? null : descriptionId,
    isInvalid ? errorId : null,
  ].filter(Boolean);

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        aria-describedby={describedBy.length > 0 ? describedBy.join(" ") : undefined}
        aria-invalid={isInvalid}
        autoComplete={autoComplete}
        id={id}
        inputMode={type === "email" ? "email" : undefined}
        onBlur={onBlur}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
      {description !== undefined && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {isInvalid && <FormFieldError errors={errors} id={errorId} />}
    </Field>
  );
};

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

type WorkingHoursFieldsetProps = {
  children: ReactNode;
  timezone: string;
};

// Hours are stored in the member's own zone, so name that zone next to the pickers.
const WorkingHoursFieldset = ({ children, timezone }: WorkingHoursFieldsetProps) => {
  const city = isCommonTimezone(timezone) ? getTimezoneOption(timezone).city : null;

  return (
    <FieldSet>
      <FieldLegend variant="label">Working hours</FieldLegend>
      <FieldDescription>
        {city === null ? "In the member's timezone." : `In the member's timezone (${city}).`}
      </FieldDescription>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </FieldSet>
  );
};

export { MemberGroupField, MemberTextField, TITLE_PLACEHOLDER, WorkingHoursFieldset };
