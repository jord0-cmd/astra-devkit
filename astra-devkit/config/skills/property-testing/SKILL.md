---
description: "Generate property-based tests from API contract using Hypothesis. Activate after standard tests are written to verify invariants that example-based tests miss. Breaks the 'cycle of self-deception' where the same model generates buggy code AND passing tests."
---

# Property-Based Testing (Contract-Derived)

Generate Hypothesis property tests directly from `docs/api-contract.md`. These test mathematical invariants, not specific examples.

## When to Use

After standard tests pass. Property tests catch what example tests miss:
- Edge cases in validation boundaries
- Roundtrip consistency (create → get → same data)
- State machine violations
- Enum exhaustiveness

## How It Works

1. Read `docs/api-contract.md`
2. For each entity, generate Hypothesis strategies matching the domain model
3. For each endpoint, generate property tests
4. Write to `tests/test_properties.py`
5. Run and fix any failures found

## Property Categories

### Roundtrip Properties
Create an entity → fetch it → all fields match. No data loss, no silent transformation.
```python
@given(task=task_strategy())
def test_create_get_roundtrip(task):
    created = client.post("/api/v1/tasks", json=task)
    fetched = client.get(f"/api/v1/tasks/{created['id']}")
    assert created == fetched  # Exact field match
```

### Idempotency Properties
GET same resource twice → identical response. No side effects on reads.
```python
@given(task_id=st.uuids())
def test_get_is_idempotent(task_id):
    r1 = client.get(f"/api/v1/tasks/{task_id}")
    r2 = client.get(f"/api/v1/tasks/{task_id}")
    assert r1.status_code == r2.status_code
    if r1.status_code == 200:
        assert r1.json() == r2.json()
```

### Validation Boundary Properties
Invalid inputs → 422. Valid inputs → success. Exhaustive enum coverage.
```python
@given(status=st.text().filter(lambda s: s not in VALID_STATUSES))
def test_invalid_status_rejected(status):
    response = client.post("/api/v1/tasks", json={"status": status, ...})
    assert response.status_code == 422
```

### Monotonicity Properties
Create N items → list returns >= N. Deletes reduce count by exactly 1.
```python
@given(n=st.integers(min_value=1, max_value=5))
def test_list_monotonic(n):
    for _ in range(n):
        client.post("/api/v1/tasks", json=valid_task())
    response = client.get("/api/v1/tasks")
    assert len(response.json()) >= n
```

## Strategy Generation Rules

Map contract types to Hypothesis strategies:
| Contract Type | Hypothesis Strategy |
|--------------|-------------------|
| UUID | `st.uuids()` |
| string | `st.text(min_size=1, max_size=200)` |
| enum | `st.sampled_from(["value1", "value2", ...])` |
| datetime | `st.datetimes(timezones=st.just(UTC))` |
| list[string] | `st.lists(st.text(), max_size=10)` |
| int | `st.integers()` |
| nullable T | `st.one_of(st.none(), T_strategy)` |

## Critical Rules

1. **Derive ALL strategies from the contract** — never invent field names or enum values
2. **Use `@settings(max_examples=50)`** — enough to find bugs, fast enough to run in CI
3. **Separate property tests from unit tests** — `tests/test_properties.py` is its own file
4. **Properties must be non-vacuous** — reject tests that only assert status codes without checking response bodies
5. **Run after standard tests pass** — property tests assume basic functionality works
6. **Add `hypothesis` to pyproject.toml dev dependencies**

## Validating Generated Properties

After generating, verify quality:
- Run the mutation engine against property tests — do they catch mutations?
- Check for `assume()` overuse — too many assumes means the strategy is wrong
- Ensure at least one property per endpoint and per entity
