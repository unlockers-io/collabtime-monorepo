"use client";

import * as React from "react";
import type { FieldError as ReactHookFormFieldError } from "react-hook-form";
import { cn, Label } from "@repo/ui";

type FieldProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "vertical" | "horizontal" | "responsive";
  "data-invalid"?: boolean;
};

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, orientation = "vertical", ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="field"
        role="group"
        data-orientation={orientation}
        className={cn(
          "group/field flex w-full gap-3 [&>*]:w-full [&>.sr-only]:w-auto",
          "data-[invalid=true]:text-red-600 dark:data-[invalid=true]:text-red-400",
          orientation === "vertical" && "flex-col",
          orientation === "horizontal" &&
            "flex-row items-center [&>[data-slot=field-label]]:flex-auto has-[>[data-slot=field-content]]:items-start",
          orientation === "responsive" && "flex-col sm:flex-row sm:items-center",
          className
        )}
        {...props}
      />
    );
  }
);
Field.displayName = "Field";

const FieldGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="field-group"
      className={cn(
        "group/field-group flex w-full flex-col gap-7 [&>[data-slot=field-group]]:gap-4",
        className
      )}
      {...props}
    />
  )
);
FieldGroup.displayName = "FieldGroup";

const FieldLabel = React.forwardRef<
  React.ElementRef<typeof Label>,
  React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => {
  return (
    <Label
      ref={ref}
      data-slot="field-label"
      className={cn(
        "group/field-label flex w-fit items-center gap-2 text-sm font-medium leading-snug text-neutral-900 dark:text-neutral-100",
        "group-data-[invalid=true]/field:text-red-600 dark:group-data-[invalid=true]/field:text-red-400",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        className
      )}
      {...props}
    />
  );
});
FieldLabel.displayName = "FieldLabel";

const FieldContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="field-content"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
);
FieldContent.displayName = "FieldContent";

const FieldDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      data-slot="field-description"
      className={cn("text-xs text-neutral-500 dark:text-neutral-400", className)}
      {...props}
    />
  );
});
FieldDescription.displayName = "FieldDescription";

type FieldErrorProps = React.HTMLAttributes<HTMLParagraphElement> & {
  errors?: Array<ReactHookFormFieldError | undefined>;
};

const FieldError = React.forwardRef<HTMLParagraphElement, FieldErrorProps>(
  ({ className, errors, children, ...props }, ref) => {
    const message =
      children ??
      errors
        ?.map((e) => e?.message)
        .filter(Boolean)
        .map((m) => String(m))
        .at(0);

    if (!message) return null;

    return (
      <p
        ref={ref}
        data-slot="field-error"
        className={cn("text-xs font-medium text-red-600 dark:text-red-400", className)}
        {...props}
      >
        {message}
      </p>
    );
  }
);
FieldError.displayName = "FieldError";

const FieldSet = React.forwardRef<
  HTMLFieldSetElement,
  React.FieldsetHTMLAttributes<HTMLFieldSetElement>
>(({ className, ...props }, ref) => (
  <fieldset
    ref={ref}
    data-slot="field-set"
    className={cn("flex flex-col gap-4", className)}
    {...props}
  />
));
FieldSet.displayName = "FieldSet";

const FieldLegend = React.forwardRef<
  HTMLLegendElement,
  React.HTMLAttributes<HTMLLegendElement>
>(({ className, ...props }, ref) => (
  <legend
    ref={ref}
    data-slot="field-legend"
    className={cn("text-sm font-semibold text-neutral-900 dark:text-neutral-100", className)}
    {...props}
  />
));
FieldLegend.displayName = "FieldLegend";

const FieldTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      data-slot="field-title"
      className={cn("text-sm font-medium text-neutral-900 dark:text-neutral-100", className)}
      {...props}
    />
  )
);
FieldTitle.displayName = "FieldTitle";

const FieldSeparator = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => (
    <hr
      ref={ref}
      data-slot="field-separator"
      className={cn("border-neutral-200 dark:border-neutral-800", className)}
      {...props}
    />
  )
);
FieldSeparator.displayName = "FieldSeparator";

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
};
