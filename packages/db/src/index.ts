export * from "./client";
export * from "./relations";
export * from "./schema";

import type * as schema from "./schema";

export type User = typeof schema.user.$inferSelect;
export type Session = typeof schema.session.$inferSelect;
export type Account = typeof schema.account.$inferSelect;
export type Verification = typeof schema.verification.$inferSelect;
export type RateLimit = typeof schema.rateLimit.$inferSelect;
export type Space = typeof schema.space.$inferSelect;
export type Membership = typeof schema.membership.$inferSelect;
export type JoinRequest = typeof schema.joinRequest.$inferSelect;
export type Invitation = typeof schema.invitation.$inferSelect;
