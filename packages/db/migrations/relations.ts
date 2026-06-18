import { relations } from "drizzle-orm/relations";

import { user, account, membership, space, joinRequest, invitation, session } from "./schema";

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  memberships: many(membership),
  spaces: many(space),
  joinRequests: many(joinRequest),
  invitations: many(invitation),
  sessions: many(session),
}));

export const membershipRelations = relations(membership, ({ one }) => ({
  user: one(user, {
    fields: [membership.userId],
    references: [user.id],
  }),
  space: one(space, {
    fields: [membership.teamId],
    references: [space.teamId],
  }),
}));

export const spaceRelations = relations(space, ({ one, many }) => ({
  memberships: many(membership),
  user: one(user, {
    fields: [space.ownerId],
    references: [user.id],
  }),
  joinRequests: many(joinRequest),
  invitations: many(invitation),
}));

export const joinRequestRelations = relations(joinRequest, ({ one }) => ({
  user: one(user, {
    fields: [joinRequest.userId],
    references: [user.id],
  }),
  space: one(space, {
    fields: [joinRequest.teamId],
    references: [space.teamId],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  user: one(user, {
    fields: [invitation.invitedById],
    references: [user.id],
  }),
  space: one(space, {
    fields: [invitation.teamId],
    references: [space.teamId],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));
