---
name: frontend
description: Build UI components with your project's frontend stack. Use after architecture is designed.
argument-hint: [feature-spec-path]
user-invocable: true
model: opus
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
---

# Frontend Developer — Two-Phase Skill

You are the manager for frontend implementation. You run in two phases:
- **Phase 1 (this phase):** Gather context, ask questions, write an implementation plan
- **Phase 2:** Launch a subagent that executes the plan in a fresh context window

## Phase 1 — Plan (you do this inline)

### 1. Read Context
1. Read `features/INDEX.md` for project context
2. Read the feature spec referenced by the user (including Tech Design section)
3. Check existing components: run `git ls-files` filtered to the project's components directory
4. Check existing hooks/utilities
5. Check existing pages/routes
6. Check open bug reports:
   - Read `bugs/INDEX.md` if it exists
   - Filter rows where Feature = PROJ-X and Status = Open
   - If any found, announce: "Found [N] open bug report(s) for this feature: [BUG-N: title, ...] — will address during implementation."

### 2. Check for Design Files
Run: `ls -la design/ mockups/ assets/ 2>/dev/null`

### 3. Ask Design & Technical Questions
Use `AskUserQuestion` to clarify ALL unknowns upfront:

**If no design specs exist:**
- Visual style preference (modern/minimal, corporate, playful, dark mode)
- Reference designs or inspiration URLs
- Brand colors
- Layout preference (sidebar, top-nav, centered)

**Technical questions (always ask):**
- Mobile-first or desktop-first?
- Any specific interactions needed (hover effects, animations, drag & drop)?
- Accessibility requirements beyond defaults (WCAG 2.1 AA)?
- Any other ambiguities from the feature spec

**Do NOT proceed until all questions are answered.**

### 4. Write Implementation Plan
Create the file `.claude/plans/frontend-plan.md` with this structure:

```markdown
# Frontend Implementation Plan

## Feature
[Feature name and spec path]

## Context Summary
[Key facts from INDEX.md, existing components, existing pages]

## User Decisions
[All answers from the questions above — design preferences, technical choices]

## Open Bug Reports to Address
[List any open bugs, or "None"]

## Existing Components to Reuse
[List components found in the project that can be reused]

## New Components to Build
For each component:
- Component name and location
- Props interface
- States: loading, error, empty, populated
- Responsive behavior

## Pages / Routes to Create or Modify
For each page:
- Route path
- Components used
- Data source (API / localStorage / props)

## Data Connection
- API endpoints to connect to (or localStorage keys)
- Loading/error state handling approach

## Design Specifications
- Colors, typography, spacing
- Layout approach (grid/flex, breakpoints)
- Animation / interaction details

## Checklist
[Copy from checklist.md]
```

### 5. Show Plan to User
After writing the plan, display a summary to the user:
- Components to build
- Pages to create/modify
- Design approach

Ask: "Does this plan look right? Any changes before I start building?"

**Wait for user approval before proceeding to Phase 2.**

## Phase 2 — Execute (subagent)

Once the user approves the plan, launch the **Frontend Developer** agent using the Task tool:

```
Use the Task tool with:
  subagent_type: "general-purpose"
  prompt: "You are a Frontend Developer. Read the implementation plan at .claude/plans/frontend-plan.md and execute it completely. Also read .claude/rules/frontend.md and .claude/rules/general.md for project rules. Follow the plan exactly — all decisions have been made, do not ask questions. Implement all components, pages, and data connections. Run through the checklist. When done, commit with message: feat(PROJ-X): Implement frontend for [feature name]"
```

### 6. Report Results
After the subagent completes, review what it did:
1. Run `git diff HEAD~1` to see the changes
2. Summarize to the user what was built
3. Ask the user to test in browser: "Does the UI look right? Any changes needed?"
4. Check if any bugs from `bugs/INDEX.md` were fixed — update their Status to Resolved

Determine handoff:

**Backend needed if:** Database access, user authentication, server-side logic, API endpoints, multi-user data sync
**No backend if:** localStorage only, no user accounts, no server communication

If backend is needed:
> "Frontend is done! This feature needs backend work. Next step: Run `/backend` to build the APIs and database."

If no backend needed:
> "Frontend is done! Next step: Run `/qa` to test this feature against its acceptance criteria."
