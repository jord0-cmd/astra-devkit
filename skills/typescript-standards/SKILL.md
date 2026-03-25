---
name: typescript-standards
description: Use this skill when writing TypeScript or React code. Contains strict mode config, type patterns (discriminated unions, branded types, utility types), React component patterns, hooks rules, anti-patterns, Zod validation, Vitest testing, and modern tooling.
---

# TypeScript Standards

TypeScript's power is in the type system. If your code needs runtime checks for things the compiler could catch, you're fighting the language.

---

## Strict Mode Config

ALL flags enabled. No exceptions. Every new tsconfig.json must include:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2022"
  }
}
```

If a project has `strict: false` or missing flags, flag it immediately.

**Migrating an existing codebase?** Enable flags one at a time: start with `noImplicitAny`, then `strictNullChecks`, then the rest.

---

## Tooling

### Linting & Formatting: Biome (or ESLint + Prettier)

```bash
# Biome — one tool, fast (like ruff for JS/TS)
npx @biomejs/biome check .
npx @biomejs/biome format .

# Or traditional stack
npx eslint .
npx prettier --check .
```

Biome is the modern choice — single tool, fast, replaces both ESLint and Prettier. If the project already uses ESLint + Prettier, that's fine too.

### Type Checking

```bash
npx tsc --noEmit    # Type check without emitting files
```

---

## Type Patterns

### Discriminated Unions — THE Pattern

TypeScript's killer feature. Use it everywhere you'd use polymorphism.

```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: Error };

type Action =
  | { type: "load"; id: string }
  | { type: "save"; data: Record<string, unknown> }
  | { type: "delete"; id: string; confirm: boolean };

function handle(action: Action) {
  switch (action.type) {
    case "load": return fetch(action.id);
    case "save": return persist(action.data);
    case "delete": return action.confirm ? remove(action.id) : null;
    // No default — compiler catches missing cases
  }
}
```

### Branded Types

For IDs, tokens, paths that shouldn't be interchangeable:

```typescript
type UserId = string & { readonly __brand: "UserId" };
type PostId = string & { readonly __brand: "PostId" };

function createUserId(id: string): UserId { return id as UserId; }
// Now: getPost(userId) is a compile error
```

### Template Literal Types

Enforce string formats at compile time:

```typescript
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type ApiRoute = `/api/${string}`;
type EventName = `on${Capitalize<string>}`;

function request(method: HttpMethod, url: ApiRoute) { ... }
request("GET", "/api/users");    // OK
request("GET", "/not-api/foo");  // Compile error
```

### `satisfies` Over `as`

```typescript
// BAD — lies to the compiler
const config = { port: 3000 } as Config;

// GOOD — validates AND preserves narrow type
const config = { port: 3000 } satisfies Config;
```

### `as const` for Literal Types

```typescript
const ROUTES = {
  home: "/",
  about: "/about",
  contact: "/contact",
} as const;

type Route = (typeof ROUTES)[keyof typeof ROUTES]; // "/" | "/about" | "/contact"
```

### Utility Types

Use the built-in utility types instead of reinventing:

```typescript
Partial<User>            // All fields optional
Required<User>           // All fields required
Pick<User, "id" | "name"> // Only these fields
Omit<User, "password">  // Everything except these
Record<string, number>   // Typed key-value map
Exclude<Status, "deleted"> // Remove from union
Extract<Status, "active" | "pending"> // Keep from union
ReturnType<typeof fn>    // Infer return type
Parameters<typeof fn>    // Infer parameter types
Awaited<Promise<User>>   // Unwrap promise type
```

### Generic Constraints

```typescript
// BAD — accepts anything
function getProperty<T>(obj: T, key: string) { ... }

// GOOD — key must exist on T
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] { ... }
```

### Type Narrowing

```typescript
// Type predicates for reusable narrowing
function isUser(value: unknown): value is User {
  return typeof value === "object" && value !== null && "id" in value;
}

// `in` operator for duck typing
if ("type" in event) { /* event has type property */ }
```

### Consistent Nullable Strategy

Standardise across the codebase:

```typescript
// `?` for truly optional — the field may not exist
interface Config {
  timeout?: number;  // Might not be provided at all
}

// `| null` for required fields that might lack a value
interface User {
  name: string;
  avatar: string | null;  // Always present, might be empty
}

// Pick one approach and be consistent. Mixing creates confusion.
```

---

## React Component Patterns

### Component Structure Order

```typescript
// 1. Imports (external → internal → types)
// 2. Types/interfaces
// 3. Constants
// 4. Component
// 5. Subcomponents (if small/private)
// 6. Export

interface DashboardProps {
  userId: string;
  onNavigate: (path: string) => void;
}

const REFRESH_INTERVAL = 30_000;

export function Dashboard({ userId, onNavigate }: DashboardProps) {
  // Hooks first — ALWAYS
  const [data, setData] = useState<DashboardData | null>(null);
  const queryClient = useQueryClient();

  // Effects after hooks
  useEffect(() => {
    const timer = setInterval(() => queryClient.invalidateQueries(), REFRESH_INTERVAL);
    return () => clearInterval(timer); // ALWAYS cleanup
  }, [queryClient]);

  // Handlers
  const handleClick = useCallback((path: string) => {
    onNavigate(path);
  }, [onNavigate]);

  // Early returns AFTER hooks
  if (!data) return <Skeleton />;

  // Render
  return <div onClick={() => handleClick("/home")}>{data.title}</div>;
}
```

### Props Interfaces

```typescript
// GOOD — interface for component props, named consistently
interface ButtonProps {
  variant: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

// BAD — inline types, React.FC, default exports
export default React.FC<{ variant: string; onClick: any }> = ...
```

**Rules:**
- Use `interface` for props (not `type` — interfaces have better error messages)
- Never use `React.FC` — use plain functions with typed props
- Never use default exports — named exports only
- Never use `any` in props — type everything

### Event Handler Typing

```typescript
// BAD — loses type safety
const handleChange = (e: any) => { ... };

// GOOD — proper React event types
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value; // Properly typed
};

const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
};

const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  // ...
};
```

### Hooks Rules — NEVER BREAK THESE

1. **NEVER call hooks conditionally or after early returns**
2. **ALWAYS provide cleanup for effects with subscriptions/timers**
3. **ALWAYS include all dependencies in dependency arrays** — lint will catch this
4. **Use `useCallback` for callbacks passed to children** to prevent unnecessary re-renders
5. **Use `useMemo` only for expensive computations** — not for every variable

---

## React Anti-Patterns

### `useEffect` for Derived State

```typescript
// BAD — unnecessary effect, causes extra render
const [items, setItems] = useState<Item[]>([]);
const [filteredItems, setFilteredItems] = useState<Item[]>([]);
useEffect(() => {
  setFilteredItems(items.filter(i => i.active));
}, [items]);

// GOOD — derive during render
const filteredItems = useMemo(() => items.filter(i => i.active), [items]);
```

### Fire-and-Forget Effects

```typescript
// BAD — no cleanup, no abort, race condition
useEffect(() => {
  fetch(`/api/user/${id}`).then(r => r.json()).then(setUser);
}, [id]);

// GOOD — abort controller prevents stale updates
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/user/${id}`, { signal: controller.signal })
    .then(r => r.json())
    .then(setUser)
    .catch(e => { if (e.name !== "AbortError") throw e; });
  return () => controller.abort();
}, [id]);
```

### Prop Drilling

If you're passing props through 3+ levels, use context or a store (Zustand).

---

## Error Handling

### Result Types Over Exceptions

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) return { ok: false, error: new Error(`HTTP ${res.status}`) };
    return { ok: true, value: await res.json() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
```

### `unknown` in Catch Blocks

```typescript
// BAD
catch (e) { console.error(e.message); }

// GOOD
catch (e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  console.error(message);
}
```

### Zod at API Boundaries

```typescript
import { z } from "zod";

const UserSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "user", "viewer"]),
});

type User = z.infer<typeof UserSchema>;

// Validate at the boundary — trust nothing from external sources
const user = UserSchema.parse(apiResponse);
```

---

## Testing with Vitest

Vitest replaces Jest — faster, native TypeScript support, uses your Vite config.

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

### Config

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
```

```typescript
// src/test/setup.ts
import "@testing-library/jest-dom/vitest";
```

### Component Tests

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders disabled state", () => {
    render(<Button onClick={() => {}} disabled>Disabled</Button>);

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

### Hook Tests

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { useCounter } from "./use-counter";

it("increments counter", () => {
  const { result } = renderHook(() => useCounter());

  act(() => result.current.increment());

  expect(result.current.count).toBe(1);
});
```

### Mocking

```typescript
import { vi } from "vitest";

// Mock a module
vi.mock("@/lib/api", () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: "1", name: "Test" }),
}));

// Mock a function
const mockFn = vi.fn().mockReturnValue(42);
```

---

## State Management

### Local State: useState / useReducer

For component-level state. Don't reach for a library when useState works.

### Server State: TanStack Query

For data fetching, caching, and synchronisation:

```typescript
import { useQuery, useMutation } from "@tanstack/react-query";

function UserProfile({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["user", id],
    queryFn: () => fetchUser(id),
  });

  if (isLoading) return <Skeleton />;
  if (error) return <Error message={error.message} />;
  return <Profile user={data} />;
}
```

### Global State: Zustand

For client-side state that multiple components need:

```typescript
import { create } from "zustand";

interface AppState {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const useAppStore = create<AppState>((set) => ({
  theme: "light",
  toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
}));

// In component
const theme = useAppStore((s) => s.theme);
```

---

## Import Organization

```typescript
// 1. External libraries
import { useState, useEffect } from "react";
import { z } from "zod";

// 2. Internal modules (absolute paths via aliases)
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";

// 3. Types (type-only imports)
import type { User, Session } from "@/types";
```

---

## Naming Conventions

| Kind | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `UserProfile`, `DataTable` |
| Functions/hooks | camelCase | `useAuth`, `formatDate` |
| Constants | SCREAMING_SNAKE | `MAX_RETRIES`, `API_BASE_URL` |
| Types/Interfaces | PascalCase | `UserProps`, `ApiResponse` |
| Files (components) | kebab-case | `user-profile.tsx`, `data-table.tsx` |
| Files (utils) | kebab-case | `format-date.ts`, `api-client.ts` |
| Enum values | PascalCase | `Status.Active`, `Role.Admin` |

---

## Project Structure

```
src/
├── components/
│   ├── ui/              # Shared UI components (button, input, card)
│   └── features/        # Feature-specific components
├── hooks/               # Custom hooks
├── lib/                 # Utilities, API client, helpers
├── types/               # Shared type definitions
├── stores/              # Zustand stores
├── test/                # Test setup and utilities
└── app/                 # Routes / pages
```

Use path aliases (`@/`) to avoid `../../../` imports.

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Pre-Commit Checklist

Before committing TypeScript code:

```bash
npx tsc --noEmit          # Type check
npx biome check .         # Lint + format (or eslint + prettier)
npx vitest run            # Tests
```

Manual checks:
- [ ] No `any` — use `unknown` and narrow
- [ ] No `@ts-ignore` without explanatory comment
- [ ] No `as` casts unless truly necessary (prefer `satisfies`)
- [ ] No `React.FC` — use plain function components
- [ ] No default exports — named exports only
- [ ] All effects have cleanup where needed
- [ ] Hooks are never called conditionally
- [ ] Error boundaries wrap major sections
- [ ] API responses are validated (Zod)

---

*Type safety is not overhead — it's the foundation. The compiler is your first reviewer. Make it thorough.*
