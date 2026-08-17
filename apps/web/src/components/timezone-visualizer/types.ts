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

/**
 * `isEveryTeamRepresented` is orthogonal to `coverage`, not a fourth tier of it.
 * A cross-team hour can also be partial: cross-team wins the colour while the
 * hour still counts as partial in the summary and toward "mixed" status. One
 * enum for both would silently change the counts and the status icon.
 */
type HourOverlap = {
  availableCount: number;
  coverage: "none" | "partial" | "full";
  isEveryTeamRepresented: boolean;
};

type OverlapData = {
  hours: ReadonlyArray<HourOverlap>;
};

export type { GroupedSection, HourOverlap, MemberRow, OverlapData, OverlapStatus, Selection };
