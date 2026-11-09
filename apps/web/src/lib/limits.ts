export const MAX_MEMBERS_PER_TEAM = 200;
export const MAX_GROUPS_PER_TEAM = 50;
export const MAX_TEAMS_PER_USER = 50;
export const MAX_IMPORT_BATCH = 100;

export const INVITATION_TTL_DAYS = 14;
export const INVITES_PER_USER_PER_HOUR = 50;
export const INVITES_PER_TEAM_PER_DAY = 200;
export const TEAM_NAME_MAX_LENGTH = 100;
export const MEMBER_NAME_MAX_LENGTH = 100;
export const MEMBER_TITLE_MAX_LENGTH = 100;
export const GROUP_NAME_MAX_LENGTH = 50;
export const SPACE_PASSWORD_LENGTH = { max: 128, min: 8 } as const;

export const upToCharacters = (max: number): string => `Up to ${max} characters.`;
