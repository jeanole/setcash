# Implementation Plan — Admin Invites User to Telegram (Bypass /link CODE Flow)

## Feature
Admin can generate a Telegram deep link for any project member and share it directly.
The user clicks the link → Telegram opens the bot → `/start CODE` is handled automatically.

## Related
- Feature spec: `features/PROJ-12-integrations.md` (Telegram section)
- Notification system: `features/PROJ-16-notifications-system.md`

---

## Step 1: Store bot username on token save

**File:** `nextjs/app/api/admin/telegram/settings/route.ts`

After the `getMe` validation succeeds (after line 131, `tgData.ok` check), extract
`tgData.result.username` and upsert it into `ProjectSettings` with key `telegramBotUsername`.
Add this alongside the existing token upsert in the `upserts` array.

```ts
if (tgData.result?.username) {
  upserts.push(
    prisma.projectSettings.upsert({
      where: { projectId_key: { projectId, key: 'telegramBotUsername' } },
      create: { projectId, key: 'telegramBotUsername', value: tgData.result.username },
      update: { value: tgData.result.username },
    })
  );
}
```

> Existing projects without this key will see a clear error from the invite endpoint
> telling them to re-save their token.

---

## Step 2: New invite API endpoint

**File to create:** `nextjs/app/api/admin/telegram/invite/route.ts`

`POST` handler (admin only):

1. Auth + admin check (same boilerplate as `links/route.ts`)
2. Zod parse body: `z.object({ userEmail: z.string().email() })`
3. Verify `userEmail` is a member of `projectId` (query `ProjectMember`)
4. Return 400 if already linked (`TelegramLink` exists for `{ projectId, userEmail }`)
5. Read `telegramBotUsername` from `ProjectSettings` — return 400 with clear message if missing
6. Call `generateLinkCode(userEmail, projectId)` from `@/lib/telegram/codes`
7. Create in-app notification for the target user (see §2a below)
8. Return `{ deepLink: "https://t.me/${botUsername}?start=${code}", expires: expiresAt }`

### §2a: Notification on invite

After generating the link code and before returning the response, create a notification
for the invited user using the same pattern as the project_invite notification:

```ts
await prisma.notification.create({
  data: {
    userEmail,
    type: 'telegram_invite',
    message: `An admin has sent you a Telegram bot link. Open the link to connect your account.`,
    projectId,
  },
});
```

This uses the existing `Notification` model (PROJ-16) — no schema changes needed.
The notification type `telegram_invite` is new but the system is type-agnostic (stored as
a plain string). The frontend notification bell will show it with the default icon until
PROJ-16's UI is extended for this type (out of scope here).

---

## Step 3: Handle `/start CODE` in the bot

**File:** `nextjs/lib/telegram/handlers.ts`

The `/start` handler currently just sends a welcome message. Change it to check for a payload:

```ts
if (msg.text?.startsWith('/start')) {
  const payload = msg.text.trim().split(/\s+/)[1];
  if (payload) {
    // reuse the same validation + TelegramLink upsert logic as /link handler
    const code = payload.toUpperCase();
    const result = await validateAndConsumeLinkCode(code, projectId);
    if (!result) {
      bot.sendMessage(msg.chat.id, 'Ungültiger oder abgelaufener Code.').catch(() => {});
      return;
    }
    const telegramUserId = String(msg.from!.id);
    try {
      await prisma.telegramLink.upsert({
        where: { projectId_telegramUserId: { projectId, telegramUserId } },
        update: { userEmail: result.userEmail },
        create: { projectId, telegramUserId, userEmail: result.userEmail },
      });
      bot.sendMessage(
        msg.chat.id,
        `✓ Verknüpft mit ${result.userEmail}!\nSende jetzt einfach Fotos deiner Belege – sie werden automatisch als Entwurf gespeichert.`
      ).catch(() => {});
    } catch (e) {
      console.error(`[TG ${projectId}] Link error:`, (e as Error).message);
      bot.sendMessage(msg.chat.id, 'Fehler beim Verknüpfen. Bitte erneut versuchen.').catch(() => {});
    }
  } else {
    // plain /start — welcome message as before
    bot.sendMessage(
      msg.chat.id,
      'Willkommen bei SetCash!\nSende /link <Code> um deinen Account zu verknüpfen.\nDen Code findest du in SetCash unter "Telegram verknüpfen".'
    ).catch(() => {});
  }
  return;
}
```

Extract the shared link logic into a `performLink(bot, msg, projectId, code)` helper
to avoid duplicating between `/start` payload and `/link` handlers.

---

## Step 4: Extend `GET /api/admin/telegram/links` to include unlinked members

**File:** `nextjs/app/api/admin/telegram/links/route.ts`

Change the response to return both linked and unlinked members:

```ts
const members = await prisma.projectMember.findMany({
  where: { projectId },
  select: { userEmail: true },
});
const links = await prisma.telegramLink.findMany({
  where: { projectId },
  orderBy: { linkedAt: 'desc' },
  select: { id: true, telegramUserId: true, userEmail: true, linkedAt: true },
});
const linkedEmails = new Set(links.map(l => l.userEmail));
const unlinked = members.map(m => m.userEmail).filter(e => !linkedEmails.has(e));
return NextResponse.json({ linked: links, unlinked });
```

---

## Step 5: New `TelegramInviteModal` component

**File to create:** `nextjs/components/settings/TelegramInviteModal.tsx`

Follow existing modal pattern (overlay + card).

- Props: `{ userEmail: string; onClose: () => void }`
- On mount: `POST /api/admin/telegram/invite` with `{ userEmail }`
- Loading spinner while fetching
- Success: show deep link in copyable `<code>` block + expiry note + "Copy Link" button
- Error: show in `bg-rose-50 border-rose-200` block
- Note: "Generating a new link invalidates any previous link for this user."

---

## Step 6: Update `LinkedAccountsTable` to show unlinked members

**File:** `nextjs/components/settings/LinkedAccountsTable.tsx`

- Update `fetchLinks` to consume new `{ linked, unlinked }` response shape
- Update `links` state: `linked: TelegramLink[]`, add `unlinked: string[]` state
- Existing linked section: unchanged (email, Telegram ID, linked date, Unlink button)
- Add unlinked section below: show email, "Not linked" badge, "Invite" button
- Add state: `const [inviteEmail, setInviteEmail] = useState<string | null>(null)`
- Render `<TelegramInviteModal>` when `inviteEmail` is set
- On modal close: refetch to update both sections

---

## Files to Change

| Action | File |
|---|---|
| Modify | `nextjs/app/api/admin/telegram/settings/route.ts` |
| Create | `nextjs/app/api/admin/telegram/invite/route.ts` |
| Modify | `nextjs/app/api/admin/telegram/links/route.ts` |
| Modify | `nextjs/lib/telegram/handlers.ts` |
| Create | `nextjs/components/settings/TelegramInviteModal.tsx` |
| Modify | `nextjs/components/settings/LinkedAccountsTable.tsx` |

---

## Checklist

### Backend
- [ ] `telegramBotUsername` stored in `ProjectSettings` on token save
- [ ] `POST /api/admin/telegram/invite` route created
  - [ ] Admin-only auth check
  - [ ] Zod validates `userEmail`
  - [ ] Verifies user is a project member
  - [ ] Returns 400 if already linked
  - [ ] Returns 400 with message if `telegramBotUsername` not set
  - [ ] Calls `generateLinkCode` and returns deep link + expiry
  - [ ] Creates `telegram_invite` notification for target user
- [ ] `GET /api/admin/telegram/links` returns `{ linked, unlinked }`
- [ ] `/start CODE` handled in bot (reuses same upsert logic as `/link`)
- [ ] Shared `performLink()` helper extracted to avoid duplication

### Frontend
- [ ] `TelegramInviteModal` component created
  - [ ] Calls invite API on mount
  - [ ] Shows copyable deep link on success
  - [ ] Shows error state
- [ ] `LinkedAccountsTable` updated
  - [ ] Consumes `{ linked, unlinked }` shape
  - [ ] Shows unlinked members with "Not linked" badge + "Invite" button
  - [ ] Opens `TelegramInviteModal` on invite click
  - [ ] Refetches after modal closes

### Verification
- [ ] Admin saves bot token → `ProjectSettings` has `telegramBotUsername` row
- [ ] Admin opens Settings → Telegram → unlinked members appear in table
- [ ] Admin clicks "Invite" → modal with `t.me/...?start=CODE` deep link
- [ ] Target user receives in-app notification ("An admin has sent you a Telegram bot link...")
- [ ] Deep link → Telegram opens bot → `/start CODE` links the account
- [ ] Refresh admin table → user moves to linked section
- [ ] Expired/invalid code → bot responds with error message
- [ ] Already-linked user → API returns 400, modal shows error
