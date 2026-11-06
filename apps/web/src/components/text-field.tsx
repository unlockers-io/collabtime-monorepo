"use client";

import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import type { ReactNode } from "react";

type TextFieldProps = {
  autoComplete?: string;
  description?: ReactNode;
  disabled?: boolean;
  errors: Array<unknown>;
  id: string;
  isInvalid: boolean;
  label: string;
  labelAside?: ReactNode;
  onBlur: () => void;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  /** Taller on touch screens, for full-page forms. */
  touch?: boolean;
  type?: "email" | "password" | "text";
  value: string;
};

const hintIds = (id: string, hasDescription: boolean, isInvalid: boolean) => {
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  const present = [hasDescription ? descriptionId : null, isInvalid ? errorId : null].filter(
    (value) => value !== null,
  );

  return {
    describedBy: present.length > 0 ? present.join(" ") : undefined,
    descriptionId,
    errorId,
  };
};

type TextFieldHintsProps = Pick<TextFieldProps, "description" | "errors" | "isInvalid"> & {
  descriptionId: string;
  errorId: string;
};

const TextFieldHints = ({
  description,
  descriptionId,
  errorId,
  errors,
  isInvalid,
}: TextFieldHintsProps) => (
  <>
    {description !== undefined && (
      <FieldDescription id={descriptionId}>{description}</FieldDescription>
    )}
    {isInvalid && <FormFieldError errors={errors} id={errorId} />}
  </>
);

const TextFieldLabel = ({ aside, id, label }: { aside: ReactNode; id: string; label: string }) => {
  const fieldLabel = <FieldLabel htmlFor={id}>{label}</FieldLabel>;

  if (aside === undefined) {
    return fieldLabel;
  }

  return (
    <div className="flex items-baseline justify-between gap-3">
      {fieldLabel}
      {aside}
    </div>
  );
};

const TextField = ({
  autoComplete,
  description,
  disabled,
  errors,
  id,
  isInvalid,
  label,
  labelAside,
  onBlur,
  onChange,
  placeholder,
  required,
  touch = false,
  type = "text",
  value,
}: TextFieldProps) => {
  const { describedBy, descriptionId, errorId } = hintIds(id, description !== undefined, isInvalid);

  return (
    <Field data-invalid={isInvalid || undefined}>
      <TextFieldLabel aside={labelAside} id={id} label={label} />
      <Input
        aria-describedby={describedBy}
        aria-invalid={isInvalid}
        aria-required={required}
        autoComplete={autoComplete}
        className={touch ? "h-11 sm:h-10" : undefined}
        disabled={disabled}
        id={id}
        inputMode={type === "email" ? "email" : undefined}
        onBlur={onBlur}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      <TextFieldHints
        description={description}
        descriptionId={descriptionId}
        errorId={errorId}
        errors={errors}
        isInvalid={isInvalid}
      />
    </Field>
  );
};

export { TextField };
