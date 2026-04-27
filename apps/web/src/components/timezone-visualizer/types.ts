import type { TeamGroup, TeamMember } from "@/types";

type MemberRow = {
  dayOffset: number;
  hours: Array<boolean>;
  member: TeamMember;
};

type GroupedSection = {
  group: TeamGroup | null;
  rows: Array<MemberRow>;
};

type Selection = {
  id: string;
  type: "member" | "group";
};

type OverlapStatus = "none" | "partial" | "full" | "mixed";

type OverlapData = {
  crossTeamOverlapHours: Array<boolean>;
  overlapCounts: Array<number>;
  overlapHours: Array<boolean>;
  partialOverlapHours: Array<boolean>;
};

export type { GroupedSection, MemberRow, OverlapData, OverlapStatus, Selection };
