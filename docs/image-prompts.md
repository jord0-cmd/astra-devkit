# Astra DevKit — Image Generation Prompts

Reusable prompts for regenerating marketing images. Use with OPTIC generator:
```bash
python3 generate.py "PROMPT" -q -a ASPECT -r 2K -o OUTPUT.png
```

---

## Hero Banner

**Aspect**: 21:9 | **Model**: Quality (Pro)

```
Design a wide cinematic hero banner for a GitHub README page. This is for 'ASTRA DevKit v4.0' — an AI engineering partner for Google Gemini CLI.

VISUAL STYLE: Deep space nebula, cinematic, widescreen letterbox feel. Rich purple and blue gas clouds with bright cyan and green energy accents. Stars scattered throughout. Premium, breathtaking, like a movie title card.

CONTENT (minimal — this is a hero, not an infographic):

Centre of the image: 'ASTRA' in large, luminous typography. The letters A, S, T are formed from a glowing abstract syntax tree — nodes connected by bright energy lines, like a constellation. R and A in clean modern sans-serif. The tree structure should be intricate and beautiful.

Below the title: 'DevKit v4.0' in smaller clean text.
Below that: 'AI Engineering Partner for Gemini CLI' in subtle light text.

Below that, a single line of stats in small, elegant text separated by subtle dividers:
'33 Skills | 17 Hooks | 9 Agents | 10 MCPs | 21 Rules | 7 Themes'

The bottom of the image fades to pure black (#0d1117) — this is critical because it will sit at the top of a dark GitHub README page and needs to blend seamlessly into the page background.

DO NOT include any other text, sections, or content. This is purely a visual hero banner. Keep it clean, cinematic, and stunning. The nebula and energy effects should feel alive — like the AST tree is pulsing with data flowing through it.

Think: movie poster title card meets developer tool branding. If someone sees this on a GitHub page, they should stop and look.

Maximum resolution, highest detail.
```

---

## Infographic — Beginners (Office Mode)

**Aspect**: 16:9 | **Model**: Quality (Pro)

```
Design a wide 16:9 infographic poster for complete beginners. Title: 'ASTRA DevKit — Your AI Super-Colleague'. For people who have NEVER coded. NO JARGON.

VISUAL STYLE: Deep space nebula background, transitioning to clean dark UI. Blue (#58a6ff), purple (#d2a8ff), green (#7ee787) accents. Glassmorphism cards. Constellation star decorations. Same style as the nebula version — premium, warm, readable. More content than the previous version — give them real information, just in plain language.

LAYOUT (left to right, 4 columns):

COLUMN 1 — MEET ASTRA:
Large title: 'ASTRA' with a glowing star motif on the A.
Subtitle: 'Your AI Super-Colleague'
Sub-subtitle: 'DevKit v4.0 for Google Gemini CLI'

Description paragraph:
'Astra is an AI that lives in your command prompt. You type requests in plain English and she creates real files — documents, presentations, spreadsheets, websites, images, and more. She shows you everything before saving it, so you are always in control.'

Three bullet points with star icons:
★ You type in everyday language — no code needed
★ She builds it and shows you before saving anything
★ If you can copy and paste, you can use Astra

COLUMN 2 — WHAT YOU CAN MAKE:
Title: 'What You Can Make'

Six capability cards in a 3x2 grid, each with icon, name, AND an example of what to type:

Card 1: Presentations icon
'PowerPoint Decks'
Type: Make me a 10-slide presentation on climate change

Card 2: Document icon
'Word Documents'
Type: Write a cover letter for a marketing job

Card 3: Spreadsheet icon
'Excel Spreadsheets'
Type: Create a monthly budget tracker with categories

Card 4: PDF icon
'PDF Reports'
Type: Research AI trends and write a professional report

Card 5: Image icon
'AI Images'
Type: Generate an image of a sunset over mountains

Card 6: Globe icon
'Websites'
Type: Build me a portfolio website with my projects

COLUMN 3 — HOW TO USE THE INTERFACE:
Title: 'How It Works'

Show a terminal mockup with a conversation:
you: Create a presentation about renewable energy
astra: I will create a 10-slide PowerPoint covering solar, wind, and hydro energy. Each slide will have a title, key points, and a summary slide at the end.
[Astra creates the file]
astra: Done! Created renewable-energy.pptx. Want me to change anything?

Below the terminal, labeled interface guide with keyboard key graphics:
'Your Keyboard Controls:'
ESC key — 'Stop generation if you change your mind'
Y key — 'Yes, accept the changes Astra made'
N key — 'No, undo the changes'
/help — 'Type this anytime to see what Astra can do'

Important note in a highlighted box:
'You approve every change before it happens. Astra always asks before modifying files. You are in control.'

COLUMN 4 — GET STARTED:
Title: 'Start Here'

Four steps in large numbered circles connected by a dotted path:

Step 1: 'Install Node.js'
'Download from nodejs.org — click the big green button and install it. This is free and takes 2 minutes.'

Step 2: 'Install Astra'
'Open your command prompt and paste this command:'
npm install -g github:jord0-cmd/astra-devkit
'Then type: astra-devkit setup'
'The setup wizard will ask your name and walk you through everything.'

Step 3: 'Open a project folder'
'Create or open a folder for your work. Open your command prompt in that folder. Type astra-devkit to start.'

Step 4: 'Say hello and try /mentor'
'Type /mentor and Astra becomes your personal guide. She will walk you through everything step by step, show you what she can do, and help you build your first project.'

Below the steps:
'Or say kickstart to start a guided project — Astra will ask what you want to build and help you shape the idea before building it.'

Green reassurance badge: 'No coding experience needed. Astra writes the code for you.'

BOTTOM STRIP across full width:
Left: 'Office Mode — /mentor — step-by-step guided learning for beginners'
Centre: github.com/jord0-cmd/astra-devkit
Right: 'Free and open source'

This poster must feel like a warm welcome mat, not a technical manual. Every single word should be understandable by someone who has never opened a terminal before. Show them WHAT to type to get results — do not just say she can do things, show the exact words they would type. Maximum resolution, crisp readable text, publication quality.
```

---

## Infographic — Developers (Code Mode)

**Aspect**: 16:9 | **Model**: Quality (Pro)

```
Design a wide 16:9 infographic poster for experienced developers. Visually STUNNING — this must be beautiful enough to frame on a wall.

VISUAL STYLE: Deep space nebula background with rich purples, blues, and cyan gas clouds. The Architect Pattern pipeline should look like a GALACTIC FLOW — glowing energy streams connecting the nodes like a constellation map or neural network in space. Stars and particle effects throughout. The ASTRA title should have the AST letters formed from a luminous syntax tree structure — glowing nodes connected by bright edges, like a constellation that spells AST, with RA in clean sharp typography. The whole poster should feel like looking at the engineering blueprint of a starship overlaid on a nebula. Glassmorphism cards with frosted glass effect and subtle blur. Neon blue (#58a6ff), purple (#d2a8ff), green (#7ee787), cyan glow effects. Premium, cinematic, breathtaking.

LAYOUT (4 columns, left to right):

COLUMN 1 — ASTRA:
Large title: 'ASTRA' — the A, S, T letters are formed from a glowing abstract syntax tree visualization (nodes connected by luminous branches). The R and A are clean modern typography. This should be visually striking and intricate — the tree structure is beautiful, not just functional.
Below: 'Abstract Syntax Tree + ra = AST-ra' in subtle text
Below that: 'DevKit v4.0'

Main hook in large bold white text with slight glow:
'Stop generating technical debt faster.'

Sub-hook in blue:
'Generation is cheap. Validation is engineering.'

Description in normal text:
'Gemini CLI engineering environment with contract-first architecture, AST-grep structural analysis, and 17 hard quality gates that block bad code — not warn about it.'

Badge: '/engineer — full technical mode'

COLUMN 2 — THE ARCHITECT PATTERN:
Title: 'The Architect Pattern'
The pipeline flows VERTICALLY with glowing energy streams connecting each node — like a galactic data pipeline or a stellar energy conduit. Each node is a glassmorphism card with a glowing icon:

Node 1 (blue glow, API icon): 'CONTRACT-FIRST'
'API boundaries and domain model defined before any code. The contract IS the architecture. Remove it and pass rate drops 42.5 percentage points.'

Flowing energy stream down to:
Node 2 (purple glow, brain icon): 'PLAN MODE'
'Pro model architects the system. Flash model implements. Automatic routing. Pro usage dropped from 69% to 21%.'

Flowing energy stream down to:
Node 3 (cyan glow, team icon): 'SPECIALIST AGENTS'
'9 agents: backend-builder, frontend-builder, test-writer, code-reviewer, debugger, contract-enforcer, a11y-auditor, doc-generator, dx-orchestrator.'

Flowing energy stream down to:
Node 4 (green/red glow, gate icon): 'QUALITY GATES'
'17 hooks that BLOCK, not warn. TDD, secret scanning, build verification, mutation testing, AST drift detection.'

COLUMN 3 — MEASURED RESULTS:
Title: 'Measured Results'
Dashboard-style HUD with glowing statistics. Each stat in its own glassmorphism panel:

'19% → 100%' (large, green glow)
'Fullstack build pass rate with Architect Pattern'

'75% faster' (large, blue glow)
'1h 38m down to 24 minutes'

'79% cheaper' (large, purple glow)
'Dollar 7.69 down to Dollar 1.61 per build'

'1 prompt' (large, cyan glow)
'Down from 4 human prompts'

Methodology note: 'Three-point ablation study. Causal evidence.'

Below: 'AST-grep: structural transforms on the syntax tree. Zero hallucination.'

COLUMN 4 — YOUR STACK:
Title: 'Your Stack'
Technology badges in a visually rich cloud — each badge glows slightly with its brand color where possible:
Python, TypeScript, Rust, React, FastAPI, Docker, Azure, PostgreSQL, Redis, SQLAlchemy, Prisma, Tailwind, Zustand, pytest, Vitest, CUDA, PyTorch
Label: '33 Skills (24 dev + 9 office)'

Slash Commands section:
/review — code audit
/test — generate coverage
/debug — root-cause analysis
/skills — loaded domains
kickstart — spec-driven setup

MCP Servers section:
Context7, Pandoc, PowerPoint, Excel, Word, Playwright, Gemini Imagen, Database Toolbox, Docker, Azure

BOTTOM STRIP:
'/engineer — senior-dev collaboration' | github.com/jord0-cmd/astra-devkit | '21 Rules | 17 Hooks | 9 Agents | 33 Skills | 10 MCPs'

CRITICAL VISUAL NOTES:
- The pipeline between Architect Pattern nodes should look like flowing galactic energy, not just arrows
- The AST in the title must be intricate and beautiful — a real syntax tree visualization made of light
- Stars and nebula gas should be visible throughout, not just in the background — the content floats IN the nebula
- The Your Stack tag cloud should look like a constellation of technology
- Every card has the frosted glassmorphism effect
- Do NOT include any layout labels like 'COLUMN 1' or 'THE HOOK' — only actual content
- This poster should be beautiful enough that a developer would want it on their wall

Maximum resolution, highest detail, publication quality.
```

---

## LinkedIn Sales Pitch

**Aspect**: 4:5 | **Model**: Quality (Pro)

```
Design a LinkedIn-format infographic poster (portrait, professional). This is a SALES PITCH for getting people to try AI coding through the terminal.

VISUAL STYLE: Dark background with the nebula/space theme but clean and professional. Blue (#58a6ff), green (#7ee787), purple (#d2a8ff) accents. Modern, premium, eye-catching in a LinkedIn feed. NOT cluttered — punchy, bold, scannable.

CONTENT (top to bottom):

HEADER — THE HOOK:
Large bold text: 'You have a Google account.'
Below in slightly smaller text: 'You already have access to the most powerful AI coding tool available.'
Below that in green: 'FREE. 1,000 AI requests per day. No credit card.'

SECTION 1 — WHAT YOU GET FOR FREE:
Title: 'What 1,000 Free Requests Gets You Every Day'
Clean table or card layout:
'10-15 complete fullstack web apps'
'200+ bug fixes or code explanations'
'100+ PowerPoint presentations'
'100+ PDF reports'
'50+ deep research summaries'
'25+ websites built from a description'

Small note: 'Powered by Gemini 3 Pro with 1 million token context'

SECTION 2 — WHO IS THIS FOR:
Two columns:
Column A: 'Never coded before?'
'Open PowerShell. Type 3 commands. Start creating.'
'Astra writes the code. You describe what you want.'
'Presentations. Documents. Websites. Images. Research.'

Column B: 'Experienced developer?'
'17 quality gates that block bad code automatically.'
'Contract-first architecture. AST structural analysis.'
'Took fullstack builds from 19% to 100% pass rate.'

SECTION 3 — 3 STEPS:
Three numbered steps, big and clean:
1. 'Install Node.js from nodejs.org'
2. 'npm install -g github:jord0-cmd/astra-devkit'
3. 'astra-devkit setup'

Below: 'Works on Windows, Mac, and Linux. The setup wizard does the rest.'

SECTION 4 — THE TRANSFERABLE SKILL:
Small callout box:
'Everything you learn here transfers directly to other AI coding tools like Claude Code. The command line is where professional AI development happens. This is your free on-ramp.'

BOTTOM:
'ASTRA DevKit v4.0 — Free and Open Source'
'github.com/jord0-cmd/astra-devkit'

CRITICAL: This poster needs to stop someone scrolling LinkedIn. The top section must be the hook — you already have a Google account, you already have access. The numbers (10-15 fullstack apps per day for FREE) are the closer. Make the text large enough to read on a phone screen. Clean, bold, professional. No clutter.

Maximum resolution, crisp text, publication quality.
```

---

## Notes

- All prompts updated to reflect: 33 skills, 10 MCPs, 7 themes, 2 modes (Office + Code)
- Hero banner stats line updated
- Developer poster: "33 Skills (24 dev + 9 office)" in Your Stack
- Beginners poster: mentions Office Mode and /mentor
- LinkedIn poster: mentions both audiences (never coded / experienced dev)
- Use `python3 generate.py "PROMPT" -q -a ASPECT -r 2K -o OUTPUT.png` to regenerate
- Always use the Quality model (-q) for final versions
