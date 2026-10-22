import type { TeamGroup, TeamMember, TeamRecord } from "@/types";

import { MAX_GROUPS_PER_TEAM, MAX_MEMBERS_PER_TEAM } from "./limits";
import {
  DEFAULT_MEMBER_TIMEZONE,
  DEFAULT_WORKING_HOURS_END,
  DEFAULT_WORKING_HOURS_START,
} from "./timezones";

type TeamCommandContext = { createId: () => string };

type Rejection = { error: string; ok: false };

type TeamCommandOutcome<TValue> = Rejection | { ok: true; team: TeamRecord; value: TValue };

type TeamCommand<TValue> = (
  team: TeamRecord,
  context: TeamCommandContext,
) => TeamCommandOutcome<TValue>;

type MemberInput = Omit<TeamMember, "id" | "order" | "userId">;

type MemberUpdate = Partial<MemberInput>;

type SlotClaim = { memberId?: string; name: string; userId: string };

type ClaimedSlot = { created: boolean; memberId: string };

const GROUP_NOT_FOUND = "Group not found";
const MEMBER_NOT_FOUND = "Member not found";

const reject = (error: string): Rejection => ({ error, ok: false });

const newTeamMember = (id: string, overrides: Partial<TeamMember> = {}): TeamMember => ({
  id,
  name: "",
  order: 0,
  timezone: DEFAULT_MEMBER_TIMEZONE,
  title: "",
  workingHoursEnd: DEFAULT_WORKING_HOURS_END,
  workingHoursStart: DEFAULT_WORKING_HOURS_START,
  ...overrides,
});

const isClaimed = (member: TeamMember): boolean =>
  member.userId !== undefined && member.userId !== "";

const isGroupReference = (team: TeamRecord, groupId: string | undefined): boolean =>
  groupId === undefined || team.groups.some((group) => group.id === groupId);

const findMember = (team: TeamRecord, memberId: string): TeamMember | undefined =>
  team.members.find((member) => member.id === memberId);

const ownedSlot = (team: TeamRecord, userId: string): TeamMember | undefined =>
  team.members.find((member) => member.userId === userId);

const withMember = (team: TeamRecord, member: TeamMember): TeamRecord => ({
  ...team,
  members: team.members.map((current) => (current.id === member.id ? member : current)),
});

const reorderById = <TItem extends { id: string; order: number }>(
  items: Array<TItem>,
  ids: Array<string>,
): Array<TItem> | null => {
  const byId = new Map(items.map((item) => [item.id, item]));

  if (ids.length !== byId.size || new Set(ids).size !== ids.length) {
    return null;
  }

  const reordered = ids.flatMap((id, order) => {
    const item = byId.get(id);

    return item ? [{ ...item, order }] : [];
  });

  return reordered.length === ids.length ? reordered : null;
};

const appendMembers = (
  team: TeamRecord,
  added: Array<TeamMember>,
): TeamCommandOutcome<Array<TeamMember>> => {
  if (team.members.length + added.length > MAX_MEMBERS_PER_TEAM) {
    return reject(`A workspace can have up to ${MAX_MEMBERS_PER_TEAM} members`);
  }

  if (!added.every((member) => isGroupReference(team, member.groupId))) {
    return reject(GROUP_NOT_FOUND);
  }

  return { ok: true, team: { ...team, members: [...team.members, ...added] }, value: added };
};

const addMember =
  (input: MemberInput): TeamCommand<TeamMember> =>
  (team, { createId }) => {
    const member: TeamMember = { ...input, id: createId(), order: team.members.length };
    const outcome = appendMembers(team, [member]);

    return outcome.ok ? { ...outcome, value: member } : outcome;
  };

const importMembers =
  (inputs: Array<MemberInput>): TeamCommand<Array<TeamMember>> =>
  (team, { createId }) =>
    appendMembers(
      team,
      inputs.map((input, index) => ({
        ...input,
        id: createId(),
        order: team.members.length + index,
      })),
    );

const updateMember =
  (memberId: string, updates: MemberUpdate): TeamCommand<TeamMember> =>
  (team) => {
    const member = findMember(team, memberId);

    if (member === undefined) {
      return reject(MEMBER_NOT_FOUND);
    }

    if (!isGroupReference(team, updates.groupId)) {
      return reject(GROUP_NOT_FOUND);
    }

    const updated = { ...member, ...updates };

    return { ok: true, team: withMember(team, updated), value: updated };
  };

const updateOwnMember =
  (
    memberId: string,
    userId: string,
    updates: Omit<MemberUpdate, "groupId">,
  ): TeamCommand<TeamMember> =>
  (team) => {
    const member = findMember(team, memberId);

    if (member === undefined) {
      return reject(MEMBER_NOT_FOUND);
    }

    if (member.userId !== userId && isClaimed(member)) {
      return reject("You can only edit your own member record");
    }

    if (member.userId !== userId && ownedSlot(team, userId) !== undefined) {
      return reject("You already have a profile on this team");
    }

    const updated = { ...member, ...updates, userId };

    return { ok: true, team: withMember(team, updated), value: updated };
  };

const removeMember =
  (memberId: string): TeamCommand<TeamMember> =>
  (team) => {
    const member = findMember(team, memberId);

    if (member === undefined) {
      return reject(MEMBER_NOT_FOUND);
    }

    const members = team.members.filter((current) => current.id !== memberId);

    return { ok: true, team: { ...team, members }, value: member };
  };

const reorderMembers =
  (memberIds: Array<string>): TeamCommand<void> =>
  (team) => {
    const members = reorderById(team.members, memberIds);

    return members === null
      ? reject("Invalid member order")
      : { ok: true, team: { ...team, members }, value: undefined };
  };

const claimMemberSlot =
  (claim: SlotClaim): TeamCommand<ClaimedSlot> =>
  (team, { createId }) => {
    const owned = ownedSlot(team, claim.userId);

    if (owned) {
      return {
        ok: true,
        team,
        value: { created: false, memberId: owned.id },
      };
    }

    const target = claim.memberId === undefined ? undefined : findMember(team, claim.memberId);

    if (target && !isClaimed(target)) {
      const claimed = { ...target, userId: claim.userId };

      return {
        ok: true,
        team: withMember(team, claimed),
        value: { created: false, memberId: target.id },
      };
    }

    const member = newTeamMember(createId(), {
      name: claim.name,
      order: team.members.length,
      userId: claim.userId,
    });

    const outcome = appendMembers(team, [member]);

    return outcome.ok ? { ...outcome, value: { created: true, memberId: member.id } } : outcome;
  };

const addGroup =
  (name: string): TeamCommand<TeamGroup> =>
  (team, { createId }) => {
    if (team.groups.length >= MAX_GROUPS_PER_TEAM) {
      return reject(`A workspace can have up to ${MAX_GROUPS_PER_TEAM} groups`);
    }

    const group: TeamGroup = { id: createId(), name, order: team.groups.length };

    return { ok: true, team: { ...team, groups: [...team.groups, group] }, value: group };
  };

const updateGroup =
  (groupId: string, updates: Partial<Pick<TeamGroup, "name">>): TeamCommand<TeamGroup> =>
  (team) => {
    const group = team.groups.find((current) => current.id === groupId);

    if (group === undefined) {
      return reject(GROUP_NOT_FOUND);
    }

    const updated = { ...group, ...updates };
    const groups = team.groups.map((current) => (current.id === groupId ? updated : current));

    return { ok: true, team: { ...team, groups }, value: updated };
  };

const removeGroup =
  (groupId: string): TeamCommand<void> =>
  (team) => {
    if (!team.groups.some((group) => group.id === groupId)) {
      return reject(GROUP_NOT_FOUND);
    }

    const groups: Array<TeamGroup> = [];

    for (const group of team.groups) {
      if (group.id !== groupId) {
        groups.push({ ...group, order: groups.length });
      }
    }

    const members = team.members.map((member) =>
      member.groupId === groupId ? { ...member, groupId: undefined } : member,
    );

    return { ok: true, team: { ...team, groups, members }, value: undefined };
  };

const reorderGroups =
  (groupIds: Array<string>): TeamCommand<void> =>
  (team) => {
    const groups = reorderById(team.groups, groupIds);

    return groups === null
      ? reject("Invalid group order")
      : { ok: true, team: { ...team, groups }, value: undefined };
  };

const renameTeam =
  (name: string): TeamCommand<void> =>
  (team) => ({ ok: true, team: { ...team, name }, value: undefined });

const teamCommands = {
  addGroup,
  addMember,
  claimMemberSlot,
  importMembers,
  removeGroup,
  removeMember,
  renameTeam,
  reorderGroups,
  reorderMembers,
  updateGroup,
  updateMember,
  updateOwnMember,
};

export { newTeamMember, teamCommands };

export type { SlotClaim, TeamCommand };
