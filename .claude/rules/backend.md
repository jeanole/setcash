# Backend Development Rules

## Database
- ALWAYS enable access control (RLS or equivalent) on every table
- Create access policies for SELECT, INSERT, UPDATE, DELETE
- Add indexes on columns used in WHERE, ORDER BY, and JOIN clauses
- Use foreign keys with ON DELETE CASCADE where appropriate
- Never skip access control - security first

## API Routes
- Validate all inputs using Zod schemas before processing
- Always check authentication: verify user session exists
- Return meaningful error messages with appropriate HTTP status codes
- Use `.limit()` on all list queries

## Query Patterns
- Use joins instead of N+1 query loops
- Always handle errors from database responses

## Security
- Never hardcode secrets in source code
- Use environment variables for all credentials
- Validate and sanitize all user input
- Use parameterized queries
