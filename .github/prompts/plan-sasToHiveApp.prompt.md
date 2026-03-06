# Plan: SAS-to-Hive Translation Web App (POC)

A Node.js (Express) + React (Vite) monorepo that lets users paste, upload, or browse SAS scripts and translates them to HiveQL via the **GitHub Models API** (`openai/gpt-4o-mini` — cheapest available model at ~$0.15/M input tokens). The UI shows a side-by-side SAS/Hive view with copy-to-clipboard, download as `.hql`, and an optional "Execute on Hive" panel. No authentication for the POC. The server-side file browser will use a mock directory tree.

**Key decisions made:**
- GitHub Models API via plain `fetch` (no SDK needed, simplest approach)
- `openai/gpt-4o-mini` as the default model (Claude/Anthropic models are **not** available on GitHub Models — only OpenAI, Meta, Microsoft, DeepSeek, xAI)
- Monaco Editor for the code panels (gives us syntax highlighting + a built-in diff view for free)
- npm workspaces monorepo (no extra tooling)

---

## ✅ Completed Features

### Light/Dark Mode Toggle
**Status:** Complete (5 Mar 2026)

- **Implementation:**
  - Added 16 CSS custom properties to `index.css`: 11 colour tokens + 5 theme-aware rgba/transparency variables (dark theme baseline + `[data-theme="light"]` override block with VS Code Light+ palette)
  - Toggle button in app header (top-right) displays ☀️ when dark mode active, 🌙 when light mode active
  - Theme state managed in `App.tsx` with `localStorage` persistence (key: `sas-hive-theme`)
  - `useEffect` hook applies `data-theme` attribute to `document.documentElement` on mount and when theme changes
  - Monaco Editor theme (both SAS/Hive editors) switches between `vs-dark` and `light` via theme prop
  - All hardcoded `rgba(255,255,255,...)` values in component CSS replaced with theme-aware variables

- **Files modified:**
  - `packages/client/src/index.css` — Added light theme override block + 5 new CSS variables
  - `packages/client/src/App.tsx` — Added theme state, localStorage sync, toggle handler, button JSX
  - `packages/client/src/App.css` — Added `.theme-toggle` button styles
  - `packages/client/src/components/TranslationView.tsx` — Added `theme` prop, Monaco theme mapping
  - `packages/client/src/components/FileTree.css` — Replaced rgba hover value with `--hover-bg` variable
  - `packages/client/src/components/HiveResults.css` — Replaced rgba row values with theme variables
  - `packages/client/src/components/Toolbar.css` — Replaced spinner rgba values with theme variables
  - `packages/client/src/components/FileUpload.css` — Replaced dragover rgba with `--dragover-bg` variable

- **Verification:**
  - ✅ Toggle in header switches entire app theme (sidebar, toolbar, editors, panels, tables)
  - ✅ Theme persists across page refresh via localStorage
  - ✅ Light mode: no visibility issues (spinner, hover states, table rows all readable)
  - ✅ Monaco editor CSS class (light theme) renders with proper syntax highlighting
  - ✅ No TypeScript or build errors

---

## Steps

### 1. Scaffold the monorepo
- Create root `package.json` with `"workspaces": ["packages/*"]`.
- Create `packages/server/` (Express + TypeScript) and `packages/client/` (Vite + React + TypeScript).
- Add `tsconfig.base.json` at root; extend it in each package.

### 2. Build the Express API (`packages/server/src/`)
- **`routes/translate.ts`** — `POST /api/translate` accepts `{ sasCode: string, model?: string }`, calls GitHub Models, returns `{ hiveSQL: string, explanation: string }`.
- **`routes/files.ts`** — `GET /api/files` returns a mock directory tree (JSON). `GET /api/files/:path` returns file contents. `POST /api/files/upload` accepts `.sas` file uploads via `multer`.
- **`routes/hive.ts`** — `POST /api/hive/execute` proxies a HiveQL query to a configurable Hive JDBC endpoint (or returns a mock result for the POC).
- **`services/github-models.ts`** — Wraps `fetch("https://models.github.ai/inference/chat/completions")` with auth (`GITHUB_PAT` env var), model selection, and streaming support (SSE).
- **`services/translation.ts`** — Builds the system prompt with: SAS→Hive function mapping table, `CALCULATED` → CTE rewrite rules, `.` → `NULL` conversion, date arithmetic notes, `PROC SORT NODUPKEY` → `ROW_NUMBER()` pattern, DATA step → CTE/window function patterns. Requests chain-of-thought (explain first, then translate). Temperature 0.2.
- **`services/mock-files.ts`** — Provides a mock directory tree with 5-10 sample `.sas` files covering PROC SQL, DATA steps, PROC SORT, PROC MEANS, and macro variables.
- Configure `cors`, `express.json()`, and environment variables via `dotenv` (`.env` file with `GITHUB_PAT`, `HIVE_JDBC_URL`).

### 3. Build the React UI (`packages/client/src/`)
- **Layout:** Three-column layout — file browser sidebar (left), SAS editor (center), Hive output (right).
- **`components/FileTree.tsx`** — Uses `react-arborist` to render the server-side file tree. Clicking a file loads its contents into the SAS editor.
- **`components/Editor.tsx`** — Two Monaco Editor instances: one editable (SAS input), one read-only (Hive output). Add a custom SAS monarch grammar for syntax highlighting; Hive uses the built-in SQL mode.
- **`components/FileUpload.tsx`** — Drag-and-drop zone + file picker for `.sas` files. Uploads to server and adds to file tree.
- **`components/TranslationView.tsx`** — Side-by-side panel with a "Translate" button. Shows a loading spinner during API calls. Streams the Hive output token-by-token using SSE.
- **`components/Toolbar.tsx`** — "Copy to clipboard" button, "Download as .hql" button, model selector dropdown (lists available GitHub Models), "Execute on Hive" button.
- **`components/HiveResults.tsx`** — Tabular display of query results from the Hive execution endpoint (or a mock result).
- **`components/ExplanationPanel.tsx`** — Collapsible panel below the Hive output showing the LLM's chain-of-thought explanation of what the SAS code does and how it was translated.
- **`api/client.ts`** — Thin `fetch` wrapper for all `/api/*` calls with error handling.

### 4. Prompt engineering (`packages/server/src/services/translation.ts`)
- System prompt includes:
  - Role: "Expert SAS and Hive developer performing code migration"
  - Hive version target (Hive 3.x on Cloudera CDP)
  - Function mapping table (SAS → Hive equivalents for ~20 common functions)
  - Structural patterns: `PROC SQL; QUIT;` → bare SQL, `CALCULATED` → CTE, `PROC SORT NODUPKEY` → `ROW_NUMBER()`, `PROC MEANS` → `GROUP BY` aggregates, DATA step → CTEs + window functions, `first./last.` → `ROW_NUMBER()`, `RETAIN` → `LAG()`
  - Missing value handling: `.` → `NULL`, comparison semantics change
  - Date conversion rules: SAS numeric dates (days since 1960-01-01) → Hive `DATE` type
  - Macro handling: `%LET var = value;` / `&var` → `SET hivevar:var=value;` / `${hivevar:var}`
  - Output format: Hive SQL in a code block, with comments mapping to original SAS line numbers
  - Flag untranslatable constructs explicitly rather than guessing

### 5. Sample SAS files for the mock file browser
- Create 5-10 `.sas` files in `packages/server/sample-sas/` covering:
  - Simple PROC SQL with JOINs and subqueries
  - PROC SQL with `CALCULATED`, `INTO :macvar`, `OUTER UNION CORR`
  - DATA step with `SET`, `BY`, `first./last.`, `RETAIN`, `OUTPUT`
  - PROC SORT with `NODUPKEY`
  - PROC MEANS / PROC SUMMARY
  - Macro variables and a simple `%MACRO`/`%MEND`

### 6. Dev tooling
- Vite dev server proxies `/api/*` to Express (port 3001).
- `tsx watch` for server hot-reload.
- Root `package.json` scripts: `dev` (runs both), `build`, `start`.
- `.env.example` with `GITHUB_PAT=your_token_here` and `HIVE_JDBC_URL=jdbc:hive2://...`.
- `.gitignore` for `node_modules`, `.env`, `dist/`.

### 7. Revenue Commissioners branding & theming

Apply the visual identity of [Revenue.ie](https://www.revenue.ie) throughout the UI so the tool feels like an internal Revenue application.

#### 7a. Design tokens (`packages/client/src/styles/tokens.css`)
- Define CSS custom properties for all brand colours (values to be confirmed and provided by the team — placeholders used during implementation):
  - `--rc-primary` — primary brand colour (navy/dark blue)
  - `--rc-primary-dark` — darker variant for hover/active states
  - `--rc-accent` — accent colour (gold/yellow highlight)
  - `--rc-surface` — page/panel background
  - `--rc-surface-alt` — sidebar/secondary panel background
  - `--rc-border` — standard border colour
  - `--rc-text` — primary text
  - `--rc-text-muted` — secondary/caption text
  - `--rc-text-on-primary` — text colour for use on `--rc-primary` backgrounds (typically white)
- Define typography tokens: `--rc-font-family` (system-safe stack matching Revenue.ie), `--rc-font-size-*` scale.
- Replace all currently hard-coded colour values in `App.css` and component `.css` files with these tokens.

#### 7b. Header / navigation bar (`packages/client/src/components/Header.tsx` + `Header.css`)
- Create a new `Header` component rendered at the top of the app shell.
- Left: Revenue harp logo SVG (official mark — obtain approved asset from internal brand guidelines) + "Revenue" wordmark in the brand typeface.
- Centre/right: application title — **"SAS → HiveQL Translation Tool"** — in a lighter weight.
- Background: `--rc-primary`; text/icon: `--rc-text-on-primary`.
- Sticky positioning so it remains visible when the editor panels scroll.

#### 7c. Favicon & page title ✅ (5 Mar 2026 — placeholder)
- Added `public/favicon.svg` — blue rounded square with "S→H" monospace text (placeholder; replace with Revenue harp SVG when asset is available).
- Updated `<title>` in `packages/client/index.html` to **"SAS to HiveQL | Revenue"**.
- Added `<meta name="theme-color" content="#0078d4">` (placeholder accent; update to `--rc-primary` hex when brand colours are confirmed).

#### 7d. Component re-skin
Apply brand tokens to all existing components:
- **Toolbar buttons** — primary action buttons (`Translate`, `Execute`) use `--rc-primary` fill with `--rc-text-on-primary` label; secondary buttons (Copy, Download) use outlined style with `--rc-primary` border.
- **Sidebar (FileTree)** — `--rc-surface-alt` background, `--rc-primary` highlight on selected node, `--rc-border` separators.
- **Panels (TranslationView, ExplanationPanel, HiveResults)** — `--rc-surface` background, `--rc-border` borders, `--rc-primary` panel header strips.
- **Model selector dropdown** — styled to match Revenue form-field conventions (label above, single-border box).
- **FileUpload drag zone** — dashed `--rc-primary` border, `--rc-accent` on hover.
- **Loading spinner** — colour set to `--rc-primary`.

#### 7e. Monaco Editor theming
- Register a custom Monaco theme (`revenue-dark` or `revenue-light`) via `monaco.editor.defineTheme()` in `TranslationView.tsx`.
- Base on the built-in `vs` (light) or `vs-dark` theme; override editor background and token colours to complement the Revenue palette.
- Pass the theme name to both editor instances so they stay visually consistent.

#### 7f. Assets & fonts
- Add the approved Revenue harp SVG to `packages/client/public/assets/revenue-harp.svg`.
- If a custom brand typeface is licensed for internal tools, add it to `packages/client/public/fonts/` and reference via `@font-face` in `index.css`; otherwise use the system-safe fallback stack.
- Ensure all assets serve correctly in both dev (Vite) and production (nginx/Cloud Run) builds.

#### 7g. Accessibility & compliance
- Verify colour contrast ratios meet WCAG 2.1 AA (≥4.5:1 for normal text, ≥3:1 for large text) once final brand colours are confirmed.
- Add `aria-label` to the logo link and all icon-only buttons.
- Ensure focus ring styles are visible and use `--rc-accent` or a high-contrast variant.

> **Pending input:** Final hex values for all brand colour tokens will be provided before implementation of step 7a. All other sub-steps can be structured and stubbed with placeholder values in the meantime.

---

## Verification

- **Startup:** `npm install && npm run dev` — both server (3001) and client (5173) start without errors.
- **Translation flow:** Paste a SAS PROC SQL snippet → click Translate → Hive SQL appears in right panel with explanation.
- **File browser:** Click a sample `.sas` file → SAS code loads in editor → translate works.
- **Upload:** Drag a `.sas` file → it appears in the file tree → click to load → translate.
- **Output actions:** Copy to clipboard works, download produces a `.hql` file, Execute shows mock results.
- **Streaming:** Hive output appears token-by-token (not all at once after a long wait).
- **Edge cases:** Submit empty input → friendly error. Submit non-SAS code → model flags it. Submit very large file → model returns partial with a warning.
- **Theme toggle:** Click sun/moon button in header → entire app switches theme instantly. Refresh page → persisted theme is restored. Light mode: hover states, spinners, table row striping all visible. Monaco editor CSS class updates correctly.
- **Branding (future):** Header displays Revenue harp logo and correct wordmark. Favicon shown in browser tab. All buttons, panels, and sidebar use Revenue colour tokens. Monaco editor theme matches palette. Contrast ratios pass WCAG 2.1 AA.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Model** | `openai/gpt-4o-mini` over GPT-4.1 | 6x cheaper, sufficient quality for SQL translation, higher rate limits |
| **Editor** | Monaco over CodeMirror | Heavier bundle but gives us diff view, intellisense-ready, and consistent VS Code look for free |
| **Monorepo** | npm workspaces over Nx/Turborepo | Zero config overhead for a 2-package POC |
| **Auth** | None | Internal POC only; add when moving toward production |
| **Hive execution** | Mock endpoint for now | Real JDBC proxy is a config change when Cloudera is available |
| **Streaming** | SSE from Express → real-time token output | Much better UX for large translations |
| **Theme support** | CSS custom properties (`[data-theme]` attribute) + localStorage | Centralised colour definitions; theme preference persists; Monaco editor theme follows system/user preference |
| **Branding** | CSS custom properties (tokens) + single `Header` component | Centralises all brand values so swapping colours later is a one-file change; avoids hard-coding in every component |
| **Brand colours** | Placeholder tokens until values confirmed | Implementation can proceed structurally; colours slotted in once provided |

---

## Prototype Test Phase

Each of the six planned features will be built as a **standalone prototype** in its own git worktree, running independently on a dedicated port pair. The goal is to be able to demonstrate each feature live — all six worktrees running simultaneously — without any one prototype affecting another.

### Feature Prototype Status

| # | Feature | Branch | Worktree | Ports (server / client) | Status |
|---|---------|---------|----------|-------------------------|--------|
| 1 | Conversational follow-up | `feature/conversational-followup` | `../sas-hive-feat-1` | 3011 / 5181 | 🔲 Not started |
| 2 | Pattern library | `feature/pattern-library` | `../sas-hive-feat-2` | 3012 / 5182 | 🔲 Not started |
| 3 | Confidence scoring | `feature/confidence-scoring` | `../sas-hive-feat-3` | 3013 / 5183 | 🔲 Not started |
| 4 | Line mapping | `feature/line-mapping` | `../sas-hive-feat-4` | 3014 / 5184 | 🔲 Not started |
| 5 | Dialect selector | `feature/dialect-selector` | `../sas-hive-feat-5` | 3015 / 5185 | 🔲 Not started |
| 6 | Domain context | `feature/domain-context` | `../sas-hive-feat-6` | 3016 / 5186 | 🔲 Not started |

**Status key:** 🔲 Not started · 🔨 In progress · ✅ Demo-ready · ❌ Blocked

### Definition of "Demo-Ready"

A prototype is demo-ready when:
- `npm install && npm run dev` starts cleanly on its dedicated port pair
- The feature is visibly working end-to-end in the browser (no placeholders or broken states)
- TypeScript reports no errors (`tsc --noEmit` on both server and client)
- A short description of what to show is added to the feature's prompt file under a `## Demo Script` heading

### Demo Setup (All Six Running Simultaneously)

Once all prototypes are demo-ready, start them all from separate terminal tabs:

```bash
cd ../sas-hive-feat-1 && npm run dev   # http://localhost:5181
cd ../sas-hive-feat-2 && npm run dev   # http://localhost:5182
cd ../sas-hive-feat-3 && npm run dev   # http://localhost:5183
cd ../sas-hive-feat-4 && npm run dev   # http://localhost:5184
cd ../sas-hive-feat-5 && npm run dev   # http://localhost:5185
cd ../sas-hive-feat-6 && npm run dev   # http://localhost:5186
```

The main workspace (`sas-to-hive-app`) continues to run on the default ports (3001 / 5173) as the stable baseline.

---

## Feature Development with Git Worktrees

Each of the six planned features is specced in its own prompt file under `.github/prompts/`. They are developed and tested in **isolated git worktrees** — separate working directories that share the same repository history. This means each feature can be built, run, and reviewed concurrently without branches interfering with each other, and without stashing or committing half-finished work.

### Feature Branches & Prompt Files

| # | Branch | Prompt file | Port (server / client) |
|---|--------|-------------|------------------------|
| 1 | `feature/conversational-followup` | `plan-feature-1-conversational-followup.prompt.md` | 3011 / 5181 |
| 2 | `feature/pattern-library` | `plan-feature-2-pattern-library.prompt.md` | 3012 / 5182 |
| 3 | `feature/confidence-scoring` | `plan-feature-3-confidence-scoring.prompt.md` | 3013 / 5183 |
| 4 | `feature/line-mapping` | `plan-feature-4-line-mapping.prompt.md` | 3014 / 5184 |
| 5 | `feature/dialect-selector` | `plan-feature-5-dialect-selector.prompt.md` | 3015 / 5185 |
| 6 | `feature/domain-context` | `plan-feature-6-domain-context.prompt.md` | 3016 / 5186 |

Each worktree runs on its own dedicated port pair so all six can be live simultaneously without conflicts.

---

### One-Time Setup

Run once from the repository root to create all six worktrees and their branches:

```bash
# From: /Users/alan/Documents/workspace/sas-to-hive-app

git worktree add ../sas-hive-feat-1 -b feature/conversational-followup
git worktree add ../sas-hive-feat-2 -b feature/pattern-library
git worktree add ../sas-hive-feat-3 -b feature/confidence-scoring
git worktree add ../sas-hive-feat-4 -b feature/line-mapping
git worktree add ../sas-hive-feat-5 -b feature/dialect-selector
git worktree add ../sas-hive-feat-6 -b feature/domain-context
```

This creates six sibling directories next to the main workspace:

```
Documents/workspace/
├── sas-to-hive-app/          ← main / trunk
├── sas-hive-feat-1/          ← feature/conversational-followup
├── sas-hive-feat-2/          ← feature/pattern-library
├── sas-hive-feat-3/          ← feature/confidence-scoring
├── sas-hive-feat-4/          ← feature/line-mapping
├── sas-hive-feat-5/          ← feature/dialect-selector
└── sas-hive-feat-6/          ← feature/domain-context
```

Each worktree is a full working copy — open any of them in VS Code as a separate workspace window, or use VS Code's **File → Add Folder to Workspace** to view them in a single multi-root workspace.

---

### Port Configuration

Each worktree needs its own port pair to avoid conflicts. Create a `.env` file in each worktree root:

**`../sas-hive-feat-1/.env`**
```
GITHUB_PAT=github_pat_xxxxx
PORT=3011
VITE_PORT=5181
```

Repeat with the port numbers from the table above for features 2–6. The `GITHUB_PAT` value is the same for all worktrees.

To make Vite respect `VITE_PORT`, update `packages/client/vite.config.ts` in each worktree (or do this once on `main` before creating the worktrees):

```typescript
export default defineConfig({
  server: {
    port: Number(process.env.VITE_PORT ?? 5173),
    proxy: {
      '/api': `http://localhost:${process.env.PORT ?? 3001}`,
    },
  },
});
```

---

### Per-Feature Workflow

For each feature (replace `N` and `feat-N` with the feature number):

```bash
# 1. Install dependencies (node_modules are not shared across worktrees)
cd ../sas-hive-feat-N
npm install

# 2. Start the dev servers
npm run dev
# Server: http://localhost:301N
# Client: http://localhost:518N

# 3. Open the feature plan for reference
# .github/prompts/plan-feature-N-<name>.prompt.md

# 4. Implement the feature per the plan
# ... make changes ...

# 5. Type-check before committing
npx -w packages/server tsc --noEmit
npx -w packages/client tsc --noEmit

# 6. Commit work on the feature branch
git add -A && git commit -m "feat: <description>"
```

---

### Merging Completed Features Back to Main

Once a feature is reviewed and accepted, merge it into `main` from the main workspace:

```bash
cd /Users/alan/Documents/workspace/sas-to-hive-app   # main worktree

# Option A — fast-forward if no divergence
git merge feature/conversational-followup

# Option B — squash merge for a clean history
git merge --squash feature/conversational-followup
git commit -m "feat: conversational follow-up chat panel"
```

After merging, remove the worktree and delete the branch:

```bash
git worktree remove ../sas-hive-feat-1
git branch -d feature/conversational-followup
```

---

### Listing & Inspecting Worktrees

```bash
# Show all worktrees and their current branches/commits
git worktree list

# Typical output:
# /Users/alan/Documents/workspace/sas-to-hive-app   abc1234 [main]
# /Users/alan/Documents/workspace/sas-hive-feat-1   abc1234 [feature/conversational-followup]
# /Users/alan/Documents/workspace/sas-hive-feat-2   abc1234 [feature/pattern-library]
# ...
```

---

### Notes & Gotchas

- **`node_modules` are not shared** — run `npm install` in each worktree after creation. This is expected; each worktree is fully independent.
- **`.env` files are not tracked by git** — copy or recreate `.env` in each worktree. They will not be present after `git worktree add`.
- **You cannot check out the same branch in two worktrees simultaneously** — git enforces this. If you try, you'll get a `fatal: branch is already checked out` error. Use a different branch name per worktree.
- **VS Code workspaces** — open each worktree as a separate VS Code window (`code ../sas-hive-feat-N`) to get independent terminal sessions, debug configurations, and extension states.
- **Shared git history** — all worktrees read from and write to the same `.git` directory in the main workspace. `git log`, `git fetch`, and `git push` work identically in any worktree.
- **Rebasing before merge** — if `main` has advanced since the worktree was created (e.g. multiple features merging in parallel), rebase the feature branch before merging to avoid conflicts: `git rebase main` from within the worktree.
