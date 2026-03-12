# BUG-19: No Graceful Handling if Motive Deleted Mid-Session

## Metadata
| Field | Value |
|-------|-------|
| **ID** | BUG-19 |
| **Feature** | PROJ-8 |
| **Severity** | Low |
| **Status** | Open |
| **Reported** | 2026-03-06 |
| **Fixed In** | 2026-03-06 |

## Description
If an admin has the Budget Matrix open and another admin deletes a motive, attempting to save a cell for that deleted motive may cause a database error or unclear user feedback.

## Steps to Reproduce
1. Admin A opens Budget Matrix
2. Admin B deletes a motive
3. Admin A tries to save a cell for the deleted motive
4. Observe behavior

## Expected Behavior
Graceful handling:
- Foreign key constraint error is caught
- User receives clear error message: "Some items were modified by another user. Please refresh."
- Or: The cell is silently ignored and other updates proceed

## Actual Behavior
Uncertain - may cause unhandled database error or unclear feedback.

## Files to Modify
- `nextjs/app/api/budget-matrix/bulk-update/route.ts` - Add try/catch for FK violations

## Acceptance Criteria
- [x] Foreign key constraint errors are caught and handled
- [x] User receives clear error message
- [x] Other valid updates are not affected
- [x] Transaction handling is appropriate

## Checklist
- [x] Bug reproduced and confirmed
- [x] Fix implemented
- [x] Fix tested in development
- [x] Bug report updated with "Fixed In" version
