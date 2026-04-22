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
      className={cn(
        "group/field flex w-full gap-3 [&>*]:w-full [&>.sr-only]:w-auto",
        "data-[invalid=true]:text-destructive",
        orientation === "vertical" && "flex-col",
        orientation === "horizontal" &&
          "flex-row items-center has-[>[data-slot=field-content]]:items-start [&>[data-slot=field-label]]:flex-auto",
        orientation === "responsive" && "flex-col sm:flex-row sm:items-center",
        className,
      )}
      data-orientation={orientation}
      data-slot="field"
      ref={ref}
      role="group"
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
    className={cn(
      "group/field-group flex w-full flex-col gap-7 [&>[data-slot=field-group]]:gap-4",
      className,
    )}
    data-slot="field-group"
    ref={ref}
    {...props}
  />
);

const FieldLabel = ({ className, ...props }: React.ComponentProps<typeof Label>) => {
  return (
    <Label
      className={cn(
        "group/field-label flex w-fit items-center gap-2 text-sm leading-snug font-medium text-foreground",
        "group-data-[invalid=true]/field:text-destructive",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        className,
      )}
      data-slot="field-label"
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
    className={cn("flex flex-col gap-2", className)}
    data-slot="field-content"
    ref={ref}
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
      className={cn("text-xs text-muted-foreground", className)}
      data-slot="field-description"
      ref={ref}
      {...props}
    />
  );
};

type FieldErrorProps = React.HTMLAttributes<HTMLParagraphElement> & {
  errors?: Array<unknown>;
  ref?: React.Ref<HTMLParagraphElement>;
};

const errorToMessage = (e: unknown): string => {
  if (typeof e === "string") {
    return e;
  }
  if (typeof e === "object" && e !== null && "message" in e) {
    return (e as { message: string }).message;
  }
  return String(e);
};

const FieldError = ({ children, className, errors, ref, ...props }: FieldErrorProps) => {
  const message = children ?? errors?.map(errorToMessage).find(Boolean);

  if (!message) {
    return null;
  }

  return (
    <p
      className={cn("text-xs font-medium text-destructive", className)}
      data-slot="field-error"
      ref={ref}
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
    className={cn("flex flex-col gap-4", className)}
    data-slot="field-set"
    ref={ref}
    {...props}
  />
);

const FieldLegend = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLLegendElement> & { ref?: React.Ref<HTMLLegendElement> }) => (
  <legend
    className={cn("text-sm font-semibold text-foreground", className)}
    data-slot="field-legend"
    ref={ref}
    {...props}
  />
);

const FieldTitle = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { ref?: React.Ref<HTMLParagraphElement> }) => (
  <p
    className={cn("text-sm font-medium text-foreground", className)}
    data-slot="field-title"
    ref={ref}
    {...props}
  />
);

const FieldSeparator = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLHRElement> & { ref?: React.Ref<HTMLHRElement> }) => (
  <hr className={cn("border-border", className)} data-slot="field-separator" ref={ref} {...props} />
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
