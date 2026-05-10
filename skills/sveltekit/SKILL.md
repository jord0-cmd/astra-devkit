---
name: sveltekit
description: Use this skill when building SvelteKit 2.x + Svelte 5 (runes-based) applications. Covers runes (`$state`, `$derived`, `$effect`, `$props`, `$bindable`) with cleanup discipline, project structure (`+page.svelte`, `+page.server.ts`, `+layout.svelte`, `+server.ts`), load functions (server vs universal), TypeScript integration with `verbatimModuleSyntax`, browser-only library mounting (canvas libs, force-graph), Cloud Run deployment via `adapter-node`, and the parser/preprocessor traps that bite first-timers. Activate for any `.svelte`, `.svelte.ts`, SvelteKit project, Vite + Svelte combo, or when the user mentions Svelte/SvelteKit/runes.
---

# SvelteKit 2.x + Svelte 5

Modern SvelteKit (2024+ runes era). Different from Svelte 4 — `$:` blocks and store auto-subscription are gone, replaced by **runes**: explicit, statically-analysable compiler directives.

---

## Hard rules — non-negotiable

1. **Runes only in `.svelte`, `.svelte.js`, `.svelte.ts` files.** They're compiler directives, not function calls.
2. **`$effect` MUST return a cleanup function** when it touches third-party state (canvas, intervals, listeners). HMR will double-mount otherwise.
3. **Never `$effect(async () => ...)` directly** — async functions return promises, not cleanup functions; teardown is silently dropped.
4. **`<script lang="ts">` is mandatory** for TypeScript. Without it, types are silently stripped.
5. **`verbatimModuleSyntax: true`** is on by default in SvelteKit 2 — every type-only import must use `import type`. Mixed value+type imports fail svelte-check.
6. **`$props<T>()` is NOT valid syntax.** Use `let { ... }: Props = $props();` for inline typing. For generic components, declare on the script tag: `<script lang="ts" generics="T">`.
7. **Server-only modules** (anywhere under `$lib/server/` or files ending `.server.ts`) cannot be imported into client code. SvelteKit fails the build with a clear error.
8. **Browser-only libraries** must be dynamically imported inside `onMount` or `$effect` with `if (browser)` guards from `$app/environment`.

---

## Runes quick reference

| Rune | Use when… | Don't use when… |
|------|-----------|-----------------|
| `$state(initial)` | Reactive primitive, array, plain object. Mutating sub-properties IS reactive (deep proxy). | Value is non-reactive (use `let`) or it's a class instance — apply `$state` to fields instead. |
| `$state.raw(initial)` | Large blob you only ever **reassign**, never mutate (perf optimisation, e.g. graph data). | You'll mutate sub-properties — won't trigger updates. |
| `$state.snapshot(value)` | Passing a reactive proxy to an external lib (`JSON.stringify`, `force-graph.graphData`). | Reading values inside Svelte — proxies work transparently. |
| `$derived(expr)` | Single-expression computed value. Memoised. | Expression has side-effects — use `$effect`. |
| `$derived.by(() => { ...; return x })` | Multi-statement computed value. | One-liners — use `$derived(expr)`. |
| `$effect(() => { ...; return cleanup })` | Side effects with cleanup: canvas draws, lib lifecycle, intervals, subscriptions. Runs after DOM update. | State synchronisation — use `$derived`. Async fns — cleanup never runs. |
| `$effect.pre(() => ...)` | Run **before** DOM updates (e.g. auto-scroll measurement). | Anything else. |
| `$effect.root(() => ...; return cleanup)` | Top-level effect outside a component (global lifecycle). | Inside a component — use plain `$effect`. |
| `$props()` | Declaring component inputs. Always destructure. | You never write `export let` in runes mode. |
| `$bindable(default?)` | This prop should support `bind:` from parent. | Default — props are **not** bindable in runes unless declared. |
| `$inspect(values).with(fn?)` | Logging reactive values during dev. | Production — strip these. |

### The example pack

```svelte
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);
  let summary = $derived.by(() => {
    const sign = count >= 0 ? 'pos' : 'neg';
    return `${sign}: ${doubled}`;
  });

  $effect(() => {
    const id = setInterval(() => count++, 1000);
    return () => clearInterval(id); // CLEANUP — runs on unmount or re-run
  });
</script>

<button onclick={() => count++}>{count} — {summary}</button>
```

### Key state rules

- `$state` deep reactivity uses `Proxy`. Plain `Map` / `Set` are **not** proxied — use `SvelteMap` / `SvelteSet` from `svelte/reactivity`.
- Class instances aren't proxied. Apply `$state` to **fields** inside the class instead.
- Destructuring breaks reactivity: `let { done } = todo` captures the value at that moment.

### Effect cleanup discipline (the lesson from production crashes)

A returned function from `$effect` runs **before the effect re-runs** AND **on component unmount**. This is the only correct shape for canvas / 3rd-party library lifecycle:

```svelte
<script lang="ts">
  import { browser } from '$app/environment';

  let { data }: { data: { nodes: any[]; links: any[] } } = $props();
  let containerEl: HTMLDivElement;
  let graph: any = null;

  // EFFECT 1: mount-once. Constructs the lib instance.
  $effect(() => {
    if (!browser || !containerEl) return;
    let cancelled = false;
    (async () => {
      const ForceGraph = (await import('force-graph')).default;
      if (cancelled) return;
      graph = new ForceGraph(containerEl).graphData($state.snapshot(data));
    })();
    return () => {
      cancelled = true;
      graph?._destructor?.(); // critical — without this, HMR leaks canvases
      graph = null;
    };
  });

  // EFFECT 2: data-update only. Cheap, runs on every data mutation.
  $effect(() => {
    if (graph) graph.graphData($state.snapshot(data));
  });
</script>

<div bind:this={containerEl} class="h-screen w-screen"></div>
```

**Why two effects?** Mount and re-bind have different lifetimes. A single effect would tear down and remount the entire graph on every data change — terrible UX, wasteful. Two effects = mount-once + cheap-update.

---

## Project structure

```
src/
├── routes/
│   ├── +layout.svelte          # Root layout — wraps every page
│   ├── +layout.ts              # Universal layout load (SSR + client)
│   ├── +layout.server.ts       # Server-only layout load (auth, db)
│   ├── +error.svelte           # Catch-all error page (nearest in tree wins)
│   ├── +page.svelte            # Page UI
│   ├── +page.ts                # Universal load
│   ├── +page.server.ts         # Server load + form `actions`
│   ├── api/scans/+server.ts    # API endpoint — exports GET/POST/etc.
│   └── scans/[id]/
│       ├── +page.svelte
│       └── +page.server.ts     # Receives params.id via load({ params })
├── lib/                        # Aliased as `$lib/`
│   ├── components/             # Reusable .svelte components
│   ├── api/                    # Frontend → backend client (typed fetch)
│   ├── stores/                 # Cross-component reactive state (.svelte.ts)
│   └── server/                 # SERVER-ONLY — build error if imported client-side
├── hooks.server.ts             # Server middleware: auth, CORS, logging
├── hooks.client.ts             # Client error handler, link interception
├── app.html                    # HTML shell — %sveltekit.head%, %sveltekit.body%
├── app.d.ts                    # Ambient types (Locals, PageData, Platform)
└── app.css                     # Global styles (Tailwind import lives here)
```

**Rules**:
- Anything under `src/lib/server/` or any `.server.ts` is server-only. Build fails if a client bundle imports it (transitive imports counted).
- `$lib/` is just an alias for `src/lib/` — set up automatically.
- Routes are filesystem-driven. `[id]` = dynamic, `(group)` = layout group with no URL impact, `[...rest]` = catch-all.
- Method routing in `+server.ts`: export named `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD`. Each takes `RequestEvent`, returns `Response`.

---

## Load functions

| Where | When | Has access to |
|---|---|---|
| `+page.ts` (universal) | Runs SSR first, then client. Must be portable. | `fetch`, `params`, `parent`, `depends`. NO server secrets. |
| `+page.server.ts` (server) | Server-only, every request. | All of above + `cookies`, `request`, `setHeaders`, `locals`, env vars. |
| Neither | Page is static. | — |

**Decision tree**:
1. Need `cookies` / DB / secrets / `process.env` ? → `+page.server.ts`
2. Just `fetch` of a public API + serialisable result ? → `+page.ts`
3. No data ? → don't write a load function

```ts
// +page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch, locals }) => {
  const scan = await locals.db.scans.findOne(params.id);
  if (!scan) throw error(404);
  return { scan };
};
```

The auto-generated `./$types` types are real and accurate — use them, don't roll your own.

---

## TypeScript patterns

### `$props` — typed component inputs

```svelte
<script lang="ts">
  // Inline interface
  interface Props {
    title: string;
    count?: number;
    onclose: () => void;
  }
  let { title, count = 0, onclose }: Props = $props();

  // For generic components — declare on the script tag, NOT $props<T>()
</script>
```

**Generic components**:

```svelte
<script lang="ts" generics="T extends { id: string }">
  interface Props<T> {
    items: T[];
    render: (item: T) => string;
  }
  let { items, render }: Props<T> = $props();
</script>
```

`$props<T>()` does NOT exist. Don't write it.

### `import type` is mandatory

`verbatimModuleSyntax: true` means mixed value+type imports fail:

```ts
// WRONG — svelte-check fails
import { ScanResult, fetchScan } from '$lib/api/scans';

// CORRECT
import { fetchScan } from '$lib/api/scans';
import type { ScanResult } from '$lib/api/scans';
```

### Event handlers in Svelte 5

```svelte
<!-- New syntax — no `on:` prefix -->
<button onclick={(e: MouseEvent) => doThing(e)}>Click</button>
<input oninput={(e: Event & { currentTarget: HTMLInputElement }) => bar(e.currentTarget.value)} />

<!-- Old `on:click={...}` still works but is the legacy syntax -->
```

### Snippets (Svelte 5 replacement for slots)

```svelte
<!-- Defining a snippet -->
{#snippet item(label: string, count: number)}
  <div class="row">{label}: {count}</div>
{/snippet}

{@render item('Apples', 3)}
```

Children are passed as a special `children` snippet prop:

```svelte
<!-- Card.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children, footer }: { children: Snippet; footer?: Snippet } = $props();
</script>
<div class="card">
  {@render children()}
  {#if footer}<div class="card-footer">{@render footer()}</div>{/if}
</div>
```

---

## Browser-only libraries — the only correct mount

`force-graph`, `cytoscape`, `three`, anything that reads `window` at module load:

```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  let container = $state<HTMLDivElement>();
  let lib: any;

  onMount(() => {
    if (!browser || !container) return;
    let cancelled = false;
    (async () => {
      const { default: Lib } = await import('the-browser-only-lib');
      if (cancelled) return;
      lib = new Lib(container);
    })();
    return () => {
      cancelled = true;
      lib?.destroy?.();
      lib = null;
    };
  });
</script>

<div bind:this={container}></div>
```

Three rules:
1. **Dynamic import** — never top-level static.
2. **`browser` guard** — defensive, even though `onMount` only runs in the browser.
3. **Cleanup function** — call the lib's `destroy` / `dispose` / equivalent.

---

## Testing — Vitest + browser-svelte

```bash
npm install -D vitest vitest-browser-svelte @vitest/browser playwright
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    browser: { enabled: true, provider: 'playwright', name: 'chromium' },
  },
});
```

**Correct testing-library API names** — these matter:
- `getByRole`, `findByRole`, `queryByRole`
- `getByText`, `getByLabelText`, `getByPlaceholderText`, `getByDisplayValue`
- `getByAltText`, `getByTitle`, `getByTestId`

**Wrong names that don't exist** (do NOT hallucinate these):
- ❌ `getByLabelAttribute`
- ❌ `getByLabel`
- ❌ `getByLabelFor`
- ❌ `getByName`

```typescript
// component.test.ts
import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Counter from './Counter.svelte';

test('counter increments', async () => {
  const screen = render(Counter, { count: 0 });
  await screen.getByRole('button').click();
  await expect.element(screen.getByText('1')).toBeInTheDocument();
});
```

---

## Styling — Tailwind v4 in SvelteKit

```bash
npm install -D tailwindcss @tailwindcss/vite
```

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
});
```

```css
/* src/app.css */
@import "tailwindcss";
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>
{@render children()}
```

Component-scoped styles: `<style>` block in the `.svelte` file is automatically scoped. Use `:global(...)` for selective unscoping.

---

## Cloud Run deployment — `adapter-node`

```bash
npm install -D @sveltejs/adapter-node
```

```js
// svelte.config.js
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter() },
};
```

### Multi-stage Dockerfile

```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "build"]
```

### Required env vars on Cloud Run

```bash
gcloud run deploy my-app \
  --source . \
  --region=northamerica-northeast1 \
  --set-env-vars=ORIGIN=https://my-app-xxx.a.run.app \
  --set-env-vars=PROTOCOL_HEADER=x-forwarded-proto \
  --set-env-vars=HOST_HEADER=x-forwarded-host
```

**Why each one**:
- `ORIGIN` — SvelteKit needs this for CSRF protection. Without it, form actions return 403.
- `PROTOCOL_HEADER=x-forwarded-proto` — Cloud Run terminates TLS; tells SvelteKit to trust the forwarded `https`.
- `HOST_HEADER=x-forwarded-host` — same, for the host name.
- `PORT` is auto-injected by Cloud Run; adapter-node respects it.

### Strategy: proxy backend through SvelteKit `+server.ts`

Eliminate CORS entirely by proxying FastAPI calls through your own `+server.ts` endpoints. The browser never makes a cross-origin request:

```ts
// src/routes/api/scans/+server.ts
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
  const body = await request.json();
  const upstream = await fetch(`${env.BACKEND_URL}/scans`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return json(await upstream.json(), { status: upstream.status });
}
```

Frontend calls `/api/scans`, never the backend's URL directly. **Secrets never leave the server.** No CORS configuration needed.

### Environment variables — `$env/static/*` vs `$env/dynamic/*`

- `$env/static/private` — read at **build time**, baked into the bundle. Fastest, but rebuilt on every change. Use for things that don't change between deploys.
- `$env/dynamic/private` — read at **runtime**. Use for Cloud Run service-injected env vars (where same image deploys to dev/prod with different env).
- `$env/static/public` / `$env/dynamic/public` — same, but accessible from client code. **Anything in `public` is exposed to the browser** — never put secrets here.

---

## Common pitfalls — the F.9-class disasters

1. **`#` comments break TypeScript.** Comments are `//` and `/* */` in `<script>`. NEVER `#` (that's Python/shell). The compiler parses `# foo` as an identifier.

2. **Literal HTML inside JS comments confuses the Svelte preprocessor.**
   ```ts
   // BAD — preprocessor sees "<style>" and gets confused
   const code = "// <style>color: red</style>"; // PARSER CRASH
   ```
   Fix: split the string — `"<" + "style>"` — or escape the angle brackets.

3. **Async `$effect` silently drops cleanup.** Never `$effect(async () => ...)` directly. Wrap an async IIFE inside a sync effect that returns proper cleanup.

4. **Static import of browser-only lib crashes SSR.** Use dynamic `import()` inside `onMount` / `$effect` with `browser` guard.

5. **Mutating `$state` array sub-properties IS reactive.** Don't reassign for the sake of it: `state.items[0].done = true` works. But destructuring breaks it: `let { items } = state` captures the array reference, not the proxy.

6. **`<script lang="ts">` is required for TS.** Without it, types are silently stripped — `let count: number = $state(0)` becomes `let count = $state(0)` with no error.

7. **`import type` is mandatory** with `verbatimModuleSyntax: true`. svelte-check fails otherwise.

8. **HMR double-mounts canvas-based libs without proper cleanup.** Symptom: ghost canvases, 2× CPU. Fix: `$effect` with returned teardown that calls the lib's destroy method.

9. **`$state.snapshot(value)`** when passing reactive proxies to external libraries. JSON.stringify, force-graph.graphData, etc. — they don't know how to traverse Proxy objects.

10. **Server-only modules trip on accidental imports.** Importing `$lib/server/db.ts` from a `.svelte` component fails the build with a clear error. Move shared types to `$lib/types/` instead.

---

## Quality checklist

Before shipping a SvelteKit component / route:

- [ ] `<script lang="ts">` on every Svelte file
- [ ] All type-only imports use `import type`
- [ ] Every `$effect` that touches third-party state returns cleanup
- [ ] No `$effect(async () => ...)` — use sync effect with async IIFE inside
- [ ] Browser-only libs dynamically imported with `browser` guard
- [ ] `$props()` typed via interface, not `$props<T>()`
- [ ] Generic components use `<script lang="ts" generics="T">`
- [ ] No legacy `export let` in runes-mode files
- [ ] No `#` comments anywhere — `//` / `/* */` only
- [ ] Server-only code lives under `$lib/server/` or `*.server.ts`
- [ ] `+server.ts` endpoint handlers cover only HTTP methods the route needs
- [ ] `npm run check` passes (svelte-check + tsc)
- [ ] Tests use correct testing-library names (no `getByLabelAttribute`)
- [ ] Cloud Run deploy: `ORIGIN`, `PROTOCOL_HEADER`, `HOST_HEADER` set

---

*Svelte 5 is sharp on purpose. The compiler does the work — give it the explicit signals it needs.*
