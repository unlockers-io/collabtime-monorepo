import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const invitationStatus = pgEnum("InvitationStatus", ["PENDING", "ACCEPTED", "DECLINED"]);
export const joinRequestStatus = pgEnum("JoinRequestStatus", ["PENDING", "APPROVED", "DENIED"]);
export const memberRole = pgEnum("MemberRole", ["ADMIN", "MEMBER"]);

export const user = pgTable(
  "User",
  {
    createdAt: timestamp({ mode: "string", precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    email: text().notNull(),
    emailVerified: boolean().default(false).notNull(),
    id: text().primaryKey().notNull(),
    image: text(),
    name: text(),
    // $onUpdate fires only on db.update() — NOT on insert or onConflictDoUpdate upserts.
    updatedAt: timestamp({ mode: "string", precision: 3 })
      .notNull()
      .$onUpdate(() => new Date().toISOString()),
  },
  (table) => [
    index("User_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
    uniqueIndex("User_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
  ],
);

export const session = pgTable(
  "Session",
  {
    createdAt: timestamp({ mode: "string", precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    expiresAt: timestamp({ mode: "string", precision: 3 }).notNull(),
    id: text().primaryKey().notNull(),
    ipAddress: varchar({ length: 45 }),
    token: varchar({ length: 512 }).notNull(),
    updatedAt: timestamp({ mode: "string", precision: 3 })
      .notNull()
      .$onUpdate(() => new Date().toISOString()),
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

export const account = pgTable(
  "Account",
  {
    accessToken: text(),
    accessTokenExpiresAt: timestamp({ mode: "string", precision: 3 }),
    accountId: text().notNull(),
    createdAt: timestamp({ mode: "string", precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    id: text().primaryKey().notNull(),
    idToken: text(),
    password: text(),
    providerId: text().notNull(),
    refreshToken: text(),
    refreshTokenExpiresAt: timestamp({ mode: "string", precision: 3 }),
    scope: text(),
    updatedAt: timestamp({ mode: "string", precision: 3 })
      .notNull()
      .$onUpdate(() => new Date().toISOString()),
    userId: text().notNull(),
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

export const verification = pgTable(
  "Verification",
  {
    createdAt: timestamp({ mode: "string", precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    expiresAt: timestamp({ mode: "string", precision: 3 }).notNull(),
    id: text().primaryKey().notNull(),
    identifier: text().notNull(),
    updatedAt: timestamp({ mode: "string", precision: 3 })
      .notNull()
      .$onUpdate(() => new Date().toISOString()),
    value: varchar({ length: 255 }).notNull(),
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

export const space = pgTable(
  "Space",
  {
    accessPassword: varchar({ length: 255 }),
    createdAt: timestamp({ mode: "string", precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    id: text().primaryKey().notNull(),
    isPrivate: boolean().default(false).notNull(),
    ownerId: text().notNull(),
    teamId: text().notNull(),
    updatedAt: timestamp({ mode: "string", precision: 3 })
      .notNull()
      .$onUpdate(() => new Date().toISOString()),
  },
  (table) => [
    index("Space_ownerId_idx").using("btree", table.ownerId.asc().nullsLast().op("text_ops")),
    index("Space_teamId_idx").using("btree", table.teamId.asc().nullsLast().op("text_ops")),
    // unique() generates a real PG unique constraint (not just an index) so that
    // Membership/JoinRequest/Invitation foreign keys referencing Space.teamId work.
    unique("Space_teamId_key").on(table.teamId),
    foreignKey({
      columns: [table.ownerId],
      foreignColumns: [user.id],
      name: "Space_ownerId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const membership = pgTable(
  "Membership",
  {
    archivedAt: timestamp({ mode: "string", precision: 3 }),
    createdAt: timestamp({ mode: "string", precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    id: text().primaryKey().notNull(),
    role: memberRole().default("MEMBER").notNull(),
    teamId: text().notNull(),
    updatedAt: timestamp({ mode: "string", precision: 3 })
      .notNull()
      .$onUpdate(() => new Date().toISOString()),
    userId: text().notNull(),
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

export const joinRequest = pgTable(
  "JoinRequest",
  {
    createdAt: timestamp({ mode: "string", precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    id: text().primaryKey().notNull(),
    status: joinRequestStatus().default("PENDING").notNull(),
    teamId: text().notNull(),
    updatedAt: timestamp({ mode: "string", precision: 3 })
      .notNull()
      .$onUpdate(() => new Date().toISOString()),
    userId: text().notNull(),
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
    createdAt: timestamp({ mode: "string", precision: 3 })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    email: text().notNull(),
    id: text().primaryKey().notNull(),
    invitedById: text().notNull(),
    memberId: text().notNull(),
    status: invitationStatus().default("PENDING").notNull(),
    teamId: text().notNull(),
    updatedAt: timestamp({ mode: "string", precision: 3 })
      .notNull()
      .$onUpdate(() => new Date().toISOString()),
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

export const rateLimit = pgTable(
  "RateLimit",
  {
    count: integer().notNull(),
    id: text().primaryKey().notNull(),
    key: text().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    lastRequest: bigint({ mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("RateLimit_key_key").using("btree", table.key.asc().nullsLast().op("text_ops")),
  ],
);
