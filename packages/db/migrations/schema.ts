import { sql } from "drizzle-orm";
import {
  pgTable,
  uniqueIndex,
  index,
  foreignKey,
  text,
  timestamp,
  boolean,
  varchar,
  integer,
  bigint,
  pgEnum,
} from "drizzle-orm/pg-core";

export const invitationStatus = pgEnum("InvitationStatus", ["PENDING", "ACCEPTED", "DECLINED"]);
export const joinRequestStatus = pgEnum("JoinRequestStatus", ["PENDING", "APPROVED", "DENIED"]);
export const memberRole = pgEnum("MemberRole", ["ADMIN", "MEMBER"]);

export const account = pgTable(
  "Account",
  {
    id: text().primaryKey().notNull(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ precision: 3, mode: "string" }),
    refreshTokenExpiresAt: timestamp({ precision: 3, mode: "string" }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
  },
  (table) => [
    uniqueIndex("Account_providerId_accountId_key").using(
      "btree",
      table.providerId.asc().nullsLast().op("text_ops"),
      table.accountId.asc().nullsLast().op("text_ops"),
    ),
    index("Account_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Account_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const membership = pgTable(
  "Membership",
  {
    id: text().primaryKey().notNull(),
    userId: text().notNull(),
    teamId: text().notNull(),
    role: memberRole().default("MEMBER").notNull(),
    archivedAt: timestamp({ precision: 3, mode: "string" }),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
  },
  (table) => [
    index("Membership_teamId_idx").using("btree", table.teamId.asc().nullsLast().op("text_ops")),
    index("Membership_userId_archivedAt_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("timestamp_ops"),
      table.archivedAt.asc().nullsLast().op("text_ops"),
    ),
    index("Membership_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
    uniqueIndex("Membership_userId_teamId_key").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.teamId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Membership_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [space.teamId],
      name: "Membership_teamId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const space = pgTable(
  "Space",
  {
    id: text().primaryKey().notNull(),
    teamId: text().notNull(),
    isPrivate: boolean().default(false).notNull(),
    accessPassword: varchar({ length: 255 }),
    ownerId: text().notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
  },
  (table) => [
    index("Space_ownerId_idx").using("btree", table.ownerId.asc().nullsLast().op("text_ops")),
    index("Space_teamId_idx").using("btree", table.teamId.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [user.id],
      name: "Space_ownerId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const verification = pgTable(
  "Verification",
  {
    id: text().primaryKey().notNull(),
    identifier: text().notNull(),
    value: varchar({ length: 255 }).notNull(),
    expiresAt: timestamp({ precision: 3, mode: "string" }).notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
  },
  (table) => [
    index("Verification_identifier_idx").using(
      "btree",
      table.identifier.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("Verification_identifier_value_key").using(
      "btree",
      table.identifier.asc().nullsLast().op("text_ops"),
      table.value.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const joinRequest = pgTable(
  "JoinRequest",
  {
    id: text().primaryKey().notNull(),
    userId: text().notNull(),
    teamId: text().notNull(),
    status: joinRequestStatus().default("PENDING").notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
  },
  (table) => [
    index("JoinRequest_teamId_status_idx").using(
      "btree",
      table.teamId.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("text_ops"),
    ),
    index("JoinRequest_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
    uniqueIndex("JoinRequest_userId_teamId_key").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.teamId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "JoinRequest_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [space.teamId],
      name: "JoinRequest_teamId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const invitation = pgTable(
  "Invitation",
  {
    id: text().primaryKey().notNull(),
    email: text().notNull(),
    teamId: text().notNull(),
    memberId: text().notNull(),
    status: invitationStatus().default("PENDING").notNull(),
    invitedById: text().notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
  },
  (table) => [
    index("Invitation_email_status_idx").using(
      "btree",
      table.email.asc().nullsLast().op("text_ops"),
      table.status.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("Invitation_email_teamId_key").using(
      "btree",
      table.email.asc().nullsLast().op("text_ops"),
      table.teamId.asc().nullsLast().op("text_ops"),
    ),
    index("Invitation_teamId_idx").using("btree", table.teamId.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.invitedById],
      foreignColumns: [user.id],
      name: "Invitation_invitedById_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.teamId],
      foreignColumns: [space.teamId],
      name: "Invitation_teamId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const user = pgTable(
  "User",
  {
    id: text().primaryKey().notNull(),
    email: text().notNull(),
    emailVerified: boolean().default(false).notNull(),
    name: text(),
    image: text(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
  },
  (table) => [
    index("User_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
    uniqueIndex("User_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
  ],
);

export const session = pgTable(
  "Session",
  {
    id: text().primaryKey().notNull(),
    expiresAt: timestamp({ precision: 3, mode: "string" }).notNull(),
    token: varchar({ length: 512 }).notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
    ipAddress: varchar({ length: 45 }),
    userAgent: text(),
    userId: text().notNull(),
  },
  (table) => [
    index("Session_token_idx").using("btree", table.token.asc().nullsLast().op("text_ops")),
    uniqueIndex("Session_token_key").using("btree", table.token.asc().nullsLast().op("text_ops")),
    index("Session_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "Session_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const rateLimit = pgTable(
  "RateLimit",
  {
    id: text().primaryKey().notNull(),
    key: text().notNull(),
    count: integer().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    lastRequest: bigint({ mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("RateLimit_key_key").using("btree", table.key.asc().nullsLast().op("text_ops")),
  ],
);
