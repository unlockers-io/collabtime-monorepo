"use client";

import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";

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

export { MemberTextField, TITLE_PLACEHOLDER };
