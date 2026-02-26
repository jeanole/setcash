# General Project Rules

## Feature Tracking
- All work items (features, bugs, change requests) are tracked in a single unified table in `features/INDEX.md` — read it before starting any work
- Feature specs live in `features/PROJ-X-feature-name.md` (one file per feature, Single Responsibility)
- Bug reports live in `features/BUG-N-description.md`
- Change requests are appended inline to the relevant feature spec under `## Change Requests` — no separate CR files
- IDs are sequential per type: `features/INDEX.md` has a "Next Available IDs" line with format `PROJ-N · BUG-N · CR-N`
- Never combine multiple independent functionalities in one spec

## Git Conventions
- Commit format: `type(PROJ-X): description`
- Types: feat, fix, refactor, test, docs, deploy, chore
- Check existing features before creating new ones: `ls features/ | grep PROJ-`
- Check existing components before building: `git ls-files` filtered to your project's components directory
- Check existing APIs before building: `git ls-files` filtered to your project's API directory

## Human-in-the-Loop
- Always ask for user approval before finalizing deliverables
- Present options using clear choices rather than open-ended questions
- Never proceed to the next workflow phase without user confirmation

## Status Updates
- Update `features/INDEX.md` when feature status changes
- Update the feature spec header status field
- Valid statuses: Planned, In Progress, In Review, Deployed, Change Requested
- `Change Requested` means a CR has been logged against the feature and it needs review before the next build cycle

## File Handling
- ALWAYS read a file before modifying it - never assume contents from memory
- After context compaction, re-read files before continuing work
- When unsure about current project state, read `features/INDEX.md` first
- Run `git diff` to verify what has already been changed in this session
- Never guess at import paths, component names, or API routes - verify by reading

## Handoffs Between Skills
- After completing a skill, suggest the next skill to the user
- Format: "Next step: Run `/skillname` to [action]"
- Handoffs are always user-initiated, never automatic
