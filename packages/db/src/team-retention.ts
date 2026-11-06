/** New team contents live this long; any read or write extends them to the active retention. */
const INITIAL_TEAM_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;
const ACTIVE_TEAM_RETENTION_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export { ACTIVE_TEAM_RETENTION_MS, INITIAL_TEAM_RETENTION_MS };
