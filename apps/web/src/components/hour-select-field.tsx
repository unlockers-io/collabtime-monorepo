"use client";

import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { formatHour } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

type HourSelectFieldProps = {
  errorId?: string;
  errors?: Array<unknown>;
  id: string;
  isInvalid?: boolean;
  label: string;
  onBlur: () => void;
  onChange: (hour: number) => void;
  value: number;
};

const HourSelectField = ({
  errorId,
  errors,
  id,
  isInvalid,
  label,
  onBlur,
  onChange,
  value,
}: HourSelectFieldProps) => {
  const invalid = isInvalid === true;

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        onValueChange={(v) => {
          // A null value would coerce to hour 0, so a cleared select stays put.
          if (v !== null) {
            onChange(Number(v));
            onBlur();
          }
        }}
        value={String(value)}
      >
        <SelectTrigger
          aria-describedby={invalid ? errorId : undefined}
          aria-invalid={isInvalid}
          id={id}
        >
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
      {invalid && errors !== undefined && <FieldError errors={errors} id={errorId} />}
    </Field>
  );
};

export { HourSelectField };
