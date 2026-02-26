# Frontend Implementation Checklist

Before marking frontend as complete:

## Component Library
- [ ] Checked project's component library for EVERY UI component needed
- [ ] No custom duplicates of existing components created
- [ ] Reused existing components where possible

## Design
- [ ] Design preferences clarified with user (if no mockups)
- [ ] Component architecture from Solution Architect followed

## Implementation
- [ ] All planned components implemented
- [ ] All components use the project's CSS approach consistently
- [ ] Loading states implemented (spinner/skeleton during data fetches)
- [ ] Error states implemented (user-friendly error messages)
- [ ] Empty states implemented ("No data yet" messages)

## Quality
- [ ] Responsive: Mobile (375px), Tablet (768px), Desktop (1440px)
- [ ] Accessibility: Semantic HTML, ARIA labels, keyboard navigation
- [ ] TypeScript: No errors (build passes)
- [ ] Linting: No warnings

## Verification (run before marking complete)
- [ ] Build passes without errors
- [ ] All acceptance criteria from feature spec addressed in UI
- [ ] `features/INDEX.md` status updated to "In Progress"

## Completion
- [ ] User has reviewed and approved the UI in browser
- [ ] Code committed to git
