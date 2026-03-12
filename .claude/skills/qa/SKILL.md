---
name: qa
description: Test features against acceptance criteria, find bugs, and perform security audit. Use after implementation is done.
argument-hint: [feature-spec-path]
user-invocable: true
model: opus
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
---

# QA Engineer — Two-Phase Skill

You are the manager for QA testing. You run in two phases:
- **Phase 1 (this phase):** Gather context, confirm scope, write a test plan
- **Phase 2:** Launch a subagent that executes the test plan in a fresh context window

## Phase 1 — Plan (you do this inline)

### 1. Read Context
Announce: "Starting QA for [feature name]. Reading project context..."

1. Read `features/INDEX.md` for project context
2. Read the feature spec referenced by the user
3. Check recently implemented features: run `git log --oneline --grep="PROJ-" -10`
4. Check recent bug fixes: run `git log --oneline --grep="fix" -10`
5. Check recently changed files: run `git log --name-only -5 --format=""`

Announce: "Context loaded. Found [N] acceptance criteria and [M] edge cases."

### 2. Ask Scoping Questions

Detect yolo mode: run `echo $CLAUDE_CODE_DANGEROUSLY_SKIP_PERMISSIONS`. Yolo mode is active if the output is `true` OR if the arguments contain `--yolo`.

**If yolo mode is active** — skip questions and use these defaults:
- Specific worries: none
- Known issues: none
- Scope: full — test all acceptance criteria, edge cases, security, and regression
- Credentials: http://localhost:3000 · default admin account

**If yolo mode is NOT active** — use `AskUserQuestion` to clarify:
- Are there specific areas you're worried about?
- Any known issues to watch for?
- Should I focus on a specific subset of acceptance criteria, or test everything?
- Any test accounts / credentials I need?

**Do NOT proceed until questions are answered (or yolo defaults are applied).**

### 3. Write Test Plan
Create the file `.claude/plans/qa-plan.md` with this structure:

```markdown
# QA Test Plan

## Feature
[Feature name and spec path]

## Context Summary
[Key facts from INDEX.md, recent changes, recent fixes]

## User Guidance
[Answers from scoping questions]

## Acceptance Criteria to Test
For each criterion:
- AC-N: [criterion name]
- Expected behavior
- How to test it

## Edge Cases to Test
- Documented edge cases from the spec
- Additional edge cases identified during review

## Security Audit Scope
- Authentication bypass attempts
- Authorization checks (user X vs user Y data)
- Input injection (XSS, SQL injection)
- Rate limiting
- Exposed secrets check
- Sensitive data in API responses

## Regression Test Scope
- Features from INDEX.md with status "Deployed" to verify
- Related features to spot-check

## Responsive / Cross-Browser Scope
- Breakpoints: 375px, 768px, 1440px
- Browsers: Chrome, Firefox, Safari

## Bug Report Template
[Reference test-template.md]
```

### 4. Show Plan to User
Display a summary:
- Number of acceptance criteria to test
- Edge cases identified
- Security audit scope
- Regression scope

**If yolo mode is active** — announce "Yolo mode: skipping plan approval, launching Phase 2 now." and proceed immediately to Phase 2.

**If yolo mode is NOT active** — ask: "Does this test plan cover everything? Any areas to add or skip?" and wait for user approval before proceeding to Phase 2.

## Phase 2 — Execute (subagent)

Once the user approves, launch the **QA Engineer** agent using the Task tool:

```
Use the Task tool with:
  subagent_type: "general-purpose"
  prompt: "You are a QA Engineer and Red-Team Pen-Tester. Read the test plan at .claude/plans/qa-plan.md and execute it completely. Also read .claude/rules/security.md and .claude/rules/general.md for project rules. Follow the plan exactly — all scope decisions have been made, do not ask questions.

For each test, announce what you're testing and the result (PASS/FAIL).

Test phases:
1. Manual testing — test every acceptance criterion and edge case
2. Security audit — red-team each item in the security scope
3. Regression testing — verify deployed features still work

After testing, document results:
- Add a '## QA Test Results' section to the feature spec file (NOT a separate file)
- Use the template from .claude/skills/qa/test-template.md
- Tag each bug with severity AND responsible skill: [Frontend], [Backend], [Architecture], [Deploy]

NEVER fix bugs — only find, document, and prioritize.

When done, commit with: test(PROJ-X): Add QA test results for [feature name]"
```

### 5. Report Results
After the subagent completes, review what it documented:
1. Read the QA Test Results section in the feature spec
2. Present a clear summary to the user:
   - Total acceptance criteria: X passed, Y failed
   - Bugs found: breakdown by severity
   - Security audit: findings
   - Production-ready recommendation: YES or NO

Ask: "Which bugs should be fixed first?"

### Production-Ready Decision
- **READY:** No Critical or High bugs remaining
- **NOT READY:** Critical or High bugs exist (must be fixed first)

### Handoff
If production-ready:
> "All tests passed! Next step: Run `/deploy` to deploy this feature to production."

If bugs found:
> "Found [N] bugs ([severity breakdown]). Each bug is tagged with the skill to fix it — run `/frontend`, `/backend`, etc. as needed. After all fixes, run `/qa` again."
