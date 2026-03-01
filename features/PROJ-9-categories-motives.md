# PROJ-9: Categories & Motives Admin Pages

## Status: Planned
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

## Dependencies
- Requires: PROJ-5 (auth — admin-only pages)
- Requires: PROJ-6 (PostgreSQL data)

## User Stories
- As an admin, I want to create, rename, and delete motives for my project so that bills
  can be correctly allocated.
- As an admin, I want to create, rename, and delete categories for my project so that spending
  can be organised by type.
- As an admin, I want the default motive ("Default") and default category ("Uncategorized")
  to be protected from deletion so that the system always has a fallback.
- As a user, I want to see the available motives and categories when filling in a bill so that
  I can select the right allocation.

## Acceptance Criteria
- [ ] `/app/(protected)/settings/motives/page.tsx` — list of project motives with inline rename
      and delete; add-new form at top
- [ ] `/app/(protected)/settings/categories/page.tsx` — same pattern for categories
- [ ] "Default" motive and "Uncategorized" category rows show a lock icon; rename and delete
      buttons are disabled with tooltip "Default — cannot be deleted"
- [ ] Inline rename: click motive name → input field appears; confirm on Enter / blur → saves
      via Server Action
- [ ] Delete button shows a confirmation popover before deleting; disabled if motive/category
      is referenced by any existing bill allocation
- [ ] Adding a new motive/category: name input + submit at top of list; name must be unique
      within the project (case-insensitive)
- [ ] All mutations are project-scoped (admin cannot affect another project's motives)
- [ ] Changes reflected immediately in the bill upload form's allocation widget without full
      page reload (revalidatePath or optimistic update)
- [ ] Empty state when no custom motives exist (only "Default" row shown)

## Edge Cases
- Motive/category name already exists → inline validation error "Name already in use"
- Deleting a motive that has bill allocations → show error "Cannot delete — used by N bill(s)"
- Name with only whitespace → trimmed; if empty after trim, rejected with "Name cannot be empty"
- Concurrent add of same name by two admins → DB unique constraint catches it; surface as
  "Name already in use" error

## Technical Requirements
- Server Actions for create, update, delete
- `revalidatePath('/settings/motives')` after mutations to refresh server component cache
- Branch: `to_nextjs`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
