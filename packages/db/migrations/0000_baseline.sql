CREATE TYPE "public"."InvitationStatus" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED');--> statement-breakpoint
CREATE TYPE "public"."JoinRequestStatus" AS ENUM('PENDING', 'APPROVED', 'DENIED');--> statement-breakpoint
CREATE TYPE "public"."MemberRole" AS ENUM('ADMIN', 'MEMBER');--> statement-breakpoint
CREATE TABLE "Account" (
	"accessToken" text,
	"accessTokenExpiresAt" timestamp(3),
	"accountId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"idToken" text,
	"password" text,
	"providerId" text NOT NULL,
	"refreshToken" text,
	"refreshTokenExpiresAt" timestamp(3),
	"scope" text,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Invitation" (
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"email" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"invitedById" text NOT NULL,
	"memberId" text NOT NULL,
	"status" "InvitationStatus" DEFAULT 'PENDING' NOT NULL,
	"teamId" text NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "JoinRequest" (
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"status" "JoinRequestStatus" DEFAULT 'PENDING' NOT NULL,
	"teamId" text NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Membership" (
	"archivedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"role" "MemberRole" DEFAULT 'MEMBER' NOT NULL,
	"teamId" text NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RateLimit" (
	"count" integer NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"lastRequest" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"ipAddress" varchar(45),
	"token" varchar(512) NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"userAgent" text,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Space" (
	"accessPassword" varchar(255),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"isPrivate" boolean DEFAULT false NOT NULL,
	"ownerId" text NOT NULL,
	"teamId" text NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"name" text,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Verification" (
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"value" varchar(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Space"("teamId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Space"("teamId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Space"("teamId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Space" ADD CONSTRAINT "Space_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account" USING btree ("providerId" text_ops,"accountId" text_ops);--> statement-breakpoint
CREATE INDEX "Account_userId_idx" ON "Account" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "Invitation_email_status_idx" ON "Invitation" USING btree ("email" text_ops,"status" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Invitation_email_teamId_key" ON "Invitation" USING btree ("email" text_ops,"teamId" text_ops);--> statement-breakpoint
CREATE INDEX "Invitation_teamId_idx" ON "Invitation" USING btree ("teamId" text_ops);--> statement-breakpoint
CREATE INDEX "JoinRequest_teamId_status_idx" ON "JoinRequest" USING btree ("teamId" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "JoinRequest_userId_idx" ON "JoinRequest" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "JoinRequest_userId_teamId_key" ON "JoinRequest" USING btree ("userId" text_ops,"teamId" text_ops);--> statement-breakpoint
CREATE INDEX "Membership_teamId_idx" ON "Membership" USING btree ("teamId" text_ops);--> statement-breakpoint
CREATE INDEX "Membership_userId_archivedAt_idx" ON "Membership" USING btree ("userId" timestamp_ops,"archivedAt" text_ops);--> statement-breakpoint
CREATE INDEX "Membership_userId_idx" ON "Membership" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Membership_userId_teamId_key" ON "Membership" USING btree ("userId" text_ops,"teamId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit" USING btree ("key" text_ops);--> statement-breakpoint
CREATE INDEX "Session_token_idx" ON "Session" USING btree ("token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Session_token_key" ON "Session" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "Session_userId_idx" ON "Session" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "Space_ownerId_idx" ON "Space" USING btree ("ownerId" text_ops);--> statement-breakpoint
CREATE INDEX "Space_teamId_idx" ON "Space" USING btree ("teamId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Space_teamId_key" ON "Space" USING btree ("teamId" text_ops);--> statement-breakpoint
CREATE INDEX "User_email_idx" ON "User" USING btree ("email" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "Verification_identifier_idx" ON "Verification" USING btree ("identifier" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Verification_identifier_value_key" ON "Verification" USING btree ("identifier" text_ops,"value" text_ops);