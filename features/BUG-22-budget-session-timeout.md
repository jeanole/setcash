# BUG-22: Session Timeout During Edit Not Handled Gracefully

## Metadata
| Field | Value |
|-------|-------|
| **ID** | BUG-22 |
| **Feature** | PROJ-8 |
| **Severity** | Medium |
| **Status** | Open |
| **Reported** | 2026-03-06 |
| **Fixed In** | 2026-03-06 |

## Description
When a user's session expires while editing the budget matrix, attempting to save results in a generic error message and changes may be lost.

## Steps to Reproduce
1. Edit multiple cells (don't save)
2. Let session expire or delete session cookie
3. Try to save
4. Observe behavior

## Expected Behavior
- User is redirected to login with return URL
- Pending changes are preserved (localStorage or query param)
- After login, user returns to budget matrix with changes intact

## Actual Behavior
Generic error message displayed; changes may be lost.

## Files to Modify
- `nextjs/components/budget/BudgetMatrixClient.tsx` - Handle 401 on save, preserve changes
- May need localStorage or URL-based state persistence

## Acceptance Criteria
- [ ] 401 response on save triggers redirect to login
- [ ] Return URL includes current page
- [ ] Unsaved changes are preserved
- [ ] After re-login, changes are restored

## Checklist
- [ ] Bug reproduced and confirmed
- [ ] Fix implemented
- [ ] Fix tested in development
- [ ] Bug report updated with "Fixed In" version
