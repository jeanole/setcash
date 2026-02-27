# Testing Rules

## Testing Philosophy
- Tests are documentation of expected behavior
- Write tests that would catch real bugs
- Tests should be fast, isolated, and deterministic
- Test behavior, not implementation details

## Test Coverage
- **All new features must have tests**
- Test happy paths and error cases
- Test edge cases and boundary conditions
- Don't aim for 100% coverage, aim for meaningful coverage
- Focus on testing critical paths

## Types of Tests

### Unit Tests
- Test individual functions/methods in isolation
- Mock external dependencies
- Fast execution (milliseconds)
- Use for business logic, utilities, helpers

### Integration Tests
- Test components working together
- Test API endpoints end-to-end
- Test database operations
- Use for critical workflows

### End-to-End (E2E) Tests
- Test full user flows in browser
- Use sparingly (slow, brittle)
- Focus on critical user journeys
- Use for smoke tests before deployment

## Test Organization
- Mirror source code structure in test files
- Group related tests using describe blocks
- Use clear, descriptive test names
- One assertion per test (when possible)

## Test Naming
- Use "should" or "it" format: "should return error when input is invalid"
- Include the scenario being tested
- Include expected behavior
- Example: `it('should throw error when user is not authenticated')`

## What to Test
✅ **Do test:**
- Business logic and calculations
- Error handling and edge cases
- API endpoints (request/response)
- Data validation
- Authentication/authorization
- Critical user workflows

❌ **Don't test:**
- Third-party library internals
- Framework behavior (trust the framework)
- Trivial getters/setters
- Pure UI styling (use visual regression tools instead)

## Test Data
- Use realistic test data
- Create test fixtures for complex data
- Clean up test data after tests run
- Never use production data in tests
- Use factories/builders for test objects

## Mocking
- Mock external services (APIs, databases)
- Don't over-mock (makes tests brittle)
- Mock at boundaries, not everywhere
- Keep mocks simple and realistic

## Test Maintenance
- Update tests when requirements change
- Delete tests for removed features
- Refactor tests when they become unclear
- Fix flaky tests immediately or remove them

## Running Tests
- Run tests before committing
- Run full test suite before pushing
- Tests must pass in CI/CD pipeline
- Never skip failing tests

## TDD (Test-Driven Development)
When appropriate, use TDD:
1. Write failing test
2. Write minimal code to pass test
3. Refactor while keeping tests green

## Performance Testing
- Test performance-critical code paths
- Set performance budgets
- Use profiling tools to identify bottlenecks
- Test with realistic data volumes

## Testing Checklist
- [ ] All new features have tests
- [ ] Tests cover happy path
- [ ] Tests cover error cases
- [ ] Tests cover edge cases
- [ ] All tests pass locally
- [ ] No skipped or disabled tests without reason
- [ ] Test names are clear and descriptive
- [ ] Test data cleaned up properly
- [ ] Mocks are realistic and minimal
