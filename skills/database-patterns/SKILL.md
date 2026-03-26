---
name: database-patterns
description: Use this skill when working with databases — SQL (PostgreSQL, SQLite, Cosmos DB SQL API), NoSQL (MongoDB, Redis, Cosmos DB), ORMs (SQLAlchemy, Prisma), migrations (Alembic), query optimization, or database architecture decisions. Contains patterns for both relational and document databases.
---

# Database Patterns

SQL and NoSQL done right. Schema design, queries, ORMs, migrations, and performance.

---

## Mandatory Rules — REQUIREMENTS

These rules override tutorial defaults. Follow them exactly.

### SQLAlchemy (Python ORM — Non-negotiable)
- ALWAYS use `DeclarativeBase` (`from sqlalchemy.orm import DeclarativeBase`), NEVER `declarative_base()`
- ALWAYS use `Mapped[type]` with `mapped_column()`, NEVER `Column(Type)`
- ALWAYS use async sessions (`AsyncSession`, `async_sessionmaker`) for FastAPI
- ALWAYS use `asyncpg` driver for PostgreSQL (`postgresql+asyncpg://`)
- NEVER import from `sqlalchemy.ext.declarative` — it's deprecated

### Migrations (Non-negotiable for production)
- ALWAYS set up Alembic for database migrations — no raw `CREATE TABLE`
- ALWAYS generate migrations with `alembic revision --autogenerate`
- NEVER modify database schema without a migration file
- Migration files must be committed to version control

### Connection Management
- ALWAYS use connection pooling (`create_async_engine` handles this by default)
- ALWAYS close sessions properly — use `async with` or FastAPI dependency lifecycle
- NEVER create engine per request — create once at app startup

### Query Safety
- ALWAYS use parameterised queries — NEVER string interpolation in SQL
- ALWAYS eager-load relationships to prevent N+1 queries (`selectinload`, `joinedload`)
- ALWAYS add indexes for columns used in WHERE clauses and foreign keys
- ALWAYS use `select()` statement API, NEVER legacy `session.query()`

### Schema Design
- ALWAYS use UUID primary keys for distributed systems, integer for single-node
- ALWAYS add `created_at` and `updated_at` timestamp columns
- ALWAYS use timezone-aware datetimes (`datetime.now(UTC)`, NEVER `datetime.now()`)
- ALWAYS define foreign key constraints and cascade rules explicitly

---

## When to Use What

| Need | Database | Why |
|------|----------|-----|
| Transactional data, complex queries | **PostgreSQL** | Joins, ACID, JSONB for flexibility |
| Serverless cloud, document-oriented | **Cosmos DB** (SQL API) | Azure-native, global distribution |
| Flexible schema, high write volume | **MongoDB** | Document store, horizontal scaling |
| Caching, sessions, queues | **Redis** | Sub-millisecond reads, TTL support |
| Local/embedded, development | **SQLite** | Zero config, file-based |

**The 2026 default**: PostgreSQL + Redis. PostgreSQL as source of truth, Redis as cache layer.

---

## SQL — PostgreSQL

### Schema Design

```sql
-- Always include: id, created_at, updated_at
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index what you query
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role) WHERE is_active = true;  -- Partial index

-- Audit trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Query Best Practices

```sql
-- Always use parameterised queries (never string interpolation)
-- Use EXPLAIN ANALYZE to understand query plans
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- Pagination: cursor-based > offset
-- BAD (slow on large tables)
SELECT * FROM items ORDER BY created_at DESC OFFSET 10000 LIMIT 20;

-- GOOD (cursor-based, consistent performance)
SELECT * FROM items
WHERE created_at < '2024-01-15T10:00:00Z'
ORDER BY created_at DESC
LIMIT 20;

-- Avoid SELECT * — select only needed columns
SELECT id, name, email FROM users WHERE is_active = true;

-- Use CTEs for readability
WITH active_users AS (
    SELECT id, name FROM users WHERE is_active = true
)
SELECT u.name, COUNT(o.id) as order_count
FROM active_users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.name;
```

### JSONB (Document-like flexibility in PostgreSQL)

```sql
-- Store flexible data alongside relational
ALTER TABLE users ADD COLUMN metadata JSONB DEFAULT '{}';

-- Query JSON fields
SELECT * FROM users WHERE metadata->>'department' = 'engineering';

-- Index JSON fields
CREATE INDEX idx_users_department ON users USING GIN (metadata);
```

---

## SQLAlchemy 2.0 (Python ORM)

### Async Models

```python
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
import uuid


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

### Async Queries

```python
from sqlalchemy import select
from sqlalchemy.orm import selectinload

# Simple query
result = await session.execute(select(User).where(User.email == email))
user = result.scalar_one_or_none()

# With relationships (avoid N+1)
result = await session.execute(
    select(User)
    .options(selectinload(User.orders))  # Eager load
    .where(User.is_active == True)
)
users = result.scalars().all()

# Pagination
result = await session.execute(
    select(User)
    .order_by(User.created_at.desc())
    .offset(skip)
    .limit(limit)
)
```

### Alembic Migrations

```bash
# Setup
alembic init alembic

# Generate migration from model changes
alembic revision --autogenerate -m "add users table"

# Apply
alembic upgrade head

# Rollback
alembic downgrade -1

# Check current version
alembic current
```

Always review auto-generated migrations before applying. They can miss things or generate destructive operations.

---

## Prisma (TypeScript ORM)

### Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  role      Role     @default(USER)
  isActive  Boolean  @default(true) @map("is_active")
  orders    Order[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
}

enum Role {
  USER
  ADMIN
  VIEWER
}
```

### Queries

```typescript
// Find
const user = await prisma.user.findUnique({ where: { email } });

// With relations
const user = await prisma.user.findUnique({
  where: { id },
  include: { orders: true },
});

// Create
const user = await prisma.user.create({
  data: { email, name, role: "USER" },
});

// Pagination (cursor-based)
const users = await prisma.user.findMany({
  take: 20,
  cursor: { id: lastId },
  orderBy: { createdAt: "desc" },
});
```

### Migrations

```bash
npx prisma migrate dev --name add_users    # Create + apply
npx prisma migrate deploy                   # Apply in production
npx prisma generate                         # Regenerate client
npx prisma studio                           # Visual editor
```

---

## Cosmos DB (Azure)

### SQL API (Document Store)

```python
from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential

credential = DefaultAzureCredential()
client = CosmosClient(url=COSMOS_ENDPOINT, credential=credential)

database = client.get_database_client("mydb")
container = database.get_container_client("items")

# Create
await container.create_item(body={
    "id": str(uuid4()),
    "partitionKey": "documents",
    "title": "My Document",
    "status": "active",
    "metadata": {"source": "upload", "pages": 42},
})

# Query
query = "SELECT * FROM c WHERE c.status = @status"
items = container.query_items(
    query=query,
    parameters=[{"name": "@status", "value": "active"}],
    partition_key="documents",
)
async for item in items:
    print(item["title"])
```

### Cosmos DB Key Patterns

- **Partition key**: Choose based on query patterns. High cardinality, even distribution.
- **Point reads**: `container.read_item(item_id, partition_key)` — cheapest operation (1 RU)
- **Cross-partition queries**: Expensive. Design schema to avoid them.
- **Serverless tier**: Good for dev/POC. Provision throughput for production.

---

## Redis

### Common Patterns

```python
import redis.asyncio as redis

r = redis.from_url("redis://localhost:6379/0")

# Cache with TTL
await r.set("user:123", json.dumps(user_data), ex=3600)  # 1 hour
cached = await r.get("user:123")

# Counter
await r.incr("api:requests:today")

# Rate limiting
key = f"ratelimit:{user_id}:{minute}"
count = await r.incr(key)
if count == 1:
    await r.expire(key, 60)
if count > 100:
    raise RateLimitExceeded()

# Pub/Sub
await r.publish("notifications", json.dumps({"event": "new_order"}))

# Queue (simple)
await r.lpush("jobs:pending", json.dumps(job_data))
job = await r.brpop("jobs:pending", timeout=30)
```

---

## Database Anti-Patterns

- **SELECT *** — fetch only the columns you need
- **N+1 queries** — use eager loading (selectinload, include)
- **No indexes** — index columns you filter/sort by
- **Offset pagination** — use cursor-based for large datasets
- **String concatenation in queries** — SQL injection. Always parameterise.
- **No connection pooling** — exhausts database connections under load
- **Storing files in the DB** — use object storage (S3, Blob Storage), store URLs
- **No migrations** — manual schema changes = drift between environments
- **Missing updated_at** — you will need it for debugging. Add it from day one.

---

## Verification Checklist

- [ ] All queries are parameterised (no string interpolation)
- [ ] Indexes on columns used in WHERE/ORDER BY
- [ ] N+1 queries prevented (eager loading where needed)
- [ ] Migrations reviewed before applying
- [ ] Connection pooling configured
- [ ] Sensitive data encrypted at rest
- [ ] Backups configured and tested
- [ ] Query performance checked with EXPLAIN ANALYZE

---

*Schema design is API design. Get it right early — migrations are cheap, rewrites are not.*
