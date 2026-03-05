# Plan: SAS-to-Hive Translation Web App (POC)

A Node.js (Express) + React (Vite) monorepo that lets users paste, upload, or browse SAS scripts and translates them to HiveQL via the **GitHub Models API** (`openai/gpt-4o-mini` — cheapest available model at ~$0.15/M input tokens). The UI shows a side-by-side SAS/Hive view with copy-to-clipboard, download as `.hql`, and an optional "Execute on Hive" panel. No authentication for the POC. The server-side file browser will use a mock directory tree.

**Key decisions made:**
- GitHub Models API via plain `fetch` (no SDK needed, simplest approach)
- `openai/gpt-4o-mini` as the default model (Claude/Anthropic models are **not** available on GitHub Models — only OpenAI, Meta, Microsoft, DeepSeek, xAI)
- Monaco Editor for the code panels (gives us syntax highlighting + a built-in diff view for free)
- npm workspaces monorepo (no extra tooling)

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

#### 7c. Favicon & page title
- Replace the default Vite favicon with the Revenue harp icon (`public/favicon.ico` + `public/favicon.svg`).
- Update `<title>` in `packages/client/index.html` to **"SAS to HiveQL | Revenue"**.
- Add `<meta name="theme-color">` set to `--rc-primary` hex value for mobile browser chrome.

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
- **Branding:** Header displays Revenue harp logo and correct wordmark. Favicon shown in browser tab. All buttons, panels, and sidebar use Revenue colour tokens. Monaco editor theme matches palette. Contrast ratios pass WCAG 2.1 AA.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Model** | `openai/gpt-4o-mini` over GPT-4.1 | 6x cheaper, sufficient quality for SQL translation, higher rate limits |
| **Editor** | Monaco over CodeMirror | Heavier bundle but gives us diff view, intellisense-ready, and consistent VS Code look for free |
| **Monorepo** | npm workspaces over Nx/Turborepo | Zero config overhead for a 2-package POC |
| **Auth** | None | Internal POC only; add when moving toward production |
| **Hive execution** | Mock endpoint for now | Real JDBC proxy is a config change when Cloudera is available |
| **Streaming** | SSE from Express → real-time token output | Much better UX for large translations |
| **Branding** | CSS custom properties (tokens) + single `Header` component | Centralises all brand values so swapping colours later is a one-file change; avoids hard-coding in every component |
| **Brand colours** | Placeholder tokens until values confirmed | Implementation can proceed structurally; colours slotted in once provided |
