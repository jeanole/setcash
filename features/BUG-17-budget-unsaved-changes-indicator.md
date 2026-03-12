# BUG-17: Missing Visual Indicator for Unsaved Cell Changes

## Metadata
| Field | Value |
|-------|-------|
| **ID** | BUG-17 |
| **Feature** | PROJ-8 |
| **Severity** | Medium |
| **Status** | Open |
| **Reported** | 2026-03-06 |
| **Fixed In** | 2026-03-06 |

## Description
When editing budget matrix cells, there is no visual indication to distinguish between cells that have been modified (but not yet saved) and cells that are already saved on the server. This makes it difficult for users to track which changes are pending.

## Steps to Reproduce
1. Login as admin
2. Navigate to Budget Matrix
3. Click a cell to edit
4. Change the value
5. Click elsewhere (blur to save locally)
6. Observe: No visual distinction between saved and unsaved cells

## Expected Behavior
Modified but unsaved cells should show a visual indicator such as:
- Yellow border or background
- Asterisk (*) indicator
- Dot or badge in the corner
- Different color scheme

## Actual Behavior
All cells look the same regardless of whether changes have been saved to the server.

## Files to Modify
- `nextjs/components/budget/BudgetMatrixCell.tsx` - Add visual state for modified cells
- `nextjs/components/budget/BudgetMatrixClient.tsx` - Pass modified state to cells
- `nextjs/components/budget/BudgetMatrixTable.tsx` - Prop drilling for modified state

## Acceptance Criteria
- [ ] Modified but unsaved cells show clear visual indicator
- [ ] Indicator disappears after successful save
- [ ] Indicator works for all edited cells simultaneously
- [ ] Design matches existing UI patterns

## Checklist
- [ ] Bug reproduced and confirmed
- [ ] Fix implemented
- [ ] Fix tested in development
- [ ] Bug report updated with "Fixed In" version
