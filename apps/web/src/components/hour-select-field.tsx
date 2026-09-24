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

import { formatHour } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

type HourSelectFieldProps = {
  errors?: Array<unknown>;
  id: string;
  isInvalid?: boolean;
  label: string;
  onBlur: () => void;
  onChange: (hour: number) => void;
  value: number;
};

const HourSelectField = ({
  errors,
  id,
  isInvalid,
  label,
  onBlur,
  onChange,
  value,
}: HourSelectFieldProps) => {
  const invalid = isInvalid === true;
  const errorId = `${id}-error`;

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        onValueChange={(v) => {
          if (v !== null) {
            onChange(Number(v));
            onBlur();
          }
        }}
        value={String(value)}
      >
        <SelectTrigger
          aria-describedby={invalid ? errorId : undefined}
          aria-invalid={invalid}
          id={id}
        >
          <SelectValue>
            <span className="font-mono tabular-nums">{formatHour(value)}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((hour) => (
            <SelectItem key={hour} value={String(hour)}>
              <span className="font-mono tabular-nums">{formatHour(hour)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {invalid && errors !== undefined && <FormFieldError errors={errors} id={errorId} />}
    </Field>
  );
};

export { HourSelectField };
