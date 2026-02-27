---
name: code-review
description: Perform comprehensive language-agnostic code review checking for logging, error handling, type safety, production readiness, performance, security, and architecture patterns.
---

# Code Review Task

Perform comprehensive code review. Be thorough but concise.

## Check For:

**Security** - Auth checked, inputs validated, no SQL injection, XSS, or hardcoded secrets
**Error Handling** - Proper error catching, meaningful error messages, graceful degradation
**Performance** - No obvious bottlenecks, efficient algorithms, proper resource cleanup
**Production Readiness** - No debug code, no TODOs, proper logging with context
**Type Safety** - Appropriate type usage for the language (strong typing where available)
**Architecture** - Follows existing patterns, code in correct location, proper separation of concerns
**Code Quality** - Clear naming, DRY principles, readable logic
**Edge Cases** - Null/nil handling, empty states, boundary conditions

## Output Format

### ✅ Looks Good
- [Item 1]
- [Item 2]

### ⚠️ Issues Found
- **[Severity]** [File:line] - [Issue description]
  - Fix: [Suggested fix]

### 📊 Summary
- Files reviewed: X
- Critical issues: X
- Warnings: X

## Severity Levels
- **CRITICAL** - Security, data loss, crashes
- **HIGH** - Bugs, performance issues

## How to Use This Skill

Invoke with `/code-review` or when the user asks to:
- "Review this code"
- "Check my changes"
- "Review PR"
- "Look for issues in [file/directory]"

## What to Review

By default, review recently changed files:
```bash
git diff --name-only HEAD
```

Or review specific files/directories if user specifies them.

## Review Process

1. **Identify scope** - What files need review?
2. **Read the code** - Use Read tool to examine files
3. **Check each category** - Go through all 8 categories systematically
4. **Document findings** - Use the output format above
5. **Prioritize** - Critical issues first, then high priority
6. **Be actionable** - Provide specific fixes, not just complaints

## Additional Checks

When reviewing, also consider:
- **Naming** - Clear, consistent variable/function names
- **DRY** - No repeated code that should be abstracted
- **Comments** - Complex logic explained, but code mostly self-documenting
- **Tests** - Changes covered by tests where appropriate
- **Accessibility** - UI changes meet a11y standards
- **Mobile** - Responsive design considerations
- **Edge Cases** - Null checks, empty states, error states

## Skip If:

Don't create issues for:
- Code style that linters would catch (spacing, quotes, etc.)
- Minor naming preferences (unless truly confusing)
- Over-engineering concerns when simplicity was requested
- Issues in unchanged code (unless related to changes)

## Pro Tips

- Focus on issues that matter - security, bugs, performance
- Suggest concrete improvements with code examples
- Acknowledge good patterns you see
- Consider the PR context - is this a quick fix or major feature?
- Balance thoroughness with practicality
