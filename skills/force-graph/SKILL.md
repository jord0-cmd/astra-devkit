---
name: force-graph
description: Use this skill when building cinematic graph visualisations with the `force-graph` npm package (vasturiano vanilla canvas library — NOT `react-force-graph` or `3d-force-graph`). Covers Svelte 5 mount/cleanup lifecycle, glow halos via radial gradients, pulse rings via `onRenderFramePost`, money-flow particles via `linkDirectionalParticles` and `emitParticle`, click-zoom-to-cluster via `zoomToFit(ms, padding, filter)`, force tuning for medium-tight cluster aesthetics, and the canvas-not-CSS gotchas that bite first-timers. Activate for AML/fraud/network visualisation, Obsidian-graph-style aesthetics, or any 1k-5k node interactive graph where painterly canvas effects matter.
---

# force-graph

Vanilla JS, Canvas 2D, force-directed graph component (`vasturiano/force-graph` v1.51.4+, MIT). Wraps **d3-force-3d** for physics, exposes a chainable kapsule API, and hands you the raw 2D context via `nodeCanvasObject` / `linkCanvasObject` for arbitrary painterly effects.

**Pick force-graph when**:
- 500-5000 visible nodes (up to ~10k background context nodes)
- You want painterly effects (glow halos, pulses, particles, gradients) — Canvas 2D, not WebGL shaders
- You're in Svelte / vanilla JS / any framework — *NOT* React with the `react-force-graph` wrapper
- You need MIT licensing (Cosmograph commercial licensing is a non-starter)

**Pick something else when**:
- More than 10k nodes → Sigma.js v3 + WebGL
- You need formal graph algorithms (BFS, centrality, etc.) → Cytoscape.js
- You're in React → `react-force-graph` (same author, same API)
- You need 3D + bloom/post-processing → `3d-force-graph` (Three.js sibling)

---

## Critical install fact

```bash
npm install force-graph
```

`force-graph@1.51.4+` ships its own TypeScript declarations at `dist/force-graph.d.ts`. **Do NOT install `@types/force-graph`** — there is no such package, and using one would override the bundled, generic-aware types. The bundled types are accurate.

---

## Quickstart — Svelte 5 + TypeScript (under 30 lines)

```svelte
<!-- src/lib/components/Graph.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type ForceGraphCtor from 'force-graph';
  import type { GraphData, NodeObject, LinkObject } from 'force-graph';

  interface Node extends NodeObject { id: string; flagged?: boolean; cluster?: string; }
  interface Link extends LinkObject<Node> { amount?: number; flagged?: boolean; }

  let { data }: { data: GraphData<Node, Link> } = $props();

  let container = $state<HTMLDivElement>();
  let graph: ReturnType<typeof ForceGraphCtor<Node, Link>> | undefined;

  onMount(async () => {
    const { default: ForceGraph } = await import('force-graph'); // browser-only
    graph = new ForceGraph<Node, Link>(container!)
      .graphData(data)
      .backgroundColor('#0a0e1a')
      .nodeRelSize(4)
      .cooldownTicks(150)
      .warmupTicks(20)
      .autoPauseRedraw(false) // keep RAF alive for any custom animations
      .onEngineStop(() => graph!.zoomToFit(800, 60));

    return () => { graph?.pauseAnimation(); container!.innerHTML = ''; };
  });

  $effect(() => { graph?.graphData(data); }); // reactive re-bind
</script>

<div bind:this={container} class="w-full h-full"></div>
```

That's the bare minimum: dynamic import (SSR-safe), strict-typed nodes/links, `zoomToFit` after settle, cleanup that nukes the canvas + RAF loop.

---

## Cinematic patterns (paste-ready)

### 1. Glowing halo on flagged nodes — radial gradient

Use `nodeCanvasObjectMode: 'before'` so the halo paints *underneath* the default circle:

```ts
const NEON = '#1EE0FF';
const NODE_R = 6;

graph
  .nodeCanvasObjectMode((n) => n.flagged ? 'before' : undefined)
  .nodeCanvasObject((node, ctx, globalScale) => {
    if (!node.flagged || node.x == null || node.y == null) return;
    const r = NODE_R * 3.5;
    const grad = ctx.createRadialGradient(node.x, node.y, NODE_R * 0.5, node.x, node.y, r);
    grad.addColorStop(0, 'rgba(30, 224, 255, 0.55)');
    grad.addColorStop(0.5, 'rgba(30, 224, 255, 0.18)');
    grad.addColorStop(1, 'rgba(30, 224, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fill();
  })
  .nodeColor((n) => n.flagged ? NEON : 'rgba(80, 180, 220, 0.18)')
  .nodeVal((n) => n.flagged ? 8 : 1);
```

**Why radial gradient over `ctx.shadowBlur`**: `shadowBlur` is per-draw expensive and stacks badly with many glowing nodes. A pre-computed radial gradient is one draw per node and composites cleanly. Reserve `shadowBlur` for ≤20 extreme-glow nodes.

### 2. Pulsing severity ring on the kingpin — RAF + sin wave

```ts
let t0 = performance.now();

graph
  .autoPauseRedraw(false) // CRITICAL — see gotcha #2
  .onRenderFramePost((ctx, globalScale) => {
    const kingpin = data.nodes.find(n => n.id === KINGPIN_ID);
    if (!kingpin || kingpin.x == null) return;

    const t = (performance.now() - t0) / 1000;
    const period = 1.5;
    const phase = (t % period) / period;
    const ease = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
    const radius = NODE_R * (2 + ease * 4);
    const alpha = 0.65 * (1 - phase);

    ctx.beginPath();
    ctx.arc(kingpin.x, kingpin.y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = `rgba(255, 60, 80, ${alpha})`;
    ctx.lineWidth = 2 / globalScale; // visually stable across zoom
    ctx.stroke();
  });
```

`autoPauseRedraw(false)` is non-negotiable — without it the RAF stops when `cooldownTicks` exhaust and the pulse freezes. Use `onRenderFramePost` (not `Pre`) so the ring paints on top.

### 3. Two-pass link rendering — bright accents over faint background

Approach A (simplest) — sort links so flagged ones paint last:

```ts
const sortedLinks = [...rawLinks].sort((a, b) => Number(!!a.flagged) - Number(!!b.flagged));
graph.graphData({ nodes, links: sortedLinks });
```

Approach B — accessor styling, single pass:

```ts
graph
  .linkColor((l) => l.flagged ? '#1EE0FF' : 'rgba(70, 110, 140, 0.12)')
  .linkWidth((l) => l.flagged ? 1.8 : 0.4)
  .linkLineDash((l) => l.flagged ? null : [2, 3]);
```

Approach C — full custom paint with gradient along the edge (for flagged only):

```ts
graph
  .linkCanvasObjectMode((l) => l.flagged ? 'replace' : undefined)
  .linkCanvasObject((link, ctx) => {
    const { source, target } = link;
    if (typeof source !== 'object' || typeof target !== 'object') return;
    if (source.x == null || target.x == null) return;
    const grad = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
    grad.addColorStop(0, 'rgba(30, 224, 255, 0.85)');
    grad.addColorStop(1, 'rgba(255, 60, 80, 0.85)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  });
```

### 4. Money flowing — particles keyed to amount + severity

```ts
graph
  .linkDirectionalParticles((l) => {
    if (!l.flagged) return 0;
    return ({ low: 2, medium: 4, high: 6 } as const)[l.severity ?? 'low'];
  })
  .linkDirectionalParticleSpeed((l) => {
    const amt = l.amount ?? 0;
    return Math.min(0.012, 0.002 + amt / 5_000_000);
  })
  .linkDirectionalParticleWidth((l) => l.flagged ? 3 : 0)
  .linkDirectionalParticleColor((l) => l.severity === 'high' ? '#FF3C50' : '#1EE0FF');
```

**Particle ceiling**: ~1500 simultaneous active particles is the smooth-60fps boundary on mid-range hardware. For "burst on click" without persistent cost, use `emitParticle` (one-shot, no count overhead):

```ts
graph.onLinkClick((link) => {
  for (let i = 0; i < 10; i++) setTimeout(() => graph!.emitParticle(link), i * 80);
});
```

### 5. Click cluster → smooth zoom-to-fit-cluster

```ts
graph.onNodeClick((node) => {
  if (!node.cluster) {
    graph!.zoomToFit(800, 80);
    return;
  }
  const memberIds = new Set(data.nodes.filter(n => n.cluster === node.cluster).map(n => n.id));
  graph!.zoomToFit(800, 60, (n) => memberIds.has(n.id));
});

graph.onBackgroundClick(() => graph!.zoomToFit(800, 80));
```

`zoomToFit(durationMs, paddingPx, nodeFilterFn)` — the predicate selects which nodes form the bounding box. **Padding is screen pixels**, not graph units.

### 6. Hover tooltip — DOM overlay (Tailwind-able)

The built-in `nodeLabel` is rendered by `float-tooltip` (sibling lib) — fast, ugly-by-default, only stylable via global CSS. For full control with Tailwind, drive a sibling div:

```svelte
<script lang="ts">
  let hover = $state<{ x: number; y: number; node: Node } | null>(null);

  // After graph is constructed:
  graph.onNodeHover((node) => {
    if (!node || node.x == null) { hover = null; return; }
    const screen = graph!.graph2ScreenCoords(node.x, node.y);
    hover = { x: screen.x, y: screen.y, node };
  });
</script>

{#if hover}
  <div class="fixed pointer-events-none z-50 px-3 py-2 bg-zinc-900/95
              border border-cyan-500/40 rounded-lg backdrop-blur-sm"
       style="left: {hover.x + 12}px; top: {hover.y + 12}px;">
    <div class="text-cyan-300 font-mono text-xs">{hover.node.id}</div>
  </div>
{/if}
```

`graph2ScreenCoords(x, y)` is the API for any DOM overlay synced to graph features — accounts for zoom and pan.

---

## Svelte 5 lifecycle — the only correct shape

`force-graph` reads `window` at module load, so **static imports crash SvelteKit SSR**. Three rules:

1. **Dynamic import** inside `onMount` (or `$effect` with `browser` guard).
2. **Construct ONCE** — never inside an `$effect` keyed on data.
3. **Cleanup function MUST** call `pauseAnimation()` and clear container DOM.

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import type ForceGraphCtor from 'force-graph';
  import type { GraphData, NodeObject, LinkObject } from 'force-graph';

  interface Node extends NodeObject { id: string; cluster?: string; flagged?: boolean; }
  interface Link extends LinkObject<Node> { amount?: number; flagged?: boolean; }

  let { data, onClusterClick }: {
    data: GraphData<Node, Link>;
    onClusterClick?: (clusterId: string) => void;
  } = $props();

  let container = $state<HTMLDivElement>();
  let graph: InstanceType<typeof ForceGraphCtor<Node, Link>> | undefined;
  let mounted = $state(false);

  onMount(() => {
    if (!browser || !container) return;
    let cancelled = false;

    (async () => {
      const { default: ForceGraph } = await import('force-graph');
      if (cancelled || !container) return;

      graph = new ForceGraph<Node, Link>(container)
        .backgroundColor('#0a0e1a')
        .graphData(data)
        .nodeRelSize(4)
        .cooldownTicks(150)
        .warmupTicks(20)
        .d3VelocityDecay(0.35)
        .autoPauseRedraw(false)
        .onEngineStop(() => graph?.zoomToFit(800, 60))
        .onNodeClick((n) => n.cluster && onClusterClick?.(n.cluster));

      mounted = true;
    })();

    return () => {
      cancelled = true;
      graph?.pauseAnimation();
      if (container) container.innerHTML = '';
      graph = undefined;
    };
  });

  // Reactive re-bind — fast op, d3 diffs internally and preserves positions
  $effect(() => {
    if (mounted && graph) graph.graphData(data);
  });
</script>

<div bind:this={container} class="w-full h-full bg-[#0a0e1a]"></div>
```

**Reactive update rule**: pass a **fresh object reference** to trigger re-bind. Mutating the existing `data.nodes` array in place won't reliably trigger d3's diff. Always:

```ts
data = { nodes: [...data.nodes, newNode], links: data.links };
```

---

## TypeScript types

```ts
import ForceGraph from 'force-graph';
import type {
  GraphData,
  NodeObject,
  LinkObject,
  CanvasCustomRenderFn,
  CanvasCustomRenderModeFn,
  CanvasPointerAreaPaintFn,
  CanvasLinkParticleRenderFn,
} from 'force-graph';

// Always specify generics or callbacks see only NodeObject base type
type GraphInstance = ReturnType<typeof ForceGraph<MyNode, MyLink>>;
let g: InstanceType<typeof ForceGraph<MyNode, MyLink>> | undefined;
```

**`exactOptionalPropertyTypes` gotcha**: `node.x`, `y`, `vx`, `vy`, `fx`, `fy` are all `number | undefined`. Always guard inside canvas callbacks:

```ts
.nodeCanvasObject((node, ctx) => {
  if (node.x == null || node.y == null) return;
  // ...
})
```

**Prefer accessor functions over property strings**: `nodeColor((n) => n.color ?? '#666')` gets full inference; `nodeColor('color')` won't catch typos.

---

## Forces tuning — the AML / "money-flow" aesthetic

Default forces are too spread-out for medium-tight clusters. Tune for visible separation without flying off:

```ts
import { forceManyBody, forceLink, forceCollide, forceCenter, forceY } from 'd3-force-3d';

graph
  .d3Force('charge', forceManyBody().strength(-220).distanceMax(400))
  .d3Force('link', forceLink().distance((l: Link) => l.flagged ? 24 : 60).strength(0.55))
  .d3Force('collide', forceCollide(12))
  .d3Force('center', forceCenter(0, 0).strength(0.04))
  .d3Force('y', forceY(0).strength(0.02));
```

| Knob | Default | AML setting | Why |
|---|---|---|---|
| `d3VelocityDecay` | 0.4 | **0.35** | More visible settling motion |
| `cooldownTicks` | Infinity | **150** | Predictable freeze after settle |
| `warmupTicks` | 0 | **20** | Pre-runs 20 ticks before first paint — no "explosion-from-centre" intro |
| Charge strength | -30 | **-220** | Strong repulsion → cluster separation |
| Link distance | 30 | **24 (flagged) / 60 (background)** | Tight clusters, spread background |
| Collide radius | none | **12** | Stops halos overlapping |

**Freeze layout completely** after settle:

```ts
graph.onEngineStop(() => {
  graph!.graphData().nodes.forEach((n) => { n.fx = n.x; n.fy = n.y; });
});
```

**Reheat for re-layout** (e.g., new cluster revealed):

```ts
function reheat() {
  graph!.graphData().nodes.forEach((n) => { delete n.fx; delete n.fy; });
  graph!.d3ReheatSimulation();
}
```

---

## Performance thresholds

| Nodes | Links | Particles | Notes |
|---|---|---|---|
| ≤ 500 | ≤ 1000 | ≤ 200 | Effortless. All effects on. |
| 1k–2k | ≤ 4k | ≤ 500 | **Sweet spot.** Use `cooldownTicks(150)`, freeze layout. |
| 2k–5k | ≤ 10k | ≤ 200 | Drop `nodeCanvasObject` glow for non-flagged; default circles for the rest. |
| 5k–10k | ≤ 20k | 0 | Disable particles. Tighten link strokes, kill curvature. |
| > 10k | — | — | **Switch to Sigma.js v3 (WebGL)**. Canvas can't keep up. |

**Other levers**:
- `enablePointerInteraction(false)` — disables hover hit-testing (~3ms/frame saved on dense graphs)
- `linkVisibility((l) => globalScale > 0.3 ? true : l.flagged)` — only flagged links when zoomed out
- `window.devicePixelRatio = 1` (set globally before mount) — halves pixel work, looks slightly softer; only on background views
- `autoPauseRedraw(true)` — default; set `false` if using `onRenderFramePost` for time-based animations

---

## The 10 gotchas that will bite first

1. **Canvas, not CSS.** No `box-shadow`, `border-radius`, `filter: blur()`, no Tailwind inside the canvas. Every visual is a `ctx.*` call. Border radius = `ctx.arc`. Shadow = `ctx.shadowBlur` or radial gradient. Blur of arbitrary content = pre-render to off-screen canvas with `ctx.filter = 'blur(Xpx)'` then `drawImage`. **The DOM stops at the container `<div>`.**

2. **`autoPauseRedraw(true)` + custom RAF effects = frozen pulse.** If you use `onRenderFramePost` for time-based animation, `autoPauseRedraw(false)` is mandatory. Otherwise the engine pauses the RAF after `cooldownTicks` and your animation freezes mid-frame.

3. **`nodeCanvasObjectMode` defaults to `'replace'`.** If you provide a `nodeCanvasObject` callback, the default circle is **NOT drawn** unless you set mode to `'before'` or `'after'`. Forgetting → invisible nodes. For halo-under-default-circle, use `'before'`.

4. **`link.source` / `link.target` mutate from string to object after first render.** When you build links as `{ source: 'acct_1', target: 'acct_2' }`, the engine resolves the IDs into actual node references. Inside `linkCanvasObject` always check: `if (typeof source !== 'object' || typeof target !== 'object') return;`

5. **HMR double-mount → ghost canvases.** Without proper cleanup (`pauseAnimation()` + clear container DOM children), HMR stacks canvases. Symptom: visual ghosting, 2× CPU. Fix: cleanup function in `onMount` (see lifecycle section).

6. **SSR crash on top-level import.** `force-graph` reads `window` at module load. Use dynamic `import('force-graph')` inside `onMount`, or guard with `browser`. Static import = `ReferenceError: window is not defined` at SSR time.

7. **Node positions are `number | undefined`.** During first few render frames the simulation hasn't run; `node.x` etc. are undefined. With `exactOptionalPropertyTypes` your callbacks need `if (node.x == null) return;` guards.

8. **`zoomToFit` padding is screen pixels, not graph units.** Counter-intuitive. `zoomToFit(800, 60)` = 60px of screen padding regardless of zoom level.

9. **Memory leak from constructing in `$effect`.** Don't `new ForceGraph(...)` inside `$effect` keyed on data — that creates a new canvas + RAF loop every time. Construct **once** in `onMount`, then call `graph.graphData(data)` for updates from a separate `$effect`.

10. **`devicePixelRatio` retina trap.** force-graph respects `window.devicePixelRatio` automatically. On a 2× display you're painting 4× the pixels. For demo quality this is fine; for max FPS on dense graphs, override **before** constructing: `window.devicePixelRatio = 1`.

---

## Alternatives at a glance

| Library | Renderer | When force-graph wins |
|---|---|---|
| **Cytoscape.js** | DOM/Canvas | Cytoscape excels at formal graph theory (BFS, centrality, selectors). force-graph wins on aesthetic — Cytoscape looks like a scientific paper, force-graph looks like Bloomberg terminal. |
| **Sigma.js v3** | WebGL | Sigma wins at >5k nodes (WebGL beats Canvas2D). force-graph wins on ease-of-effect — Sigma needs shaders for custom node visuals, force-graph gives you raw `ctx`. |
| **Cosmograph** | WebGL/GPU | Cosmograph beats everything at million-node scale. **Licensing concern**: not clearly MIT, Enterprise tier explicitly mentions "Commercial use" — avoid for paid products without legal review. |
| **D3 + custom canvas** | Canvas2D | force-graph **is** d3-force + canvas + chainable API. Going raw d3 means rebuilding zoom, drag, hit-testing, RAF — ~800 lines of code for what `new ForceGraph(el)` gives you. |

---

## Quality checklist

Before shipping a force-graph component:

- [ ] No static `import 'force-graph'` at top of `.svelte` file (SSR crash)
- [ ] Construction inside `onMount`, not `$effect`
- [ ] Cleanup function calls `pauseAnimation()` and clears container
- [ ] `nodeCanvasObjectMode` set if `nodeCanvasObject` is used
- [ ] `autoPauseRedraw(false)` if any custom `onRenderFramePost` animations
- [ ] All `node.x`/`node.y` access guarded with `== null` check
- [ ] All `link.source`/`link.target` access type-guarded with `typeof === 'object'`
- [ ] Generic types specified: `new ForceGraph<MyNode, MyLink>(...)`
- [ ] No `@types/force-graph` in package.json (doesn't exist)
- [ ] Particle count under 1500 simultaneous
- [ ] `cooldownTicks` set to prevent perpetual layout
- [ ] HMR tested — no ghost canvases on hot reload

---

*Canvas hands you a brush. force-graph gives you the canvas. Don't fight it with CSS — paint.*
