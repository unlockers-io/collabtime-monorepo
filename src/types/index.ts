type TeamMember = {
  id: string;
  name: string;
  title: string;
  timezone: string;
  workingHoursStart: number; // 0-23 in their local timezone
  workingHoursEnd: number; // 0-23 in their local timezone
};

type Team = {
  id: string;
  name: string;
  createdAt: string;
  members: TeamMember[];
};

export type { Team, TeamMember };
