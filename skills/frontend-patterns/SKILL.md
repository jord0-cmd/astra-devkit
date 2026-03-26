---
name: frontend-patterns
description: Use this skill when building React frontends, designing component hierarchy architecture, making state management decisions (Zustand, TanStack Query), implementing data fetching strategies, styling with Tailwind/shadcn, building accessible dashboard UIs, or creating multi-component applications. Contains component architecture patterns, accessibility standards, data binding strategies, and the integration pipeline.
---

# Frontend Patterns

Modern React, production-grade. Components, state, accessibility, performance.

---

## Mandatory Rules — REQUIREMENTS

These rules override tutorial defaults. Follow them exactly.

### Project Setup
- ALWAYS use Vite + React + TypeScript for SPAs, or Next.js for SSR/SSG
- ALWAYS enable TypeScript strict mode in tsconfig.json
- ALWAYS install and configure Tailwind CSS for styling
- ALWAYS set up shadcn/ui (`npx shadcn@latest init`) for component primitives
- ALWAYS create a proper directory structure: `components/ui/`, `components/features/`, `hooks/`, `lib/`, `types/`
- NEVER put all components in a single file — one component per file

### Component Hierarchy Architecture (Non-negotiable)
- NEVER build a monolithic App.tsx — this is the #1 frontend anti-pattern
- ALWAYS split the UI into a MINIMUM of 4 distinct feature components in separate files
- ALWAYS create a `src/lib/mockData.ts` file with realistic, typed mock data arrays
- ALWAYS bind mock data to components via props — no hardcoded values in JSX
- A dashboard MUST have separate components for: Layout, Cards/Metrics, DataTable, Chart, Navigation
- A form page MUST have separate components for: Layout, FormFields, ValidationFeedback, SubmitHandler
- The build passing with a skeleton App.tsx is NOT complete — you must implement ALL requested feature components
- Count your components before declaring done. If the spec asks for 5 features, you need 5+ component files

### Accessibility (Non-negotiable)
- ALWAYS use semantic HTML: `<main>`, `<nav>`, `<section>`, `<header>`, `<footer>`, `<article>`
- ALWAYS add `aria-label` or `aria-labelledby` to interactive elements
- ALWAYS use `htmlFor` on labels (not implicit label wrapping alone)
- ALWAYS add a "Skip to main content" link as the first focusable element
- ALWAYS define focus-visible styles — keyboard users must see focus state
- NEVER use `<div>` when a semantic element exists (`<button>`, `<nav>`, `<main>`)

### TypeScript
- ALWAYS define typed props with `interface` or `type` for every component
- NEVER use `any` type — use `unknown` and narrow with type guards
- ALWAYS export types from `types/` directory for shared models

### Styling
- ALWAYS use Tailwind utility classes — no inline `style={{}}` objects
- ALWAYS implement responsive design with Tailwind breakpoints (`sm:`, `md:`, `lg:`)
- For government/professional UIs: clean white backgrounds, minimal colour, functional layout

---

## Tech Stack (2026)

```
React 19+        - UI library
Next.js 15+      - Framework (SSR, SSG, App Router) — or Vite for SPAs
TypeScript        - Strict mode, always
Tailwind CSS v4   - Utility-first styling
shadcn/ui         - Component library (Radix primitives + Tailwind)
Zustand           - Client state management
TanStack Query    - Server state (fetching, caching, sync)
react-hook-form   - Form management
Zod               - Schema validation
Vitest            - Unit/component testing
Playwright        - E2E testing
```

---

## Project Structure

```
src/
├── app/                 # Routes / pages (Next.js App Router)
├── components/
│   ├── ui/              # Primitive components (Button, Input, Card, Dialog)
│   ├── layout/          # Layout components (Sidebar, Header, Footer)
│   └── features/        # Feature-specific components
├── hooks/               # Custom React hooks
├── stores/              # Zustand stores
├── lib/                 # Utilities, API client, helpers
├── schemas/             # Zod validation schemas
├── types/               # Shared TypeScript types
└── test/                # Test setup and utilities
```

Use path aliases (`@/`) — no `../../../` imports.

---

## Component Architecture

### Atomic Design

Organise components by complexity:

- **Atoms** — smallest building blocks: Button, Input, Badge, Avatar
- **Molecules** — groups of atoms: SearchBar, FormField, NavLink
- **Organisms** — complex sections: Header, UserTable, SettingsPanel
- **Templates** — page layouts with slots for content
- **Pages** — templates filled with real data

### Component Structure

```typescript
// 1. Imports (external → internal → types)
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { User } from "@/types";

// 2. Types
interface UserCardProps {
  user: User;
  onEdit: (id: string) => void;
  variant?: "compact" | "full";
}

// 3. Constants
const AVATAR_SIZES = { compact: 32, full: 48 } as const;

// 4. Component (named export, never default)
export function UserCard({ user, onEdit, variant = "full" }: UserCardProps) {
  // Hooks first
  const [isExpanded, setIsExpanded] = useState(false);

  // Handlers
  const handleEdit = useCallback(() => {
    onEdit(user.id);
  }, [onEdit, user.id]);

  // Early returns after hooks
  if (!user) return null;

  // Render
  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-lg font-semibold">{user.name}</h3>
      <Button onClick={handleEdit} size="sm">Edit</Button>
    </div>
  );
}
```

### Component Rules

- **Named exports only** — never `export default`
- **One component per file** — unless tightly coupled helpers
- **Props via interface** — not inline types, not `React.FC`
- **kebab-case filenames** — `user-card.tsx`, not `UserCard.tsx`
- **Collocate related files** — `user-card.tsx`, `user-card.test.tsx`, `use-user-card.ts`

---

## Design Tokens

Never use random hex colours. Define design tokens and use them everywhere.

### Setting Up Tokens

```css
/* globals.css */
:root {
  --background: #ffffff;
  --foreground: #0a0a0a;
  --primary: #6366f1;
  --primary-foreground: #ffffff;
  --secondary: #f1f5f9;
  --muted: #64748b;
  --border: #e2e8f0;
  --radius: 0.5rem;
}

.dark {
  --background: #0a0a0f;
  --foreground: #f8fafc;
  --primary: #6366f1;
  --primary-foreground: #ffffff;
  --secondary: #1e293b;
  --muted: #94a3b8;
  --border: #1e293b;
}
```

### Tailwind Config

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--secondary)" },
        muted: { DEFAULT: "var(--muted)" },
        border: "var(--border)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
    },
  },
};
```

This is the pattern shadcn/ui uses. Follow it for consistency.

---

## State Management

### When to Use What

| State Type | Tool | Example |
|-----------|------|---------|
| Component-local | `useState` / `useReducer` | Form inputs, toggles, open/closed |
| Server/async | TanStack Query | API data, pagination, cache |
| Global client | Zustand | Theme, auth, sidebar state |
| Form | react-hook-form + Zod | Complex forms with validation |
| URL | Search params / router | Filters, pagination, tabs |

### Zustand Store

```typescript
import { create } from "zustand";

interface AppState {
  sidebarOpen: boolean;
  theme: "light" | "dark";
  toggleSidebar: () => void;
  setTheme: (theme: "light" | "dark") => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  theme: "dark",
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}));

// In component — select only what you need (prevents unnecessary re-renders)
const sidebarOpen = useAppStore((s) => s.sidebarOpen);
```

### TanStack Query

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Fetch
function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutate with optimistic update
function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateUser) => api.patch(`/users/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
```

### Forms with react-hook-form + Zod

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "At least 8 characters"),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    // data is fully typed and validated
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} />
      {errors.email && <span>{errors.email.message}</span>}
      <input {...register("password")} type="password" />
      {errors.password && <span>{errors.password.message}</span>}
      <button type="submit">Login</button>
    </form>
  );
}
```

---

## Accessibility

Accessibility is a requirement, not a feature. Both legally (European Accessibility Act 2025) and ethically.

### Essentials

- **Every interactive element** needs a visible focus style
- **Icon buttons** need `aria-label`
- **Images** need `alt` text (decorative images: `alt=""`)
- **Forms** need labels linked to inputs
- **Colour contrast** minimum 4.5:1 (WCAG AA)
- **Keyboard navigation** must work for all interactions

### Focus Management

```typescript
// Visible focus styles (Tailwind)
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"

// Skip link (first element in body)
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

### Announce Dynamic Content

```typescript
// For screen readers — announce changes
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

### Test Accessibility

Use `axe-core` with Playwright or Vitest for automated checks:

```typescript
import { axe } from "vitest-axe";

it("has no accessibility violations", async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## Performance

### Lazy Loading & Code Splitting

```typescript
import { lazy, Suspense } from "react";

const Dashboard = lazy(() => import("@/components/features/dashboard"));

function App() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Dashboard />
    </Suspense>
  );
}
```

Split by route or by heavy component. Don't lazy-load everything — only what's not needed on initial render.

### Image Optimization

```typescript
// Next.js — always use next/image
import Image from "next/image";

<Image
  src="/hero.jpg"
  alt="Hero banner"
  width={1200}
  height={600}
  priority  // Above the fold
/>
```

### Avoid Unnecessary Re-renders

- **Select specific state** from Zustand (not the whole store)
- **Use `useMemo`** only for expensive computations
- **Use `useCallback`** for callbacks passed to children
- **Don't overuse** — React Compiler (React 19+) handles most cases automatically

### Core Web Vitals Targets

| Metric | Target | What It Measures |
|--------|--------|-----------------|
| LCP | < 2.5s | Largest contentful paint |
| INP | < 200ms | Interaction to next paint |
| CLS | < 0.1 | Cumulative layout shift |

---

## AI-Generated UI Integration

When converting screenshot-to-code or AI-generated output to production:

1. **Analyse structure** — identify component boundaries, repeated patterns
2. **Apply design tokens** — replace random hex colours with CSS variables
3. **Split components** — one responsibility per component
4. **Add TypeScript** — typed props, no `any`
5. **Inject state** — Zustand for global, TanStack Query for server data
6. **Add accessibility** — focus styles, aria-labels, keyboard nav
7. **Validate** — `tsc --noEmit`, `biome check`, `vitest run`

Never ship AI-generated code without this pass. It's a starting point, not a finished product.

---

## shadcn/ui Patterns

shadcn/ui gives you copy-paste components built on Radix primitives + Tailwind.

```bash
# Install components as needed
npx shadcn@latest add button dialog dropdown-menu
```

### Customisation

Components live in `src/components/ui/` — you own them. Modify directly, don't wrap.

### Key Principle

shadcn provides the foundation. Extend it, don't fight it. If you need a component that doesn't exist, build it following the same patterns (Radix + Tailwind + CVA for variants).

---

## Quality Checklist

### Design System
- [ ] No hardcoded colours — all use tokens
- [ ] Typography is consistent
- [ ] Spacing uses a consistent scale
- [ ] Dark/light mode supported (if required)

### Components
- [ ] All components are typed with TypeScript
- [ ] Props have proper interfaces
- [ ] Single responsibility — one component, one job
- [ ] No duplicate code — extract shared patterns

### State Management
- [ ] Server state uses TanStack Query (not useState + useEffect)
- [ ] Global client state in Zustand
- [ ] Forms use react-hook-form + Zod
- [ ] No prop drilling past 2 levels

### Accessibility
- [ ] All interactive elements have focus styles
- [ ] Icon buttons have aria-labels
- [ ] Keyboard navigation works
- [ ] Colour contrast meets WCAG AA (4.5:1)
- [ ] Skip links on pages with heavy navigation

### Performance
- [ ] Large components are lazy loaded
- [ ] Images use next/image (or equivalent)
- [ ] Bundle size checked — no unexpected bloat
- [ ] Core Web Vitals within targets

### Code Quality
- [ ] No `console.log` in production
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No `any` types
- [ ] Tests pass (`vitest run`)

---

*Build components that are accessible, performant, and a pleasure to maintain. The user doesn't see your architecture — but they feel it.*
