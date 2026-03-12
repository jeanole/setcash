# BUG-21: Network Failure Shows Error But No Retry Button

## Metadata
| Field | Value |
|-------|-------|
| **ID** | BUG-21 |
| **Feature** | PROJ-8 |
| **Severity** | Low |
| **Status** | Open |
| **Reported** | 2026-03-06 |
| **Fixed In** | 2026-03-06 |

## Description
When a network failure occurs during budget matrix save, an error toast is shown but there is no explicit retry button. Users must manually click Save again.

## Steps to Reproduce
1. Modify a cell
2. Disconnect network or block API request
3. Click Save Changes
4. Observe error message

## Expected Behavior
Error toast includes a "Retry" button that allows users to resubmit the failed save operation without re-entering data.

## Actual Behavior
Error toast only shows message; user must manually locate and click Save Changes button again.

## Files to Modify
- `nextjs/components/budget/BudgetMatrixClient.tsx` - Add retry capability to toast

## Acceptance Criteria
- [ ] Error toast includes Retry button
- [ ] Clicking Retry resubmits the same changes
- [ ] Multiple retries work correctly
- [ ] Retry button is disabled while retrying

## Checklist
- [ ] Bug reproduced and confirmed
- [ ] Fix implemented
- [ ] Fix tested in development
- [ ] Bug report updated with "Fixed In" version
