"use client";

import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

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

export { MEMBER_FIELDS, useMemberForm, withFieldGroup };
