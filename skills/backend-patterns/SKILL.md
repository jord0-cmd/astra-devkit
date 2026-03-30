---
name: backend-patterns
description: Use this skill when building FastAPI backends, Python REST APIs, async services, WebSocket implementations, database integrations, or making backend architecture decisions. Contains production patterns for dependency injection, error handling, testing, and deployment.
---

# Backend Patterns

FastAPI + Python Async + Production-Grade Everything.

---

## Mandatory Rules — REQUIREMENTS

These rules override tutorial defaults. Follow them exactly.

### Architecture (Non-negotiable for production)
- ALWAYS use **DDD/hexagonal layered architecture** with explicit directories:
  - `src/domain/` — models, business logic, ZERO framework imports
  - `src/api/` — FastAPI routes, schemas, middleware
  - `src/infrastructure/` or `src/adapters/` — database, external services
- ALWAYS define port interfaces using `typing.Protocol` in the domain layer
- ALWAYS implement the **Repository pattern** for data access
- ALWAYS use **FastAPI `Depends()`** for dependency injection — no global state
- NEVER put database logic directly in route handlers

### Testing (Non-negotiable)
- ALWAYS use **in-memory fakes** implementing the Protocol interfaces for testing
- NEVER use `mock.patch`, `MagicMock`, `AsyncMock`, or `unittest.mock` in any form
- For SDK/client objects: create Protocol-based fakes that return test data, NOT mocks
- ALWAYS include sad path tests (404, 422, validation errors)
- Write tests BEFORE implementation code (TDD)

### Logging & Config
- ALWAYS use `structlog` for structured logging — not stdlib `logging` or `print()`
- ALWAYS use `pydantic-settings` with `ConfigDict` for configuration
- NEVER hardcode config values — use environment variables

---

## Tech Stack

```
FastAPI          - Async REST framework
Uvicorn          - ASGI server
Pydantic v2      - Data validation & settings
SQLAlchemy 2.0   - Async ORM
PostgreSQL       - Primary database (asyncpg driver)
Redis            - Caching & sessions
pytest + httpx   - Testing
Alembic          - Migrations
structlog        - Structured logging
```

---

## Project Structure

```
src/
├── api/
│   ├── __init__.py
│   ├── deps.py              # Dependency injection
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── health.py
│   │   ├── auth.py
│   │   └── {feature}.py
│   └── middleware/
│       ├── __init__.py
│       ├── logging.py
│       ├── error_handler.py
│       └── request_id.py
├── core/
│   ├── __init__.py
│   ├── config.py            # Settings via pydantic-settings
│   ├── security.py          # Auth, JWT, hashing
│   └── exceptions.py        # Custom exception hierarchy
├── db/
│   ├── __init__.py
│   ├── session.py           # Async session factory
│   ├── base.py              # SQLAlchemy base
│   └── migrations/          # Alembic
├── models/
│   ├── __init__.py
│   └── {entity}.py          # SQLAlchemy models
├── schemas/
│   ├── __init__.py
│   └── {entity}.py          # Pydantic schemas
├── services/
│   ├── __init__.py
│   └── {entity}_service.py  # Business logic
├── repositories/
│   ├── __init__.py
│   ├── base.py              # Generic CRUD base
│   └── {entity}_repo.py     # Data access
└── main.py                  # App factory
tests/
├── conftest.py              # Fixtures
├── api/
├── services/
└── repositories/
```

---

## Core Patterns

### Application Factory

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import health, auth
from src.api.middleware.error_handler import error_handling_middleware
from src.api.middleware.logging import logging_middleware
from src.api.middleware.request_id import request_id_middleware
from src.core.config import settings
from src.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        lifespan=lifespan,
    )

    # Middleware (order matters — last added = first executed)
    app.middleware("http")(logging_middleware)
    app.middleware("http")(error_handling_middleware)
    app.middleware("http")(request_id_middleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routes — versioned
    app.include_router(health.router, tags=["health"])
    app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])

    return app


app = create_app()
```

### Settings Pattern

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # App
    PROJECT_NAME: str = "API"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 10

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
```

### Async Database Session

```python
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from src.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    echo=settings.DEBUG,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncSession:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

---

## Dependency Injection

Use `Annotated` types for clean, reusable dependencies.

```python
from typing import Annotated
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_session
from src.repositories.user_repo import UserRepository
from src.services.user_service import UserService

# Session dependency
SessionDep = Annotated[AsyncSession, Depends(get_session)]


# Repository factory
async def get_user_repository(session: SessionDep) -> UserRepository:
    return UserRepository(session)


UserRepoDep = Annotated[UserRepository, Depends(get_user_repository)]


# Service factory (inject repository)
async def get_user_service(repo: UserRepoDep) -> UserService:
    return UserService(repo)


UserServiceDep = Annotated[UserService, Depends(get_user_service)]
```

**Prefer async dependencies** even for non-I/O operations. Sync dependencies run in a threadpool, which adds unnecessary overhead for simple operations.

---

## Repository Pattern (Generic CRUD)

```python
from typing import Generic, TypeVar, Type
from uuid import UUID
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], session: AsyncSession):
        self.model = model
        self.session = session

    async def get(self, id: UUID) -> ModelType | None:
        result = await self.session.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ModelType]:
        result = await self.session.execute(
            select(self.model).offset(skip).limit(limit)
        )
        return list(result.scalars().all())

    async def create(self, **kwargs) -> ModelType:
        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def update(self, id: UUID, **kwargs) -> ModelType | None:
        await self.session.execute(
            update(self.model)
            .where(self.model.id == id)
            .values(**kwargs)
        )
        return await self.get(id)

    async def delete(self, id: UUID) -> bool:
        result = await self.session.execute(
            delete(self.model).where(self.model.id == id)
        )
        return result.rowcount > 0
```

---

## Exception Hierarchy

```python
from typing import Any


class AppException(Exception):
    """Base exception for all application errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class NotFoundError(AppException):
    def __init__(self, resource: str, id: Any):
        super().__init__(
            message=f"{resource} not found",
            status_code=404,
            details={"resource": resource, "id": str(id)},
        )


class ValidationError(AppException):
    def __init__(self, message: str, errors: list[dict]):
        super().__init__(
            message=message,
            status_code=422,
            details={"errors": errors},
        )


class AuthenticationError(AppException):
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message=message, status_code=401)


class AuthorizationError(AppException):
    def __init__(self, message: str = "Permission denied"):
        super().__init__(message=message, status_code=403)


class ConflictError(AppException):
    def __init__(self, message: str):
        super().__init__(message=message, status_code=409)
```

---

## Error Handling Middleware

```python
import structlog
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from src.core.exceptions import AppException

logger = structlog.get_logger()


async def error_handling_middleware(request: Request, call_next) -> Response:
    try:
        return await call_next(request)
    except AppException as e:
        logger.warning(
            "application_error",
            error=e.message,
            status_code=e.status_code,
            details=e.details,
            path=request.url.path,
        )
        return JSONResponse(
            status_code=e.status_code,
            content={"error": e.message, "details": e.details},
        )
    except Exception as e:
        logger.exception(
            "unhandled_error",
            error=str(e),
            path=request.url.path,
        )
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"},
        )
```

---

## Request ID Middleware

Correlation IDs for tracing requests across services.

```python
import uuid
from fastapi import Request, Response


async def request_id_middleware(request: Request, call_next) -> Response:
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id

    response: Response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response
```

Include request_id in all log entries for distributed tracing.

---

## Health Checks

Go deeper than "OK" — verify actual dependencies.

```python
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps import SessionDep

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "healthy"}


@router.get("/health/ready")
async def readiness(session: SessionDep):
    """Check all dependencies are available."""
    checks = {}

    # Database
    try:
        await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"

    all_ok = all(v == "ok" for v in checks.values())
    return {
        "status": "ready" if all_ok else "degraded",
        "checks": checks,
    }
```

---

## Background Tasks

For fire-and-forget operations that shouldn't block the response.

```python
from fastapi import BackgroundTasks


async def send_welcome_email(email: str):
    # Long-running operation
    ...


@router.post("/users")
async def create_user(
    user_data: CreateUserRequest,
    service: UserServiceDep,
    background_tasks: BackgroundTasks,
):
    user = await service.create(user_data)
    background_tasks.add_task(send_welcome_email, user.email)
    return user
```

For heavy or reliable background work, use **ARQ** (async Redis queue) or **Celery**.

---

## WebSocket Patterns

### Connection Manager

```python
from dataclasses import dataclass, field
from typing import Any
import json
from fastapi import WebSocket


@dataclass
class ConnectionManager:
    connections: dict[str, set[WebSocket]] = field(default_factory=dict)

    async def connect(self, websocket: WebSocket, room: str) -> None:
        await websocket.accept()
        if room not in self.connections:
            self.connections[room] = set()
        self.connections[room].add(websocket)

    def disconnect(self, websocket: WebSocket, room: str) -> None:
        if room in self.connections:
            self.connections[room].discard(websocket)
            if not self.connections[room]:
                del self.connections[room]

    async def broadcast(self, room: str, message: dict[str, Any]) -> None:
        if room not in self.connections:
            return

        payload = json.dumps(message)
        dead_connections = set()

        for connection in self.connections[room]:
            try:
                await connection.send_text(payload)
            except Exception:
                dead_connections.add(connection)

        for conn in dead_connections:
            self.disconnect(conn, room)


manager = ConnectionManager()
```

### WebSocket Route

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws/{room}")
async def websocket_endpoint(websocket: WebSocket, room: str):
    await manager.connect(websocket, room)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(room, {
                "user": data.get("user"),
                "message": data.get("message"),
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
```

---

## Testing Patterns

### Fixtures

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from src.main import create_app
from src.db.base import Base
from src.db.session import get_session

TEST_DATABASE_URL = "postgresql+asyncpg://test:test@localhost/test_db"

engine = create_async_engine(TEST_DATABASE_URL, echo=True)
TestingSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="session")
async def setup_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def session(setup_database) -> AsyncSession:
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(session: AsyncSession):
    app = create_app()

    async def override_get_session():
        yield session

    app.dependency_overrides[get_session] = override_get_session

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
```

### Test Examples

```python
class TestUserEndpoints:
    @pytest.mark.anyio
    async def test_create_user_success(self, client: AsyncClient):
        user_data = {
            "email": "test@example.com",
            "password": "SecurePass123!",
            "username": "testuser",
        }

        response = await client.post("/api/v1/users", json=user_data)

        assert response.status_code == 201
        data = response.json()
        assert data["email"] == user_data["email"]
        assert "password" not in data  # Never return password

    @pytest.mark.anyio
    async def test_create_user_duplicate_email(self, client: AsyncClient):
        user_data = {"email": "dupe@example.com", "password": "Pass123!", "username": "user1"}
        await client.post("/api/v1/users", json=user_data)

        user_data["username"] = "user2"
        response = await client.post("/api/v1/users", json=user_data)

        assert response.status_code == 409

    @pytest.mark.anyio
    async def test_get_user_not_found(self, client: AsyncClient, auth_headers):
        response = await client.get(
            "/api/v1/users/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert response.status_code == 404
```

---

## Debugging Protocol

When something breaks:

**Phase 1 — Root Cause Investigation (do this first)**
1. Read the FULL error message and stack trace
2. Reproduce the issue consistently
3. Check recent changes (`git diff`)
4. Add logging at boundaries
5. Trace data flow backward through call stack

**Phase 2 — Pattern Analysis**
1. Find working code that does similar things
2. Compare broken vs working implementations completely
3. Document every difference

**Phase 3 — Hypothesis Testing**
1. Form one specific hypothesis
2. Test with minimal changes
3. Change one variable at a time
4. If hypothesis fails, form a new one (don't stack fixes)

**Phase 4 — Implementation**
1. Write a test that fails due to the bug first
2. Implement single fix addressing root cause
3. Verify test passes
4. Run full test suite

After 3 failed fixes: stop. It's architectural, not implementation.

---

## Verification Checklist

Before claiming backend work is complete:

### Tests
- [ ] All new code has corresponding tests
- [ ] Tests were written before implementation (TDD)
- [ ] `pytest -v` shows all tests passing
- [ ] Edge cases covered (empty inputs, invalid data, auth failures)

### Error Handling
- [ ] All operations that can fail have explicit handling
- [ ] Custom exceptions with appropriate HTTP status codes
- [ ] Errors logged with context (not swallowed)
- [ ] No bare `except:` clauses

### Security
- [ ] No secrets in code (use environment variables)
- [ ] Input validation via Pydantic schemas
- [ ] SQL injection prevented (parameterized queries via SQLAlchemy)
- [ ] Authentication required on protected routes
- [ ] CORS properly configured

### Performance
- [ ] Database queries are async
- [ ] N+1 queries avoided (use `selectinload`/`joinedload`)
- [ ] Connection pooling configured
- [ ] Heavy operations have timeouts

### Code Quality
- [ ] Type hints on all functions
- [ ] No TODO comments in production code
- [ ] Docstrings on public functions

---

## Commands Reference

```bash
# Development
uvicorn src.main:app --reload --port 8000

# Testing
pytest -v                           # All tests
pytest -v -k "test_user"           # Specific tests
pytest --cov=src --cov-report=html  # Coverage

# Database
alembic revision --autogenerate -m "message"
alembic upgrade head
alembic downgrade -1

# Linting
ruff check src/ tests/
ruff format src/ tests/
mypy src/
```

---

*Ship quality or don't ship at all. No shortcuts, no excuses.*
