"use client";

import { FieldSeparator } from "@repo/ui/components/field";
import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

import type { MemberFormValues } from "@/lib/member-input";
import type { TeamGroup } from "@/types";

import { HourSelectField } from "./hour-select-field";
import { MemberGroupField } from "./member-group-field";
import { MemberTextField } from "./member-text-field";
import { TimezoneField } from "./timezone-field";
import { WorkingHoursFieldset } from "./working-hours-fieldset";

type BindableField<TValue> = {
  handleBlur: () => void;
  handleChange: (value: TValue) => void;
  state: {
    meta: { errors: Array<unknown>; isTouched: boolean; isValid: boolean };
    value: TValue;
  };
};

const bindField = <TValue,>(field: BindableField<TValue>) => ({
  errors: field.state.meta.errors,
  isInvalid: field.state.meta.isTouched && !field.state.meta.isValid,
  onBlur: field.handleBlur,
  onChange: field.handleChange,
  value: field.state.value,
});

const { fieldContext, formContext } = createFormHookContexts();

const { useAppForm: useMemberForm, withFieldGroup } = createFormHook({
  fieldComponents: {},
  fieldContext,
  formComponents: {},
  formContext,
});

const MEMBER_FIELDS = {
  groupId: "groupId",
  name: "name",
  timezone: "timezone",
  title: "title",
  workingHoursEnd: "workingHoursEnd",
  workingHoursStart: "workingHoursStart",
} as const;

type MemberFieldsProps = {
  groups: Array<TeamGroup>;
  idPrefix: string;
};

const MemberFields = withFieldGroup<MemberFormValues, unknown, MemberFieldsProps>({
  render: ({ group, groups, idPrefix }) => (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <group.Field name="name">
          {(field) => (
            <MemberTextField
              {...bindField(field)}
              id={`${idPrefix}-name`}
              label="Full name"
              placeholder="Jane Doe"
              required
            />
          )}
        </group.Field>

        <group.Field name="title">
          {(field) => (
            <MemberTextField
              {...bindField(field)}
              id={`${idPrefix}-title`}
              label="Title (optional)"
              placeholder="e.g. Product designer"
            />
          )}
        </group.Field>
      </div>

      <FieldSeparator />

      <group.Field name="timezone">
        {(field) => <TimezoneField {...bindField(field)} id={`${idPrefix}-timezone`} />}
      </group.Field>

      <group.Subscribe selector={(state) => state.values.timezone}>
        {(timezone) => (
          <WorkingHoursFieldset timezone={timezone}>
            <group.Field name="workingHoursStart">
              {(field) => (
                <HourSelectField
                  {...bindField(field)}
                  id={`${idPrefix}-work-start`}
                  label="Starts"
                />
              )}
            </group.Field>

            <group.Field name="workingHoursEnd">
              {(field) => (
                <HourSelectField {...bindField(field)} id={`${idPrefix}-work-end`} label="Ends" />
              )}
            </group.Field>
          </WorkingHoursFieldset>
        )}
      </group.Subscribe>

      {groups.length > 0 && (
        <>
          <FieldSeparator />
          <group.Field name="groupId">
            {(field) => (
              <MemberGroupField
                {...bindField(field)}
                groups={groups}
                id={`${idPrefix}-group`}
                label="Group (optional)"
              />
            )}
          </group.Field>
        </>
      )}
    </>
  ),
});

export { bindField, MEMBER_FIELDS, MemberFields, useMemberForm };
