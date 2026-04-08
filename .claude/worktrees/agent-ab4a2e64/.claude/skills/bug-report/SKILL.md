---
name: bug-report
description: Report a bug found during real usage. Creates a structured bug report linked to a feature and tracked in features/INDEX.md. Distinct from QA test results — use this for ad-hoc bugs discovered in production or during manual exploration.
argument-hint: [optional brief description of the bug]
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
model: sonnet
---

# Bug Reporter

## Role
You are a technical writer helping the user produce a well-structured, actionable bug report. Your goal: collect enough information that any developer can reproduce and fix the bug without needing to ask follow-up questions.

## Distinction from QA
This skill is for bugs discovered **during real use** — after features are deployed or during manual exploration outside of systematic QA. QA test results are written into feature specs by `/qa`. Bug reports here are standalone documents with their own ID and lifecycle (`features/` folder).

## Before Starting
**Announce:** "Starting bug report. Loading project context..."

1. Read `features/INDEX.md` to get the list of features (for linking) and find the "Next Available IDs" line
2. The "Next Available IDs" line has the format: `**Next Available IDs:** PROJ-N · BUG-N · CR-N` — use the BUG-N value from that line
3. If `features/INDEX.md` does not exist or has no "Next Available IDs" line: BUG-N = BUG-1

**Announce:** "Context loaded. Next ID: BUG-N. Let's capture the bug details."

## Workflow

### Phase 1/4 — Context Loading
[See above]

### Phase 2/4 — Information Gathering

Use `AskUserQuestion` for each question **in sequence** (not all at once) so the user is guided step by step:

1. "Which feature does this bug affect?" — present a numbered list from `features/INDEX.md`. Also offer: "0. Cross-feature" and "00. Unknown"
2. "What is the severity of this bug?" — choices with descriptions:
   - **Critical** – Security vulnerability, data loss, complete feature failure
   - **High** – Core functionality broken, blocking issue
   - **Medium** – Non-critical issue, workaround exists
   - **Low** – UX issue, cosmetic problem, minor inconvenience
3. "Give a short, clear title for this bug (1 line)."
4. "What did you expect to happen?"
5. "What actually happened?"
6. "Provide steps to reproduce (numbered list — paste as plain text)."
7. "What is your environment? (Browser, OS, screen size — or 'N/A')"
8. "Which skill should fix this?" — choices: [Frontend] / [Backend] / [Architecture] / [Deploy] / Not sure
9. "Any additional context, screenshots, or notes? (Press enter to skip)"

**Announce:** "Bug details captured. Creating bug report document..."

### Phase 3/4 — Document Creation

1. Derive kebab-case filename from the title (lowercase, spaces to hyphens, trim to ~5 words)
2. Write `features/BUG-N-filename.md` using the template from [template.md](template.md)
3. Append a new row to `features/INDEX.md` in the unified table, and increment the BUG-N value in the "Next Available IDs" line
4. If the user identified a specific PROJ-X feature:
   - Read the feature spec file
   - Find or create a `## Open Bug Reports` section at the bottom of the spec
   - Append a table row: `| [BUG-N](BUG-N-filename.md) | [Severity] | [Title] | Open |`

**Announce:** "Bug report BUG-N created at `features/BUG-N-filename.md`."

#### `features/INDEX.md` Unified Table Format

The unified table in `features/INDEX.md` has the following columns. Add the new bug row using Type = `Bug`:

```markdown
| ID | Type | Title | Status | Priority | Feature | Date |
|----|------|-------|--------|----------|---------|------|
| BUG-N | Bug | [Title] | Open | [Severity] | PROJ-X or — | [YYYY-MM-DD] |
```

The "Next Available IDs" line must be updated to increment BUG-N by 1:

```markdown
**Next Available IDs:** PROJ-N · BUG-N · CR-N
```

#### `## Open Bug Reports` block in feature spec

```markdown
## Open Bug Reports

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| [BUG-N](BUG-N-filename.md) | High | Short title here | Open |
```

### Phase 4/4 — Git Commit and Handoff

Commit message:
```
bug(BUG-N): Report [short title]

References: PROJ-X
Severity: [severity]
Skill: [skill tag]
```

**Handoff message:**
> "Bug BUG-N has been logged at `features/BUG-N-filename.md`.
> To fix it: run `/[frontend|backend]` and reference the bug report.
> After fixing, update the **Status** to `Resolved` and fill in the **Fixed In** field in the bug report file."

## Checklist
- [ ] `features/INDEX.md` read for feature list and next BUG-N
- [ ] All 9 questions answered
- [ ] `features/BUG-N-filename.md` created with all sections filled
- [ ] `features/INDEX.md` updated with new row and incremented BUG-N in "Next Available IDs"
- [ ] Feature spec updated with `## Open Bug Reports` cross-reference (if PROJ-X identified)
- [ ] Git committed
- [ ] User informed of next steps
