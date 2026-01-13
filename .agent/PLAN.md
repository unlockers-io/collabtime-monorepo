# Collabtime Enhancement Plan

## Overview
This document tracks the planned enhancements to make Collabtime a better real-time collaboration tool.

## Completed Tasks

### 1. Fix Upstash Realtime (DONE)
- **Issue**: Realtime updates only worked for authenticated admin users
- **Root Cause**: The `useRealtime` hook was only subscribing to channels when `token` was present
- **Fix**: Changed `channels: token ? [...] : []` to `channels: [...]` so all users receive updates
- **Additional**: Added `maxDuration = 300` export to API route for serverless timeout handling
- **Commit**: `c81c873`

## In Progress

### 2. Add Team Password Change Feature
Allow admins to change the team password from within the team settings.

**Implementation Plan:**
- Add a "Change Password" dialog/form for admins
- Create a new server action `changeTeamPassword(teamId, token, currentPassword, newPassword)`
- Validate current password before allowing change
- Update the adminPasswordHash in Redis
- Invalidate all existing sessions for security

## Pending Tasks

### 3. Add More PRO Features
Make the PRO subscription more attractive with additional features:

**Potential Features:**
- [ ] Increased team member limits (e.g., unlimited vs 10 for free)
- [ ] Custom team branding/themes
- [ ] Export team schedules (PDF, iCal)
- [ ] Meeting time suggestions based on overlap
- [ ] Integration with calendar apps (Google Calendar, Outlook)
- [ ] Analytics/insights dashboard (who has most overlap, best meeting windows)
- [ ] Priority support
- [ ] API access for automations

**Current PRO Limits (from codebase):**
- customDomain: 1
- privateSpaces: 10

### 4. Set Up Playwright Tests
Create comprehensive E2E tests for critical user flows:

**Test Coverage Plan:**
- [ ] Home page - Create new team flow
- [ ] Team page - Add/edit/remove members
- [ ] Team page - Create/manage groups
- [ ] Authentication - Admin login flow
- [ ] Realtime updates - Multi-browser sync test
- [ ] PRO features - Subscription flow (mock Stripe)

## Technical Notes

### Realtime Architecture
- Uses `@upstash/realtime` with Redis Streams + Server-Sent Events
- Events are emitted from server actions and published via Redis Pub/Sub
- Client subscribes via `useRealtime` hook wrapped in `RealtimeProvider`
- Channels are namespaced by team: `team-{teamId}`

### Database
- Teams stored in Upstash Redis with TTL
- User accounts in PostgreSQL via Prisma
- Sessions managed separately in Redis with 24h TTL

### Authentication
- Team-level: Admin password stored as bcrypt hash
- User-level: Better Auth with Stripe integration
