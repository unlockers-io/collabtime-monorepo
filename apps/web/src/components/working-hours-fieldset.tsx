"use client";

import { FieldDescription, FieldLegend, FieldSet } from "@repo/ui/components/field";
import type { ReactNode } from "react";

import { isCommonTimezone } from "@/lib/timezones";

import { getTimezoneOption } from "./timezone-field-options";

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

export { WorkingHoursFieldset };
