import { z } from "zod";

import type { TeamMember, TeamRole } from "@/types";

import { MAX_IMPORT_BATCH } from "./limits";
import { type TeamCommand, teamCommands } from "./team-commands";
import {
  TeamGroupInputSchema,
  TeamMemberInputSchema,
  TeamMemberUpdateSchema,
  TeamNameSchema,
} from "./validation";

type Actor = { id: string; name: string };

type TeamChange<TArgs, TInput, TValue, TReply> = {
  command: (args: TArgs, actor: Actor) => TeamCommand<TValue>;
  failure: string;
  preview?: (args: TArgs) => TeamCommand<TValue>;
  reply: (value: TValue) => TReply;
  role: TeamRole;
  schema: z.ZodType<TArgs, TInput>;
};

const defineChange = <TArgs, TInput, TValue, TReply>(
  change: TeamChange<TArgs, TInput, TValue, TReply>,
): TeamChange<TArgs, TInput, TValue, TReply> => change;

const optimistic = <TArgs, TValue>(command: (args: TArgs) => TeamCommand<TValue>) => ({
  command,
  preview: command,
});

const noReply = (): undefined => undefined;

const MemberIdSchema = z.uuid("Invalid member ID");
const GroupIdSchema = z.uuid("Invalid group ID");
const IdListSchema = z.array(z.string());
const MemberUpdateSchema = z.object({ memberId: MemberIdSchema, updates: TeamMemberUpdateSchema });

const definitions = {
  addGroup: defineChange({
    command: ({ name }) => teamCommands.addGroup(name),
    failure: "create group",
    reply: noReply,
    role: "ADMIN",
    schema: TeamGroupInputSchema,
  }),
  addMember: defineChange({
    command: (member) => teamCommands.addMember(member),
    failure: "add member",
    reply: (member: TeamMember) => ({ memberId: member.id }),
    role: "ADMIN",
    schema: TeamMemberInputSchema,
  }),
  claimOwnSlot: defineChange({
    command: (_args, actor) => teamCommands.claimMemberSlot({ name: actor.name, userId: actor.id }),
    failure: "add your profile",
    reply: (slot: { created: boolean; memberId: string }) => slot,
    role: "MEMBER",
    schema: z.object({}),
  }),
  importMembers: defineChange({
    command: ({ members }) => teamCommands.importMembers(members),
    failure: "import members",
    reply: (members: Array<TeamMember>) => ({ imported: members.length }),
    role: "ADMIN",
    schema: z.object({
      members: z
        .array(TeamMemberInputSchema)
        .min(1, "No members to import")
        .max(MAX_IMPORT_BATCH, `Cannot import more than ${MAX_IMPORT_BATCH} members at once`),
    }),
  }),
  removeGroup: defineChange({
    ...optimistic(({ groupId }: { groupId: string }) => teamCommands.removeGroup(groupId)),
    failure: "remove group",
    reply: noReply,
    role: "ADMIN",
    schema: z.object({ groupId: GroupIdSchema }),
  }),
  removeMember: defineChange({
    ...optimistic(({ memberId }: { memberId: string }) => teamCommands.removeMember(memberId)),
    failure: "remove member",
    reply: noReply,
    role: "ADMIN",
    schema: z.object({ memberId: MemberIdSchema }),
  }),
  renameTeam: defineChange({
    ...optimistic(({ name }: { name: string }) => teamCommands.renameTeam(name)),
    failure: "update team name",
    reply: noReply,
    role: "ADMIN",
    schema: z.object({ name: TeamNameSchema }),
  }),
  reorderGroups: defineChange({
    ...optimistic(({ groupIds }: { groupIds: Array<string> }) =>
      teamCommands.reorderGroups(groupIds),
    ),
    failure: "reorder groups",
    reply: noReply,
    role: "ADMIN",
    schema: z.object({ groupIds: IdListSchema }),
  }),
  reorderMembers: defineChange({
    ...optimistic(({ memberIds }: { memberIds: Array<string> }) =>
      teamCommands.reorderMembers(memberIds),
    ),
    failure: "reorder members",
    reply: noReply,
    role: "ADMIN",
    schema: z.object({ memberIds: IdListSchema }),
  }),
  updateGroup: defineChange({
    ...optimistic(({ groupId, name }: { groupId: string; name: string }) =>
      teamCommands.updateGroup(groupId, { name }),
    ),
    failure: "update group",
    reply: noReply,
    role: "ADMIN",
    schema: TeamGroupInputSchema.extend({ groupId: GroupIdSchema }),
  }),
  updateMember: defineChange({
    ...optimistic(({ memberId, updates }: z.output<typeof MemberUpdateSchema>) =>
      teamCommands.updateMember(memberId, updates),
    ),
    failure: "update member",
    reply: noReply,
    role: "ADMIN",
    schema: MemberUpdateSchema,
  }),
  updateOwnMember: defineChange({
    command: ({ memberId, updates }, actor) =>
      teamCommands.updateOwnMember(memberId, actor.id, updates),
    failure: "update own member",
    reply: noReply,
    role: "MEMBER",
    schema: z.object({
      memberId: MemberIdSchema,
      updates: TeamMemberUpdateSchema.omit({ groupId: true }),
    }),
  }),
};

type Definitions = typeof definitions;

type TeamChangeName = keyof Definitions;

type Parts<TChange> =
  TChange extends TeamChange<infer TArgs, infer TInput, infer TValue, infer TReply>
    ? { args: TArgs; input: TInput; reply: TReply; value: TValue }
    : never;

type TeamChangeParts = { [TName in TeamChangeName]: Parts<Definitions[TName]> };

type TeamChangeArgs<TName extends TeamChangeName> = TeamChangeParts[TName]["input"];

type TeamChangeReply<TName extends TeamChangeName> = TeamChangeParts[TName]["reply"];

type TeamChangeTable = {
  [TName in TeamChangeName]: TeamChange<
    TeamChangeParts[TName]["args"],
    TeamChangeParts[TName]["input"],
    TeamChangeParts[TName]["value"],
    TeamChangeParts[TName]["reply"]
  >;
};

const teamChanges: TeamChangeTable = definitions;

const isTeamChangeName = (name: string): name is TeamChangeName => Object.hasOwn(teamChanges, name);

const parseTeamChange = <TName extends TeamChangeName>(
  name: TName,
  args: TeamChangeArgs<TName>,
) => {
  const parsed = teamChanges[name].schema.safeParse(args);

  return parsed.success
    ? { args: parsed.data, ok: true as const }
    : { error: parsed.error.issues[0]?.message ?? "Invalid input", ok: false as const };
};

export { isTeamChangeName, parseTeamChange, teamChanges };

export type { TeamChangeArgs, TeamChangeName, TeamChangeParts, TeamChangeReply };
