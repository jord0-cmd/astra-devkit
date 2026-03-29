# Testing Standards

Tests are not optional. They're how we prove the code works and how we keep it working.

---

## TDD Workflow

**Red → Green → Refactor.** This is the loop.

1. **Red**: Write a test for the behaviour you want. It should fail — the feature doesn't exist yet.
2. **Green**: Write the simplest code that makes the test pass. Nothing more.
3. **Refactor**: Clean up the code while keeping tests green. Improve structure, remove duplication, clarify naming.

Repeat. Every feature starts with a failing test.

---

## What to Test

### Always Test
- **Happy path** — does it work when everything goes right?
- **Edge cases** — empty inputs, zero values, maximum values, boundary conditions
- **Error paths** — what happens when things fail? Wrong input types, missing data, network errors
- **Business logic** — the rules that make the application do what it's supposed to do
- **State transitions** — data moving from one state to another
- **Integration points** — where your code meets external systems

### Don't Test
- Framework internals — trust that React renders or Express routes
- Trivial code — simple getters, pass-through functions, type aliases
- Implementation details — test behaviour, not how it's achieved internally
- Third-party libraries — they have their own tests

---

## Test Structure: Arrange-Act-Assert

Every test follows the same three-part structure:

```
// Arrange — set up the conditions
// Act — do the thing being tested
// Assert — verify the result
```

Keep each section clear and separate. If your Arrange section is longer than your Act + Assert combined, consider a helper or fixture.

---

## Naming Tests

Test names should read like specifications. Someone who's never seen the code should understand what's being tested from the name alone.

**Pattern**: `[unit]_[scenario]_[expected result]`

Good:
- `user_login_with_valid_credentials_returns_token`
- `cart_add_item_when_full_raises_capacity_error`
- `payment_process_with_expired_card_returns_declined`

Bad:
- `test1`
- `test_login`
- `it_works`

---

## Test Organisation

### One concept per test
Each test should verify one thing. If a test name has "and" in it, split it into two tests.

### Group related tests
Use describe blocks, test classes, or modules to group tests by the unit they're testing.

### Keep tests independent
No test should depend on another test running first. Each test sets up its own state and cleans up after itself.

### Test files mirror source files
If you have `src/services/auth.py`, tests go in `tests/services/test_auth.py`. Makes finding tests easy.

---

## Coverage Philosophy

**Meaningful coverage beats percentage targets.**

- Aim for high coverage on business logic and critical paths
- Don't chase 100% — diminishing returns after ~80% on most codebases
- Uncovered code should be a conscious decision, not an accident
- Coverage tools tell you what's NOT tested — they don't tell you if tests are any good
- A test that doesn't assert anything meaningful is worse than no test (false confidence)

---

## Test Pyramid

```
         /  E2E  \          Few — slow, expensive, catch integration issues
        /─────────\
       / Integration \      Some — test boundaries between components
      /───────────────\
     /    Unit Tests    \   Many — fast, isolated, test logic
    /─────────────────────\
```

- **Unit tests** form the base — fast, isolated, test pure logic
- **Integration tests** in the middle — test boundaries (DB, API, services talking to each other)
- **E2E tests** at the top — few but critical, test real user workflows
- More tests at the bottom, fewer at the top

---

## When Writing Tests for Existing Code

Not everything starts with TDD. When adding tests to existing code:

1. **Start with the bug** — if you're fixing a bug, write the test that reproduces it first
2. **Cover the critical path** — test what would break the business if it failed
3. **Add tests when you touch code** — if you modify a function, add tests for it
4. **Don't boil the ocean** — you don't need to retroactively test everything. Build coverage incrementally.

---

## Test Quality Checks

Before a test suite is considered done:

- [ ] Tests run in isolation (no shared state between tests)
- [ ] Tests are deterministic (same result every time, no flaky tests)
- [ ] Tests are fast (unit tests under 100ms each, integration under 5s)
- [ ] Test names describe the behaviour being verified
- [ ] Both success and failure paths are covered
- [ ] Edge cases are explicitly tested
- [ ] No commented-out tests without a linked issue
- [ ] Mocks are used sparingly — prefer real dependencies where practical

---

## TDD with AI Coding Tools

When using AI to write code, TDD becomes even more important.

**Write tests BEFORE asking the AI to implement.** When tests exist first, the AI can't cheat by writing tests that just verify its own broken implementation. Your tests define the spec — the AI fills in the solution. This produces dramatically better results than asking AI to write both the code and the tests.

**Workflow:**
1. You write the test (or describe the behaviour and have AI write the test)
2. Review and approve the test — make sure it tests the right thing
3. Then ask AI to make the test pass
4. Review the implementation

This keeps you in control of WHAT the code should do. The AI handles HOW.

---

## Test Environment Isolation

Tests must NEVER share state with the development environment.

**The anti-pattern:** Tests and the dev server use the same database file, same config, same ports. Running `pytest` wipes your development data. Running the dev server corrupts test state.

**The fix:** Isolate test state completely.

```python
# YES — use tmp_path fixture (pytest provides a unique temp dir per test)
@pytest.fixture
def storage(tmp_path):
    data_file = tmp_path / "tasks.json"
    data_file.write_text("[]")
    return Storage(data_file=str(data_file))

# YES — dependency injection for configuration
class Storage:
    def __init__(self, data_file: str = "data/tasks.json"):
        self.data_file = data_file

# NO — hardcoded paths shared between tests and production
DATA_FILE = "data/tasks.json"  # Tests nuke this file every run!
```

```typescript
// YES — unique test database per test suite
const testDb = `test_${Date.now()}.db`;
afterAll(() => fs.unlinkSync(testDb));

// NO — shared development database
const db = new Database("app.db"); // Tests corrupt dev data!
```

**Rules:**
- Use `tmp_path` (pytest) or `tmpdir` for file-based tests
- Use separate test databases with unique names
- Use dependency injection — pass config, don't hardcode paths
- Tests must create their own state and clean up after themselves
- Never reference the same data store as the development server

---

## Flaky Tests

A flaky test is worse than no test. It erodes trust in the entire suite.

If a test is flaky:
1. **Fix it or delete it** — there is no "skip for now"
2. Common causes: shared state, timing dependencies, external service calls, random data
3. If it depends on timing, it needs proper waits or polling — not sleep
4. If it depends on external services, mock them or use a test double

---

## WebSocket & Async Testing

FastAPI's `TestClient.websocket_connect()` is **synchronous**. Do NOT mix it with async:
- Tests using `TestClient` for WebSockets MUST be plain `def test_*`, NOT `async def`
- Do NOT use `@pytest.mark.asyncio` with `TestClient.websocket_connect()`
- Do NOT wrap `websocket.receive_json()` in `asyncio.to_thread` or `asyncio.wait_for`
- If you need truly async WebSocket tests, use `httpx-ws` with `ASGIWebSocketTransport` — but start sync first

For ANY `await` call in async tests, always wrap with a timeout:
```python
data = await asyncio.wait_for(ws.receive_json(), timeout=2.0)
```
Never `await` indefinitely. A timeout converts a deadlock into a test failure that can be diagnosed.

---

## Testing Anti-Patterns

Traps to avoid:

- **Testing implementation, not behaviour** — test what the code does, not how it does it. If you refactor and tests break but behaviour hasn't changed, your tests are too coupled.
- **All UI tests, no unit tests** — UI tests are slow and fragile. Most of your coverage should come from fast unit tests. See the test pyramid.
- **Tests that don't maintain** — when the app changes, tests must change too. Stale tests give false confidence or false failures. Both are dangerous.
- **Testing only the happy path** — if you only test success, you'll only discover failure in production.
- **Copy-paste test code** — duplicated test setup becomes a maintenance nightmare. Use fixtures, helpers, or factories.
- **Ignoring test performance** — a test suite that takes 20 minutes to run won't get run. Keep it fast.

---

*Tests are documentation that runs. Write them like someone else will read them — because they will.*
