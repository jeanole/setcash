---
name: pipeline
description: Run the full QA → fix → deploy pipeline automatically for a feature. Handles bug routing, re-testing, and deployment with two human gates.
argument-hint: [PROJ-N]
user-invocable: true
model: opus
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Task
---

# Pipeline Orchestrator

Runs the full automated pipeline: **QA → fix (tagged bugs only) → re-QA → deploy.**

Two human gates:
- **Gate 1 — Auto-fix bugs?** Skippable in yolo mode
- **Gate 2 — Deploy to production?** Always human — never skipped

---

## Step 1: Detect Yolo Mode

Run: `echo $CLAUDE_CODE_DANGEROUSLY_SKIP_PERMISSIONS`

Yolo mode is active if the output is `true` OR if the arguments contain `--yolo`.

Announce: `"Pipeline starting for PROJ-N. Yolo mode: ON/OFF"`

---

## Step 2: Read Context

1. Read `features/INDEX.md`
2. Identify the feature spec: `features/PROJ-N-*.md` — read it
3. Run `git log --oneline -5` to see recent work

Announce the feature name and current status from INDEX.md.

Initialize a **round counter** at 1.

---

## Step 3: Run QA

Launch a QA subagent via the Task tool:

- **subagent_type:** `"QA Engineer"`
- **prompt:**

  > You are a QA Engineer and Red-Team Pen-Tester. Test **[PROJ-N]: [Feature Name]**.
  >
  > Steps:
  > 1. Read `features/INDEX.md` and `features/PROJ-N-*.md`
  > 2. Read `.claude/rules/security.md` and `.claude/rules/general.md`
  > 3. Read `.claude/skills/qa/test-template.md` for the results format
  > 4. Write a complete test plan to `.claude/plans/qa-plan.md` (all ACs, edge cases, security, regression). Assume: localhost:3000, default admin account.
  > 5. Execute all tests
  > 6. Document results in the feature spec under `## QA Test Results (Round N)` using the template
  > 7. **Tag every bug** with responsible skill: `[Frontend]` or `[Backend]`
  > 8. At the very end of your output, print this machine-readable line (fill in real numbers):
  >    `PIPELINE_RESULT: ready=YES bugs_frontend=0 bugs_backend=0`
  >    Set `ready=NO` if any Critical or High bugs exist.
  > 9. Commit: `test(PROJ-N): QA Round N results`
  >
  > NEVER fix bugs — only find, document, and prioritize.

Wait for the subagent to complete.

---

## Step 4: Parse QA Results

Read the `PIPELINE_RESULT:` line from the subagent output. Extract:
- `ready` — YES or NO
- `bugs_frontend` — count of [Frontend]-tagged bugs
- `bugs_backend` — count of [Backend]-tagged bugs

Also read the feature spec to get the bug titles and descriptions for passing to fix subagents.

**If `ready=YES`** → skip to Gate 2 (Step 7).

---

## Step 5: Gate 1 — Fix Decision

Announce the bug summary:
```
Round N complete. Found X bugs:
  [Frontend]: A bug(s)
  [Backend]:  B bug(s)
```

**If yolo mode is active** — announce: `"Yolo mode: auto-fixing all bugs. Launching fix subagent(s)."` Proceed to Step 6.

**If NOT yolo** — use `AskUserQuestion`:
> "Found X bugs (A Frontend, B Backend). Proceed with auto-fix?"

If user declines → exit:
> "Pipeline paused. Fix manually then re-run `/pipeline PROJ-N`."

---

## Step 6: Run Fix Subagent(s)

**Round limit check:** If round counter ≥ 3, stop:
> "Bugs still present after 3 QA rounds. Human review required. Run `/backend` or `/frontend` manually."

Extract the open bug list from the feature spec QA Results section (bug title + description + severity for each [Frontend] and [Backend] bug).

**If [Backend] bugs exist**, launch via Task tool:
- **subagent_type:** `"Backend Developer"`
- **prompt:**

  > You are a Backend Developer. Fix the following bugs found in QA for **PROJ-N**:
  >
  > [Paste each [Backend] bug: title, description, severity]
  >
  > Rules:
  > - Read `.claude/rules/backend.md` and `.claude/rules/general.md`
  > - Read the relevant source files before editing anything
  > - Fix each bug completely — do not partially fix
  > - Commit: `fix(PROJ-N): [bug titles] (pipeline auto-fix)`

**If [Frontend] bugs exist**, launch via Task tool:
- **subagent_type:** `"Frontend Developer"`
- **prompt:**

  > You are a Frontend Developer. Fix the following bugs found in QA for **PROJ-N**:
  >
  > [Paste each [Frontend] bug: title, description, severity]
  >
  > Rules:
  > - Read `.claude/rules/frontend.md` and `.claude/rules/general.md`
  > - Read the relevant source files before editing anything
  > - Fix each bug completely — do not partially fix
  > - Commit: `fix(PROJ-N): [bug titles] (pipeline auto-fix)`

**If both tags exist** — launch BOTH Task calls in the **same message** (parallel execution).

Wait for all fix subagents to complete. Increment the round counter. Return to Step 3.

---

## Step 7: Gate 2 — Deploy Confirm

**This gate is ALWAYS human — never skipped, even in yolo mode.**

Use `AskUserQuestion`:
> "All QA tests passed! Deploy PROJ-N to production now?"

If user declines → exit:
> "Pipeline paused before deploy. Run `/deploy PROJ-N` when ready."

---

## Step 8: Deploy

Read `.claude/skills/deploy/SKILL.md` and execute its full workflow inline:

1. Pre-deployment checks (build, lint, no secrets committed, env vars documented)
2. Merge to production branch: `git checkout production && git merge --no-ff main`
3. Push to trigger CI/CD: `git push origin production`
4. Verify pipeline passes (GitHub Actions)
5. Update feature spec with deployment date and production URL
6. Update `features/INDEX.md` — set status to **Deployed**
7. Create and push git tag: `git tag -a v1.X.0-PROJ-N -m "Deploy PROJ-N: [Feature Name]" && git push origin v1.X.0-PROJ-N`

Announce: `"Pipeline complete! PROJ-N is live in production."`

---

## Pipeline Summary

| Step | Action | Yolo behavior |
|------|--------|---------------|
| 1 | Detect yolo mode | — |
| 2 | Read context | — |
| 3 | Run QA subagent | Skips questions, full scope |
| 4 | Parse PIPELINE_RESULT | — |
| 5 | Gate 1 — fix? | **Auto-proceeds** |
| 6 | Run fix subagent(s) | Runs immediately, parallel if needed |
| 3↺ | Re-run QA (max 2 rounds) | Same as above |
| 7 | Gate 2 — deploy? | **Always asks human** |
| 8 | Deploy | Executes inline |
