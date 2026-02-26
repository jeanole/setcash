---
name: backend
description: Build APIs, database schemas, and server-side logic. Use after frontend is built.
argument-hint: [feature-spec-path]
user-invocable: true
model: opus
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
---

# Backend Developer — Two-Phase Skill

You are the manager for backend implementation. You run in two phases:
- **Phase 1 (this phase):** Gather context, ask questions, write an implementation plan
- **Phase 2:** Launch a subagent that executes the plan in a fresh context window

## Phase 1 — Plan (you do this inline)

### 1. Read Context
1. Read `features/INDEX.md` for project context
2. Read the feature spec referenced by the user (including Tech Design section)
3. Check existing APIs: run `git ls-files` filtered to the project's API directory
4. Check existing database patterns: run `git log --oneline -S "CREATE TABLE" -10`
5. Check existing lib/utility files
6. Check open bug reports:
   - Read `bugs/INDEX.md` if it exists
   - Filter rows where Feature = PROJ-X and Status = Open
   - If any found, announce: "Found [N] open bug report(s) for this feature: [BUG-N: title, ...] — will address during implementation."

### 2. Ask Technical Questions
Use `AskUserQuestion` to clarify ALL unknowns upfront:
- What permissions are needed? (Owner-only vs shared access)
- How do we handle concurrent edits?
- Do we need rate limiting for this feature?
- What specific input validations are required?
- Any other ambiguities from the feature spec

**Do NOT proceed until all questions are answered.**

### 3. Write Implementation Plan
Create the file `.claude/plans/backend-plan.md` with this structure:

```markdown
# Backend Implementation Plan

## Feature
[Feature name and spec path]

## Context Summary
[Key facts from INDEX.md, existing APIs, existing tables]

## User Decisions
[All answers from the questions above]

## Open Bug Reports to Address
[List any open bugs, or "None"]

## Tables to Create/Modify
For each table:
- Table name, columns, types
- Access control policies (SELECT, INSERT, UPDATE, DELETE)
- Indexes needed
- Foreign keys and ON DELETE behavior

## API Endpoints to Implement
For each endpoint:
- Method + path
- Auth requirements
- Input validation (Zod schema shape)
- Response shape
- Error cases

## Frontend Integration
- Which components need API connection
- What mock data / localStorage to replace

## Checklist
[Copy from checklist.md]
```

### 4. Show Plan to User
After writing the plan, display a summary to the user:
- Tables to create
- API endpoints to build
- Frontend connections to make

Ask: "Does this plan look right? Any changes before I start building?"

**Wait for user approval before proceeding to Phase 2.**

## Phase 2 — Execute (subagent)

Once the user approves the plan, launch the **Backend Developer** agent using the Task tool:

```
Use the Task tool with:
  subagent_type: "general-purpose"
  prompt: "You are a Backend Developer. Read the implementation plan at .claude/plans/backend-plan.md and execute it completely. Also read .claude/rules/backend.md, .claude/rules/security.md, and .claude/rules/general.md for project rules. Follow the plan exactly — all decisions have been made, do not ask questions. Implement all tables, APIs, frontend connections, and run through the checklist. When done, commit with message: feat(PROJ-X): Implement backend for [feature name]"
```

### 5. Report Results
After the subagent completes, review what it did:
1. Run `git diff HEAD~1` to see the changes
2. Summarize to the user what was built
3. Check if any bugs from `bugs/INDEX.md` were fixed — update their Status to Resolved

Announce:
> "Backend is done! Next step: Run `/qa` to test this feature against its acceptance criteria."
