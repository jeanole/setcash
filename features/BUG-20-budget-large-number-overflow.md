# BUG-20: Very Large Numbers Overflow Cell Layout

## Metadata
| Field | Value |
|-------|-------|
| **ID** | BUG-20 |
| **Feature** | PROJ-8 |
| **Severity** | Medium |
| **Status** | Open |
| **Reported** | 2026-03-06 |
| **Fixed In** | 2026-03-06 |

## Description
Budget matrix cells do not handle very large numbers gracefully. Values like €999,999,999.99 may overflow the cell layout or cause display issues.

## Steps to Reproduce
1. Edit a cell
2. Enter very large amount (e.g., €999,999,999.99)
3. Observe cell display

## Expected Behavior
One of:
- Text truncates gracefully with ellipsis
- Tooltip shows full value on hover
- Font size reduces for large values
- Cell handles overflow without breaking layout

## Actual Behavior
No max-width or overflow handling; large values may break the layout or overflow cell boundaries.

## Files to Modify
- `nextjs/components/budget/BudgetMatrixCell.tsx` - Add overflow handling

## Acceptance Criteria
- [ ] Large numbers don't break cell layout
- [ ] Full value is accessible (tooltip or expansion)
- [ ] Works consistently across browsers

## Checklist
- [ ] Bug reproduced and confirmed
- [ ] Fix implemented
- [ ] Fix tested in development
- [ ] Bug report updated with "Fixed In" version
