# PROJ-16: Notifications System

## Status: Planned
**Created:** 2026-03-04
**Last Updated:** 2026-03-04

## Dependencies
- Requires: PROJ-5 (NextAuth.js auth — protected routes)
- Requires: PROJ-6 (PostgreSQL data available via Prisma)
- Requires: PROJ-10 (Members, Projects & Settings — for notification creation trigger)

## User Stories
- As a user, I want to see a notification bell in the header with an unread count so that I know when something needs my attention.
- As a user, I want to click the bell to see my notifications so that I can read them.
- As a user, I want notifications to include project invites so that I know when I'm added to a project.
- As a user, I want to mark notifications as read so that I can clear them.
- As a user, I want to mark all notifications as read at once so that I can clear my inbox quickly.
- As a user, I want clicking a notification to navigate to the relevant project so that I can take action.
- As a user, I want to see when a notification was created in relative terms (e.g., "2 hours ago") so that I understand its recency.

## Acceptance Criteria

### UI Components

#### 1. Header Notification Bell
- [ ] Bell icon displayed in the persistent header bar (right side, near user info)
- [ ] **Unread Badge**: Red circular badge with white text showing unread count
  - Badge appears only when `unreadCount > 0`
  - Badge positioned at top-right corner of bell icon
  - Maximum count displayed: "9+" for 10+ unread notifications
  - Badge diameter: 18px, font-size: 11px, font-weight: bold
- [ ] Bell icon changes visual state on hover (cursor: pointer, opacity change)
- [ ] Accessible: aria-label="Notifications (X unread)"

#### 2. Dropdown Panel
- [ ] Clicking bell icon toggles dropdown panel
- [ ] Dropdown closes when:
  - Clicking outside the panel
  - Pressing Escape key
  - Clicking a notification (navigate)
- [ ] Panel width: 380px maximum
- [ ] Panel positioned below bell icon, right-aligned
- [ ] Panel has shadow and border for visual separation
- [ ] Header section with:
  - Title: "Notifications"
  - "Mark all as read" button (text link style, disabled if no unread)

#### 3. Notification List
- [ ] List displays maximum 50 notifications (newest first, by `createdAt DESC`)
- [ ] Scrollable if content exceeds panel height (max-height: 400px)
- [ ] Each notification item displays:
  - **Icon**: Type-specific icon (left side, 40px container)
  - **Content**: Message text (primary) + Project name (secondary, muted)
  - **Timestamp**: Relative time (e.g., "2 hours ago", "Yesterday", "3 days ago")
  - **Unread Indicator**: Blue left border (2px) for unread items
- [ ] Notification item layout:
  ```
  ┌─────────────────────────────────────┐
  │ [Icon]  Message text here...    2h  │
  │         Project Name                │
  └─────────────────────────────────────┘
  ```
- [ ] Hover effect on each item (background color change)
- [ ] Clicking anywhere on item navigates to project

#### 4. Notification Types & Icons

| Type | Icon | Icon Color | Message Format |
|------|------|------------|----------------|
| `project_invite` | UserPlus or Users icon (Lucide) | Indigo/Blue | "You have been added to '{projectName}' as {role}" |

#### 5. Empty State
- [ ] When user has no notifications:
  - Display centered icon (BellOff or Inbox icon)
  - Text: "No notifications yet"
  - Subtext: "We'll notify you when something happens"

### Actions & Interactions

#### 6. Mark as Read (Individual)
- [ ] Each notification has a "Mark as read" button on hover (eye icon or text)
- [ ] Clicking "Mark as read":
  - Calls `POST /api/notifications/[id]/read`
  - Updates local state immediately (optimistic UI)
  - Removes unread styling (blue border)
  - Decrements badge count
- [ ] If already read, button is hidden

#### 7. Mark All as Read
- [ ] "Mark all as read" button in dropdown header
- [ ] Clicking button:
  - Calls `POST /api/notifications/read-all`
  - Updates all items to read state
  - Hides badge completely
  - Button shows loading state during API call
- [ ] Button is disabled if no unread notifications

#### 8. Navigation on Click
- [ ] Clicking a notification:
  - Marks it as read (if unread)
  - Switches to the notification's project context
  - Navigates to `/projects/[projectId]/bills` (default landing page)
  - Closes dropdown panel

### Real-time Updates
- [ ] Badge count updates:
  - On page load/refresh
  - When dropdown is opened (refetch)
  - Optional: Background polling every 30 seconds or SWR revalidation

### API Endpoints (Next.js App Router)

#### GET /api/notifications
- [ ] Returns notifications for authenticated user only
- [ ] Sorted by `createdAt DESC`
- [ ] Limited to 50 results
- [ ] Response format:
  ```json
  {
    "notifications": [
      {
        "id": "uuid",
        "type": "project_invite",
        "message": "You have been added to...",
        "projectId": "uuid",
        "projectName": "Project Name",
        "isRead": false,
        "createdAt": "2026-03-04T10:00:00Z"
      }
    ],
    "unreadCount": 3
  }
  ```

#### POST /api/notifications/[id]/read
- [ ] Marks single notification as read
- [ ] Verifies notification belongs to authenticated user
- [ ] Idempotent: calling on already-read notification returns success
- [ ] Response: `{ "ok": true }`

#### POST /api/notifications/read-all
- [ ] Marks all notifications for user as read
- [ ] Idempotent: returns success even if no unread exist
- [ ] Response: `{ "ok": true, "count": 5 }`

### Notification Creation (Server-Side)
- [ ] When a user is added to a project (in members API), create notification:
  ```javascript
  // In POST /api/admin/project/members
  await prisma.notification.create({
    data: {
      userEmail: invitedUser.email,
      type: "project_invite",
      message: `You have been added to "${projectName}" as ${role}.`,
      projectId: projectId
    }
  });
  ```

## Edge Cases

### EC-1: User has 50+ notifications
- **Behavior**: Only show newest 50 in dropdown
- **Older notifications**: Remain in database, not accessible via UI (future enhancement: pagination or "load more")

### EC-2: Notification for deleted project
- **Behavior**: Show "(deleted project)" placeholder instead of project name
- **Navigation**: Clicking navigates to project switcher or shows "Project no longer exists" toast
- **Prisma relation**: `projectId` relation is nullable (`SetNull` on delete)

### EC-3: User clicks already-read notification
- **Behavior**: Still navigates to project, no error
- **API call**: Optionally skip mark-as-read API call for already-read items

### EC-4: Mark all as read when none are unread
- **Behavior**: Idempotent operation, returns success
- **UI**: Button is disabled when `unreadCount === 0`

### EC-5: Very long notification message
- **Behavior**: Truncate with ellipsis after 2 lines
- **Hover**: Show full message in tooltip or title attribute

### EC-6: Notification created while dropdown is open
- **Behavior**: Next refetch (dropdown close/reopen or poll) will show new notification
- **Badge**: Updates on next count refresh

### EC-7: User clicks mark-as-read on multiple items rapidly
- **Behavior**: Queue API calls or use optimistic UI with rollback on error
- **Race condition**: Handle gracefully, last write wins

### EC-8: Network error during mark-as-read
- **Behavior**: Show error toast, revert optimistic UI update
- **User can retry**: Click mark-as-read again

### EC-9: Session expired while dropdown open
- **Behavior**: API returns 401, redirect to login page

## Technical Requirements
- [ ] **Bell Component**: Client Component (needs interactivity, state)
- [ ] **Dropdown**: Use Radix UI Dropdown Menu or similar accessible component
- [ ] **Timestamp**: Use `date-fns` formatDistanceToNow for relative time
- [ ] **State Management**: 
  - SWR or React Query for server state
  - Optimistic updates for mark-as-read actions
- [ ] **Icons**: Lucide React icons (consistent with project)
- [ ] **Accessibility**:
  - Keyboard navigation (arrow keys, Enter, Escape)
  - Focus trap within dropdown when open
  - Screen reader announcements for new notifications
  - ARIA labels for interactive elements
- [ ] **Styling**: Tailwind CSS
  - Unread: `border-l-2 border-blue-500 bg-blue-50/50`
  - Read: `border-l-2 border-transparent`
  - Badge: `bg-red-500 text-white text-xs font-bold rounded-full`

## Database Schema (Prisma)
```prisma
model Notification {
  id        String   @id @default(uuid())
  legacyId  Int?     @unique
  userEmail String
  type      String
  message   String
  projectId String?
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  user    User     @relation(fields: [userEmail], references: [email], onDelete: Cascade)
  project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@index([userEmail])
  @@index([projectId])
}
```

## Migration Notes (from Express/SQLite)
- Express implementation used `is_read` INTEGER (0/1), Prisma uses `isRead` Boolean
- Express returned `created_at` string, Prisma returns DateTime
- Express had no project name in response, Next.js API should include joined project name
- Express routes:
  - `GET /api/notifications` → `app/api/notifications/route.ts`
  - `POST /api/notifications/:id/read` → `app/api/notifications/[id]/read/route.ts`
  - `POST /api/notifications/read-all` → `app/api/notifications/read-all/route.ts`
- Notification creation in `routes/members.js` lines 72-82 → migrate to Next.js members API

## Future Enhancements (Out of Scope)
- Real-time updates via WebSocket/Socket.io
- Push notifications (browser)
- Email notifications for critical events
- Notification preferences/settings
- Additional notification types (bill approved, v-geld received, etc.)
- "Load more" or pagination for >50 notifications
- Notification history/archive

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### 1. Component Structure (Visual Tree)

```
Header (Server Component)
+-- HeaderActions (flex container)
    +-- NotificationBell (Client Component)
    |   +-- BellTrigger Button
    |   |   +-- Bell Icon (Lucide)
    |   |   +-- Badge (red circular, conditionally rendered)
    |   |       +-- Count (number or "9+")
    |   +-- Dropdown Portal (Radix DropdownMenu.Content)
    |       +-- DropdownPanel (380px max-width)
    |           +-- PanelHeader
    |           |   +-- Title "Notifications"
    |           |   +-- "Mark all as read" Link Button
    |           +-- ScrollableList (max-height: 400px)
    |           |   +-- NotificationItem[] (repeated)
    |           |       +-- Icon Container (40px, type-specific)
    |           |       +-- Content Block
    |           |       |   +-- Message Text (truncated 2 lines)
    |           |       |   +-- Project Name (muted)
    |           |       +-- Timestamp (relative time)
    |           |       +-- Hover Actions (mark-as-read button)
    |           +-- EmptyState (centered, when no notifications)
    |               +-- BellOff Icon
    |               +-- "No notifications yet" Text
    |               +-- Subtext
    +-- UserEmail (hidden mobile)
    +-- Avatar
    +-- SignOutButton
```

### 2. Data Model (Plain Language)

**Notifications Table** — Each notification represents an event relevant to a user:
- **Unique ID** — System-generated identifier for the notification
- **User Email** — Who should see this notification (linked to User account)
- **Type** — What kind of event (e.g., "project_invite" for project invitations)
- **Message** — Human-readable description of what happened
- **Project ID** (optional) — Which project this relates to (for navigation)
- **Read Status** — Whether the user has seen it (true/false)
- **Created At** — When the notification was generated

**User Relationship** — Each user has their own notification inbox. Notifications are private and only visible to the recipient.

**Project Relationship** — Notifications can optionally link to a project. When clicked, the user navigates to that project. If the project is deleted, the notification remains but shows "(deleted project)" placeholder.

**Storage Limits** — The UI displays only the newest 50 notifications per user. Older notifications remain in the database but are not accessible through the current interface (future enhancement may add pagination).

### 3. Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Badge Update Strategy** | Polling (30-second interval) + on-focus refetch | WebSockets would be overkill for this feature. Polling provides near-real-time updates without infrastructure complexity. SWR/React Query will handle caching and revalidation efficiently. |
| **Dropdown Accessibility** | Radix UI DropdownMenu | Provides complete accessibility out-of-the-box: keyboard navigation (arrow keys, Escape to close), focus trapping, ARIA attributes, and click-outside handling. Matches project's existing UI component approach. |
| **Relative Timestamp** | date-fns `formatDistanceToNow` | Industry-standard library for human-readable relative time ("2 hours ago", "Yesterday"). Lightweight, well-maintained, supports localization if needed later. |
| **Navigation on Click** | Navigate to `/projects/[id]/bills` | Bills page is the primary project workspace. Consistent with user expectation that project-related notifications take them to where they can take action. |
| **Optimistic Updates** | Update UI immediately, rollback on error | Mark-as-read actions feel instant to users. If the API fails, the UI reverts and shows an error toast. Better perceived performance than waiting for server response. |
| **Server/Client Split** | Header remains Server Component, NotificationBell is Client Component | Preserves benefits of Server Components (no JS bundle for static header elements) while allowing interactivity where needed. NotificationBell wrapped in its own client bundle. |
| **State Management** | SWR for server state, React useState for UI state | SWR provides caching, deduplication, and automatic revalidation. No need for global state library (Zustand/Redux) for this localized feature. |

### 4. Code Reuse Opportunities

| Pattern | Source | How to Reuse |
|---------|--------|--------------|
| **Notification CRUD Logic** | `routes/notifications.js` (Express) | API endpoints already designed: GET list, POST mark single as read, POST mark all as read. Migrate logic to Next.js App Router with Prisma queries instead of raw SQL. |
| **Notification Creation** | `routes/members.js` lines 72-82 | When members are added to a project, create a notification. Copy this pattern to the Next.js members API: use `prisma.notification.create()` with type "project_invite". |
| **Header Layout** | `components/layout/Header.tsx` | Current header has user info on the right side in a flex container. Insert NotificationBell component before the email/avatar elements. Maintain existing styling (gap-3, ml-auto). |
| **Badge Styling Pattern** | `components/bills/BillStatusBadge.tsx` | Existing badge component shows colored status labels. Adapt styling approach for the red notification count badge (rounded-full, text-xs, font-bold). |
| **Avatar Pattern** | `components/layout/Header.tsx` lines 44-50 | Current initials avatar uses `w-8 h-8 rounded-full` with colored background. Notification type icons can reuse the container sizing pattern. |
| **Empty State Pattern** | Bill list empty states (implied) | Centered icon + text + subtext pattern for when no notifications exist. Consistent with other "empty" UI in the app. |
| **API Response Pattern** | Existing Next.js API routes | Follow `{ ok: true }` pattern for mutations, include `unreadCount` in list response (already specified in spec). |

### 5. Dependencies

| Package | Purpose | Install Command |
|---------|---------|-----------------|
| **date-fns** | Relative timestamp formatting ("2 hours ago") | `npm install date-fns` |
| **@radix-ui/react-dropdown-menu** | Accessible dropdown component (already available via shadcn/ui pattern) | Check if available; if not: `npm install @radix-ui/react-dropdown-menu` |
| **lucide-react** | Icons (Bell, BellOff, UserPlus, Eye, etc.) | Already installed |
| **swr** | Data fetching with caching/revalidation | Already installed (check package.json) or `npm install swr` |

**Note:** The project currently does not have `date-fns` installed — this is required for relative time formatting. Radix UI dropdown may already be available if shadcn/ui components are used; verify before installing.

---

### Architecture Summary for PM

**What we're building:** A notification bell in the header that shows unread count, drops down to reveal recent notifications, and allows marking them as read. When clicked, notifications navigate to the relevant project.

**How it works:** 
1. The system polls every 30 seconds to check for new notifications
2. Notifications are stored in PostgreSQL, linked to users and projects
3. When a user is added to a project, the system automatically creates a notification
4. The UI uses optimistic updates — actions feel instant even before the server confirms

**Key technical considerations:**
- Uses existing notification database table (already defined in Prisma schema)
- Leverages proven dropdown accessibility patterns (Radix UI)
- No WebSockets needed — polling is sufficient and simpler
- Limited to 50 notifications visible at once (performance protection)
- Requires one new npm package: `date-fns` for human-readable timestamps

## Change Requests

### CR-19: Expanded Notification Triggers
**Requested:** 2026-03-14 | **Priority:** High | **Status:** Discussion Needed

**Current Behavior:** Only "invited to project" generates a notification. All other significant events (bill approved/rejected/paid, new bill submitted, V-Geld transfer received, budget overrun) happen silently.

**Desired Behavior:** Notifications generated for a broader set of events so users and admins stay informed without having to poll each section manually. Which events trigger notifications (in-app vs. email) and the exact copy for each TBD — needs discussion before implementation.

---

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
