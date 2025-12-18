type TeamGroup = {
  id: string;
  name: string;
  order: number;
};

type TeamMember = {
  id: string;
  name: string;
  title: string;
  timezone: string;
  workingHoursStart: number; // 0-23 in their local timezone
  workingHoursEnd: number; // 0-23 in their local timezone
  groupId?: string; // Optional: undefined = ungrouped
};

type Team = {
  id: string;
  name: string;
  createdAt: string;
  members: TeamMember[];
  groups: TeamGroup[];
};

type FlexDirection = "early" | "late";

type FlexMember = {
  member: TeamMember;
  direction: FlexDirection;
  hours: number; // How many hours they need to flex (1 or 2)
};

type MeetingQuality = "excellent" | "good" | "fair" | "poor";

type MeetingSlot = {
  id: string;
  startHour: number; // 0-23 in viewer timezone
  endHour: number; // 0-23 in viewer timezone
  duration: number; // hours
  score: number; // 0-100
  quality: MeetingQuality;
  availableMembers: TeamMember[];
  flexingMembers: FlexMember[];
  unavailableMembers: TeamMember[];
};

type MeetingFinderOptions = {
  participants: TeamMember[];
  viewerTimezone: string;
  minDuration?: number;
  maxDuration?: number;
  allowFlexHours?: boolean;
  flexRange?: number;
};

type MeetingFinderResult = {
  hasResults: boolean;
  slots: MeetingSlot[];
  suggestion?: string;
};

export type {
  Team,
  TeamGroup,
  TeamMember,
  FlexDirection,
  FlexMember,
  MeetingQuality,
  MeetingSlot,
  MeetingFinderOptions,
  MeetingFinderResult,
};
