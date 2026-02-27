# Backend Implementation Checklist

## Core Checklist
- [ ] Checked existing tables/APIs via git before creating new ones
- [ ] Database tables created with migrations
- [ ] Access control enabled on ALL new tables
- [ ] Access policies created for SELECT, INSERT, UPDATE, DELETE
- [ ] Indexes created on performance-critical columns
- [ ] Foreign keys set with appropriate ON DELETE behavior
- [ ] All planned API endpoints implemented
- [ ] Authentication verified (no access without valid session)
- [ ] Input validation with Zod on all POST/PUT requests
- [ ] Meaningful error messages with correct HTTP status codes
- [ ] No TypeScript errors in API routes
- [ ] All endpoints tested manually
- [ ] No hardcoded secrets in source code
- [ ] Frontend connected to real API endpoints
- [ ] User has reviewed and approved

## Verification (run before marking complete)
- [ ] Build passes without errors
- [ ] All acceptance criteria from feature spec addressed in API
- [ ] All API endpoints return correct status codes (test with curl or browser)
- [ ] `features/INDEX.md` status updated to "In Progress"
- [ ] Code committed to git

## Performance Checklist
- [ ] All frequently filtered columns have indexes
- [ ] No N+1 queries (use joins instead of loops)
- [ ] All list queries use `.limit()`
- [ ] Zod validation on all write endpoints
- [ ] Slow queries cached where appropriate (optional for MVP)
- [ ] Rate limiting on public-facing APIs (optional for MVP)
