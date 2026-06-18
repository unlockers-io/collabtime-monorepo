import { relations } from "drizzle-orm/relations";

import { account, invitation, joinRequest, membership, session, space, user } from "./schema";

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  invitations: many(invitation),
  joinRequests: many(joinRequest),
  memberships: many(membership),
  sessions: many(session),
  spaces: many(space),
}));

export const membershipRelations = relations(membership, ({ one }) => ({
  space: one(space, {
    fields: [membership.teamId],
    references: [space.teamId],
  }),
  user: one(user, {
    fields: [membership.userId],
    references: [user.id],
  }),
}));

export const spaceRelations = relations(space, ({ many, one }) => ({
  invitations: many(invitation),
  joinRequests: many(joinRequest),
  memberships: many(membership),
  user: one(user, {
    fields: [space.ownerId],
    references: [user.id],
  }),
}));

export const joinRequestRelations = relations(joinRequest, ({ one }) => ({
  space: one(space, {
    fields: [joinRequest.teamId],
    references: [space.teamId],
  }),
  user: one(user, {
    fields: [joinRequest.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  space: one(space, {
    fields: [invitation.teamId],
    references: [space.teamId],
  }),
  user: one(user, {
    fields: [invitation.invitedById],
    references: [user.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));
