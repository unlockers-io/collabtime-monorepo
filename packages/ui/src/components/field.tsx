import * as React from "react";

import { cn } from "../lib/utils";

import { Label } from "./label";

type FieldProps = React.HTMLAttributes<HTMLDivElement> & {
  "data-invalid"?: boolean;
  orientation?: "vertical" | "horizontal" | "responsive";
  ref?: React.Ref<HTMLDivElement>;
};

const Field = ({ className, orientation = "vertical", ref, ...props }: FieldProps) => {
  return (
    <div
      ref={ref}
      data-slot="field"
      role="group"
      data-orientation={orientation}
      className={cn(
        "group/field flex w-full gap-3 [&>*]:w-full [&>.sr-only]:w-auto",
        "data-[invalid=true]:text-destructive",
        orientation === "vertical" && "flex-col",
        orientation === "horizontal" &&
          "flex-row items-center has-[>[data-slot=field-content]]:items-start [&>[data-slot=field-label]]:flex-auto",
        orientation === "responsive" && "flex-col sm:flex-row sm:items-center",
        className,
      )}
      {...props}
    />
  );
};

const FieldGroup = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) => (
  <div
    ref={ref}
    data-slot="field-group"
    className={cn(
      "group/field-group flex w-full flex-col gap-7 [&>[data-slot=field-group]]:gap-4",
      className,
    )}
    {...props}
  />
);

const FieldLabel = ({ className, ...props }: React.ComponentProps<typeof Label>) => {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "group/field-label flex w-fit items-center gap-2 text-sm leading-snug font-medium text-foreground",
        "group-data-[invalid=true]/field:text-destructive",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        className,
      )}
      {...props}
    />
  );
};

const FieldContent = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) => (
  <div
    ref={ref}
    data-slot="field-content"
    className={cn("flex flex-col gap-2", className)}
    {...props}
  />
);

const FieldDescription = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { ref?: React.Ref<HTMLParagraphElement> }) => {
  return (
    <p
      ref={ref}
      data-slot="field-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
};

type FieldErrorProps = React.HTMLAttributes<HTMLParagraphElement> & {
  errors?: Array<unknown>;
  ref?: React.Ref<HTMLParagraphElement>;
};

const FieldError = ({ className, errors, children, ref, ...props }: FieldErrorProps) => {
  const message =
    children ??
    errors
      ?.filter(Boolean)
      .map((e) =>
        typeof e === "string"
          ? e
          : typeof e === "object" && e !== null && "message" in e
            ? (e as { message: string }).message
            : String(e),
      )
      .filter(Boolean)
      .at(0);

  if (!message) {
    return null;
  }

  return (
    <p
      ref={ref}
      data-slot="field-error"
      className={cn("text-xs font-medium text-destructive", className)}
      {...props}
    >
      {message}
    </p>
  );
};

const FieldSet = ({
  className,
  ref,
  ...props
}: React.FieldsetHTMLAttributes<HTMLFieldSetElement> & {
  ref?: React.Ref<HTMLFieldSetElement>;
}) => (
  <fieldset
    ref={ref}
    data-slot="field-set"
    className={cn("flex flex-col gap-4", className)}
    {...props}
  />
);

const FieldLegend = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLLegendElement> & { ref?: React.Ref<HTMLLegendElement> }) => (
  <legend
    ref={ref}
    data-slot="field-legend"
    className={cn("text-sm font-semibold text-foreground", className)}
    {...props}
  />
);

const FieldTitle = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { ref?: React.Ref<HTMLParagraphElement> }) => (
  <p
    ref={ref}
    data-slot="field-title"
    className={cn("text-sm font-medium text-foreground", className)}
    {...props}
  />
);

const FieldSeparator = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLHRElement> & { ref?: React.Ref<HTMLHRElement> }) => (
  <hr ref={ref} data-slot="field-separator" className={cn("border-border", className)} {...props} />
);

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
