const LIVE_EVENTS = {
  change: "change",
  deleted: "deleted",
  ready: "ready",
  reconnect: "reconnect",
  revoked: "revoked",
  space: "space",
} as const;

type LiveEvent = (typeof LIVE_EVENTS)[keyof typeof LIVE_EVENTS];
type AccessLoss = typeof LIVE_EVENTS.deleted | typeof LIVE_EVENTS.revoked;

const ACCESS_LOSS_STATUS = { deleted: 404, revoked: 403 } as const satisfies Record<
  AccessLoss,
  number
>;

const isAccessLossStatus = (status: number): boolean =>
  status === ACCESS_LOSS_STATUS.deleted || status === ACCESS_LOSS_STATUS.revoked;

const RECONNECT_DELAY_MS = 2000;
const RECONNECT_JITTER_MS = 500;
// Must end before the events route's maxDuration, which must end before the admission lease.
const STREAM_LIFETIME_MS = 285_000;

const teamEventsUrl = (teamId: string): string => `/api/teams/${teamId}/events`;

export {
  ACCESS_LOSS_STATUS,
  isAccessLossStatus,
  LIVE_EVENTS,
  RECONNECT_DELAY_MS,
  RECONNECT_JITTER_MS,
  STREAM_LIFETIME_MS,
  teamEventsUrl,
};
export type { AccessLoss, LiveEvent };
