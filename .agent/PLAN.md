# Collabtime Enhancement Plan

## Overview
This document tracks the planned enhancements to make Collabtime a better real-time collaboration tool.

## Completed Tasks

### 1. Fix Upstash Realtime (DONE) - Commit: `c81c873`
- **Issue**: Realtime updates only worked for authenticated admin users
- **Root Cause**: The `useRealtime` hook was only subscribing to channels when `token` was present
- **Fix**: Changed `channels: token ? [...] : []` to `channels: [...]` so all users receive updates
- **Additional**: Added `maxDuration = 300` export to API route for serverless timeout handling

### 2. Add Team Password Change Feature (DONE) - Commit: `e031982`
- **Implementation**:
  - Added `TeamChangePasswordInputSchema` validation with password confirmation
  - Created `changeTeamPassword` server action that:
    - Verifies admin access
    - Validates current password before allowing change
    - Creates new session token and invalidates old one for security
  - Added `ChangePasswordDialog` component for the UI
  - Integrated change password button in team admin controls

### 3. Add More PRO Features (DONE)

#### 3.1 Team Data Export - Commit: `4d0eb2d`
- **Files Added**:
  - `/api/teams/[teamId]/export/route.ts` - API endpoint for CSV/JSON export
  - `actions-internal.ts` - Shared utilities for API routes
  - `ExportTeamDialog` component with format selection
- **Features**:
  - Export team data as CSV (for spreadsheets)
  - Export team data as JSON (for developers/integrations)
  - PRO subscription validation
  - Space ownership check

#### 3.2 Meeting Time Suggestions - Commit: `85bf01c`
- **Files Added**:
  - `MeetingSuggestions` component
- **Features**:
  - Analyzes team working hours to find optimal meeting windows
  - Shows availability percentage for each time slot
  - Supports filtering by group
  - Converts to user's local timezone
  - Shows best 5 meeting windows with expandable list

#### PRO Features Summary:
1. Private Spaces (password protection)
2. Export Team Data (CSV/JSON)
3. Meeting Time Suggestions
4. Access Control
5. Priority Support
6. Custom Branding (coming soon)

### 4. Set Up Playwright Tests (DONE) - Commit: `d930da4`
- **Configuration**: `apps/web/playwright.config.ts`
  - Multi-browser support (Chromium, Firefox, WebKit)
  - Mobile viewports (Pixel 5, iPhone 12)
  - HTML reporter with trace/screenshot/video on failure
  - Dev server auto-start
- **Test Files**:
  - `e2e/home.spec.ts` - Home page and team creation flow
  - `e2e/team.spec.ts` - Team page, member management, auth, groups
- **Scripts Added**:
  - `test:e2e` - Run all tests
  - `test:e2e:ui` - Open Playwright UI
  - `test:e2e:headed` - Run with browser visible
  - `test:e2e:chromium` - Run only Chromium tests

## Future Work (Backlog)

### Potential Enhancements
1. **Custom Branding** - Allow PRO users to customize team branding
2. **Calendar Integration** - Sync with Google Calendar, Outlook
3. **API Access** - Provide API keys for PRO users to access data programmatically
4. **Team Analytics** - Track working patterns and collaboration metrics
5. **Slack Integration** - Send notifications and meeting suggestions to Slack
6. **iCal Export** - Export team schedules as iCal files

### Technical Debt
1. Add more comprehensive E2E tests for realtime features
2. Add unit tests for server actions
3. Improve error handling in export functionality
4. Add rate limiting to export endpoint

## Architecture Notes

### Realtime System
- Uses `@upstash/realtime` with Redis Streams + Server-Sent Events
- Events emitted from server actions via `realtime.channel().emit()`
- Client subscribes via `useRealtime` hook wrapped in `RealtimeProvider`
- Channels namespaced by team: `team-{teamId}`

### Data Storage
- Teams stored in Upstash Redis with TTL (60 days initial, 2 years active)
- User accounts in PostgreSQL via Prisma
- Sessions managed in Redis with 24h TTL

### Authentication
- Team-level: Admin password stored as bcrypt hash
- User-level: Better Auth with Stripe integration
- Space ownership: Links authenticated users to teams for PRO features

### PRO Feature Gating
- Check `user.subscriptionPlan === SubscriptionPlan.PRO`
- Verify space ownership for team-specific features
- Return 402 Payment Required for non-PRO users attempting PRO features
