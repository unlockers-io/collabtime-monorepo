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

type HourOverlap = {
  availableCount: number;
  coverage: "none" | "partial" | "full";
  isEveryTeamRepresented: boolean;
};

type OverlapData = {
  hours: ReadonlyArray<HourOverlap>;
};

export type { GroupedSection, HourOverlap, MemberRow, OverlapData, OverlapStatus, Selection };
