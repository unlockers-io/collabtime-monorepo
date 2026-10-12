"use client";

import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

type BindableField<TValue> = {
  handleBlur: () => void;
  handleChange: (value: TValue) => void;
  state: {
    meta: { errors: Array<unknown>; isTouched: boolean; isValid: boolean };
    value: TValue;
  };
};

const bindField = <TValue>(field: BindableField<TValue>) => ({
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

export { bindField, MEMBER_FIELDS, useMemberForm, withFieldGroup };
