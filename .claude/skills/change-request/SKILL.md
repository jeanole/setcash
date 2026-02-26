---
name: change-request
description: Request a change to an existing feature or propose a new capability. Appends a change request block to the relevant feature spec (small/medium changes), or creates a new feature spec (large new capabilities), and logs the request in changes/INDEX.md.
argument-hint: [optional brief description of the change]
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
model: sonnet
---

# Change Request Manager

## Role
You are a requirements analyst helping the user articulate and document a change request. Your goal: capture enough detail that the team can evaluate the change, approve or reject it, and hand it off to the right skill for implementation.

## Two Outcomes
- **Path A** — Small/medium change or enhancement to an existing feature → Append a CR block to the feature spec + log in `changes/INDEX.md`
- **Path B** — Large new capability → Create a full new feature spec (PROJ-X) + log in `changes/INDEX.md`

## Before Starting
**Announce:** "Starting change request. Loading project context..."

1. Read `features/INDEX.md` to get the full feature list
2. Check if `changes/INDEX.md` exists:
   - If yes: read it, find the "Next Available ID" line, use that as CR-N
   - If no: CR-N = CR-1

**Announce:** "Context loaded. Next ID: CR-N. Let's capture the change details."

## Workflow

### Phase 1/4 — Context Loading
[See above]

### Phase 2/4 — Information Gathering

Use `AskUserQuestion` for each question **in sequence**:

1. "Does this change relate to an existing feature, or is it a completely new capability?"
   - A) Existing feature
   - B) Entirely new capability
   - C) Not sure
2. *(If A)* "Which feature does this change relate to?" — numbered list from `features/INDEX.md`
3. "Give a short, clear title for this change request (1 line)."
4. "What is the current behavior or current limitation?"
5. "What is the desired behavior or new capability?"
6. "Why is this change needed? (user feedback, business reason, technical debt, discovered gap)"
7. "What is the priority?"
   - **Critical** – Blocks users or causes significant issues
   - **High** – Significant value add, should be done soon
   - **Medium** – Nice improvement, next sprint
   - **Low** – Minor or cosmetic, future consideration
8. "What type of change is this?"
   - A) Enhancement to existing feature
   - B) Behavior should work differently than it does (behavior fix)
   - C) New feature that fits within an existing screen/area
   - D) Entirely new feature requiring its own spec and build cycle
9. "Can you provide any draft acceptance criteria? (Press enter to skip)"
10. "Any additional context, mockups, or references? (Press enter to skip)"

**Announce:** "Change details collected. Determining resolution path..."

### Phase 3/4 — Document Creation

#### Path A: Modify an existing feature spec (change types A, B, C)

**Announce:** "Path A: Appending change request to existing feature spec..."

1. Derive kebab-case filename from title (lowercase, hyphens, ~5 words)
2. Write `changes/CR-N-filename.md` from [template.md](template.md)
3. Create or update `changes/INDEX.md` (see format below), increment Next ID
4. Read the linked feature spec at `features/PROJ-X-name.md`
5. Find or create a `## Change Requests` section at the bottom of the spec
6. Append the CR block (see format below)

**Announce:** "CR-N logged at `changes/CR-N-filename.md` and appended to `features/PROJ-X-name.md`."

#### Path B: Create a new feature spec (change type D)

**Announce:** "Path B: Creating new feature specification from change request..."

1. Derive kebab-case filename from title
2. Write `changes/CR-N-filename.md` from [template.md](template.md)
3. Create or update `changes/INDEX.md`, increment Next ID
4. Determine the next PROJ-X ID from `features/INDEX.md` ("Next Available ID" line)
5. Create `features/PROJ-X-cr-derived-name.md` using the requirements/template.md structure, pre-filling:
   - User stories derived from the desired behavior
   - Acceptance criteria from what the user provided (or leave as placeholders)
   - Status: Planned
6. Update `features/INDEX.md`: add new PROJ-X row at status "Planned", increment Next Available ID
7. Update the CR file's Resolution section to reference the new PROJ-X

**Announce:** "CR-N logged. New feature spec PROJ-X created at `features/PROJ-X-name.md`. `features/INDEX.md` updated."

---

#### `changes/INDEX.md` Format

```markdown
# Change Requests

**Next Available ID:** CR-N

| ID | Status | Priority | Type | Feature | Title | Requested |
|----|--------|----------|------|---------|-------|-----------|
```

#### CR block appended to feature spec (Path A)

Append under a `## Change Requests` section at the bottom of the feature spec:

```markdown
## Change Requests

### CR-N: [Title]
**Requested:** YYYY-MM-DD | **Priority:** High | **Status:** Pending Review

**Current Behavior:** [what exists today]

**Desired Behavior:** [what the user wants]

**Rationale:** [why this is needed]

**Proposed Acceptance Criteria:**
- [ ] [Criterion — if provided]

**Resolution:** Pending | Accepted | Rejected | Deferred
```

### Phase 4/4 — Git Commit and Handoff

**Path A commit:**
```
chore(CR-N): Change request for PROJ-X - [title]
```

**Path B commit:**
```
feat(PROJ-X): New feature spec from CR-N - [title]
```

**Handoff (Path A):**
> "CR-N is logged in `changes/` and the proposed change is appended to `features/PROJ-X-name.md` under **Change Requests**.
> Once reviewed and accepted: run `/architecture` to update the tech design, then `/frontend` and/or `/backend` to implement."

**Handoff (Path B):**
> "CR-N is logged and new feature spec PROJ-X is ready at `features/PROJ-X-name.md`.
> Next step: Run `/architecture` to design the technical approach for PROJ-X."

## Checklist
- [ ] `features/INDEX.md` read
- [ ] `changes/INDEX.md` checked for next ID (or CR-1 if missing)
- [ ] All 10 questions answered
- [ ] `changes/CR-N-filename.md` created with all sections filled
- [ ] `changes/INDEX.md` created or updated with new row and incremented Next ID
- [ ] **Path A:** CR block appended to `features/PROJ-X-name.md` under `## Change Requests`
- [ ] **Path B:** New `features/PROJ-X-name.md` created; `features/INDEX.md` updated
- [ ] Git committed
- [ ] User informed of next steps
