---
name: integration-patterns
description: Use this skill when wiring frontend to backend, defining API contracts, syncing types between TypeScript and Python, handling CORS, setting up environment configs, WebSocket integration, or debugging integration issues. The bridge between frontend and backend.
---

# Integration Patterns

The bridge between frontend and backend. Types are the contract.

---

## Core Principles

1. **Types are the contract** — if the frontend expects it, the backend must provide it
2. **No implicit assumptions** — document every interface, every field, every constraint
3. **Fail fast, fail loud** — type mismatches caught at compile time beat runtime errors
4. **One source of truth** — OpenAPI spec generates both sides, never manual sync

---

## The Integration Stack

```
Frontend (React/TS)          Backend (FastAPI/Python)
       │                              │
       └──────── HTTP/WS ─────────────┘
                   │
            ┌──────┴──────┐
            │ OpenAPI Spec│  ← Single source of truth
            └──────┬──────┘
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
TypeScript     Pydantic     Validation
  Types         Schemas       Rules
```

**Alternative: tRPC** — if both frontend and backend are TypeScript, tRPC gives automatic type inference without code generation. Choose tRPC for tightly coupled TS projects; choose OpenAPI for polyglot teams or public APIs.

---

## API Contract Workflow

### Step 1: Define in Backend (Pydantic)

FastAPI auto-generates OpenAPI from Pydantic schemas:

```python
from pydantic import BaseModel, Field
from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class CreateTaskRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    priority: int = Field(default=0, ge=0, le=5)
    assignee_id: str | None = None


class TaskResponse(BaseModel):
    id: str
    title: str
    description: str | None
    status: TaskStatus
    priority: int
    assignee_id: str | None
    created_at: str
    updated_at: str | None
```

### Step 2: Export OpenAPI Schema

```python
# scripts/export_openapi.py
import json
from src.main import app

with open("openapi.json", "w") as f:
    json.dump(app.openapi(), f, indent=2)
```

### Step 3: Generate TypeScript Types

```bash
npm install -D openapi-typescript

# From running server
npx openapi-typescript http://localhost:8000/openapi.json -o src/types/api.d.ts

# Or from exported file
npx openapi-typescript openapi.json -o src/types/api.d.ts
```

Auto-generated types — never edit by hand. Regenerate when the backend changes.

### Contract-First Development

Both sides can work in parallel from the same contract:
- Backend engineers implement endpoints matching the spec
- Frontend engineers build UI using mock servers generated from the spec
- Integration happens when both sides are ready

---

## Type-Safe API Client

```typescript
// src/lib/api-client.ts
import type { components } from "@/types/api";

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      return {
        ok: false,
        error: error.error || error.detail || "Request failed",
        status: response.status,
      };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
      status: 0,
    };
  }
}

// Type-safe API methods
export const api = {
  tasks: {
    create: (request: components["schemas"]["CreateTaskRequest"]) =>
      apiRequest<components["schemas"]["TaskResponse"]>("/api/v1/tasks", {
        method: "POST",
        body: JSON.stringify(request),
      }),

    get: (id: string) =>
      apiRequest<components["schemas"]["TaskResponse"]>(`/api/v1/tasks/${id}`),

    list: (params?: { skip?: number; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.skip) query.set("skip", String(params.skip));
      if (params?.limit) query.set("limit", String(params.limit));
      return apiRequest<components["schemas"]["TaskResponse"][]>(
        `/api/v1/tasks?${query}`
      );
    },
  },
};
```

---

## TanStack Query Integration

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { components } from "@/types/api";

type CreateTaskRequest = components["schemas"]["CreateTaskRequest"];
type TaskResponse = components["schemas"]["TaskResponse"];

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const result = await api.tasks.list();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["tasks", id],
    queryFn: async () => {
      const result = await api.tasks.get(id);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    // Poll while in progress
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "in_progress" ? 2000 : false;
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateTaskRequest) => {
      const result = await api.tasks.create(request);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.setQueryData(["tasks", data.id], data);
    },
  });
}
```

---

## WebSocket Integration

### Backend

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

router = APIRouter()


class WSMessage(BaseModel):
    type: str
    payload: dict


@router.websocket("/ws/{room}")
async def websocket_endpoint(websocket: WebSocket, room: str):
    await websocket.accept()

    try:
        await websocket.send_json({"type": "connected", "payload": {"room": room}})

        while True:
            data = await websocket.receive_text()
            message = WSMessage.model_validate_json(data)

            if message.type == "ping":
                await websocket.send_json({"type": "pong", "payload": {}})

    except WebSocketDisconnect:
        pass
```

### Frontend Hook

```typescript
import { useEffect, useRef, useCallback, useState } from "react";

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = (e) => console.error("WebSocket error:", e);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      // Handle message types
    };

    wsRef.current = ws;
    return () => ws.close();
  }, [url]);

  const send = useCallback((type: string, payload: Record<string, unknown>) => {
    wsRef.current?.send(JSON.stringify({ type, payload }));
  }, []);

  return { isConnected, send };
}
```

---

## CORS Configuration

### Backend

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Request-ID"],
)
```

### Parsing Comma-Separated Origins

```python
from pydantic import field_validator

class Settings(BaseSettings):
    CORS_ORIGINS: list[str] = Field(default_factory=list)

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
```

### Debugging CORS

```bash
curl -X OPTIONS http://localhost:8000/api/v1/tasks \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

Check for `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, and `Access-Control-Allow-Methods` in response.

---

## Environment Configuration

### Frontend

```typescript
// src/lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  VITE_API_URL: z.string().url().default("http://localhost:8000"),
  VITE_WS_URL: z.string().default("ws://localhost:8000"),
  VITE_ENV: z.enum(["development", "staging", "production"]).default("development"),
});

export const env = envSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_WS_URL: import.meta.env.VITE_WS_URL,
  VITE_ENV: import.meta.env.VITE_ENV,
});
```

### Backend

```bash
# .env.development
DATABASE_URL=postgresql+asyncpg://dev:dev@localhost/myapp_dev
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
SECRET_KEY=dev-secret-key-change-in-production

# .env.production
DATABASE_URL=postgresql+asyncpg://prod:${DB_PASSWORD}@db.internal/myapp
CORS_ORIGINS=https://app.example.com
SECRET_KEY=${SECRET_KEY}
```

### Docker Compose

```yaml
services:
  frontend:
    build:
      context: ./frontend
      args:
        - VITE_API_URL=${VITE_API_URL:-http://localhost:8000}
    ports:
      - "3000:3000"
    depends_on:
      - backend

  backend:
    build: ./backend
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - CORS_ORIGINS=${CORS_ORIGINS:-http://localhost:3000}
      - SECRET_KEY=${SECRET_KEY}
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=${POSTGRES_USER:-myapp}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB:-myapp_db}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

volumes:
  postgres_data:
```

---

## Error Handling Across the Stack

### Backend Error Response Format

```python
class ErrorResponse(BaseModel):
    error: str
    details: dict | None = None
    code: str | None = None  # Machine-readable error code
```

### Frontend Error Class

```typescript
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNotFound() { return this.status === 404; }
  get isUnauthorized() { return this.status === 401; }
  get isValidation() { return this.status === 422; }
}
```

### Map Backend Validation Errors to Form Fields

```typescript
interface BackendValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export function mapBackendErrors(errors: BackendValidationError[]) {
  const fieldErrors: Record<string, { message: string }> = {};

  for (const error of errors) {
    const field = error.loc[error.loc.length - 1];
    if (typeof field === "string") {
      fieldErrors[field] = { message: error.msg };
    }
  }

  return fieldErrors;
}
```

---

## Integration Checklist

### API Contract
- [ ] OpenAPI schema exported and up-to-date
- [ ] TypeScript types generated from OpenAPI
- [ ] All endpoints tested with actual requests (not mocks)
- [ ] Error responses match expected format

### Type Safety
- [ ] No `any` types in API layer
- [ ] Request/response types match between frontend and backend
- [ ] Enum values synchronised
- [ ] Nullable fields handled correctly

### Environment
- [ ] CORS configured for all environments
- [ ] Environment variables validated at startup (Zod on frontend, pydantic on backend)
- [ ] WebSocket URLs configured correctly
- [ ] All secrets in environment, never in code

### Error Handling
- [ ] Network errors caught and displayed
- [ ] Validation errors mapped to form fields
- [ ] 401 errors trigger auth redirect
- [ ] 500 errors show user-friendly message

### Real-World Testing
- [ ] Test with actual backend (not mocks)
- [ ] Test CORS in browser (not just curl)
- [ ] Test WebSocket reconnection
- [ ] Test with slow network (throttle in DevTools)

---

## Commands

```bash
# Export OpenAPI
python scripts/export_openapi.py

# Generate TypeScript types
npx openapi-typescript openapi.json -o src/types/api.d.ts

# Type check both sides
npx tsc --noEmit && mypy src/

# Run full stack
docker compose up -d
npm run test:e2e
```

---

*The bridge must be solid. Types are the contract. Fail fast, fail loud.*
