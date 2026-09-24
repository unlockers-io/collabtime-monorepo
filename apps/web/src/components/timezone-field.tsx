"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { isCommonTimezone } from "@/lib/timezones";

import type { Timezone } from "./timezone-field-options";
import { getTimezoneOption, matchesTimezoneQuery, TIMEZONE_ITEMS } from "./timezone-field-options";

type TimezoneFieldProps = {
  errors: Array<unknown>;
  id: string;
  isInvalid: boolean;
  onBlur: () => void;
  onChange: (timezone: Timezone) => void;
  value: string;
};

const EDIT_KEYS: ReadonlySet<string> = new Set(["Backspace", "Delete"]);

const getLabel = (timezone: Timezone) => getTimezoneOption(timezone).label;

const TimezoneField = ({ errors, id, isInvalid, onBlur, onChange, value }: TimezoneFieldProps) => {
  const errorId = `${id}-error`;
  const selected = isCommonTimezone(value) ? value : null;
  const selectedLabel = selected === null ? null : getLabel(selected);
  // Controlled so leaving the field shows the chosen zone again, not a half-typed search.
  const [inputValue, setInputValue] = useState(selectedLabel ?? "");

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={id}>Timezone</FieldLabel>
      <Combobox.Root
        autoHighlight
        filter={matchesTimezoneQuery}
        inputValue={inputValue}
        items={TIMEZONE_ITEMS}
        itemToStringLabel={getLabel}
        onInputValueChange={setInputValue}
        onValueChange={(next) => {
          // Clearing the text is a search in progress, not a choice: keep the last timezone.
          if (next === null) {
            return;
          }
          onChange(next);
          setInputValue(getLabel(next));
          onBlur();
        }}
        value={selected}
      >
        <Combobox.InputGroup className="relative w-full">
          <Combobox.Input
            aria-describedby={isInvalid ? errorId : undefined}
            aria-invalid={isInvalid}
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
            id={id}
            onBlur={() => {
              setInputValue(selectedLabel ?? "");
              onBlur();
            }}
            onFocus={(event) => {
              event.currentTarget.select();
            }}
            onKeyDown={(event) => {
              // Typing over the chosen timezone starts a new search instead of appending to it.
              const input = event.currentTarget;
              const edits = event.key.length === 1 || EDIT_KEYS.has(event.key);
              const modified = event.metaKey || event.ctrlKey || event.altKey;
              if (edits && !modified && selectedLabel !== null && input.value === selectedLabel) {
                input.select();
              }
            }}
            placeholder="Search a city or UTC offset"
          />
          <Combobox.Trigger
            aria-label="Show timezones"
            className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground outline-none"
            tabIndex={-1}
          >
            <ChevronDownIcon className="pointer-events-none size-4" />
          </Combobox.Trigger>
        </Combobox.InputGroup>

        <Combobox.Portal>
          <Combobox.Positioner className="isolate z-50" sideOffset={4}>
            <Combobox.Popup className="flex max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 motion-safe:data-open:animate-in motion-safe:data-open:fade-in-0 motion-safe:data-closed:animate-out motion-safe:data-closed:fade-out-0">
              <Combobox.Empty>
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  No timezone matches. Try a city or an offset like UTC+5:30.
                </p>
              </Combobox.Empty>
              <Combobox.List className="max-h-72 min-h-0 scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0">
                {(timezone: Timezone) => {
                  const option = getTimezoneOption(timezone);
                  return (
                    <Combobox.Item
                      className="relative flex w-full cursor-default items-center gap-3 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                      key={timezone}
                      value={timezone}
                    >
                      <span className="min-w-0 flex-1 truncate">{option.city}</span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {option.offset}
                      </span>
                      <Combobox.ItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                        <CheckIcon className="size-4" />
                      </Combobox.ItemIndicator>
                    </Combobox.Item>
                  );
                }}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      {isInvalid && <FormFieldError errors={errors} id={errorId} />}
    </Field>
  );
};

export { TimezoneField };
