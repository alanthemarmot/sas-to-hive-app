# Feature Plan — SAS-to-SQL Translation Tool

> Master reference for all remaining work, new features, and application direction.  
> Ranked by priority with dependency ordering. Updated 10 March 2026.

---

## Priority Map

```
TIER 1 (Foundations — do these first, everything else depends on them)
  ├─ A. Merge Feature Branches → main
  ├─ B. Revenue Branding (Step 7)
  └─ C. GCP Project Bootstrap + BigQuery Integration (Phases 0–2)

TIER 2 (Core capabilities — unlock real-world use)
  ├─ D. SQL Execution Engine (real BigQuery, dual results panel)
  ├─ E. Business Area Context Auto-Selection
  └─ F. In-App User Guide (tour + reference)

TIER 3 (Polish — quality of life)
  ├─ G. Minimalist / Focus Mode
  └─ H. Containerisation + Cloud Run Deployment (Phases 5–6)

TIER 4 (The Goal — agentic batch migration)
  └─ I. Agentic Batch Migration System
```

**Why this order:**  
- Tier 1 establishes the production-ready baseline: merged features, proper branding, real database.  
- Tier 2 builds the capabilities the agentic system will later automate: real SQL execution, auto-context selection, and guided onboarding for human reviewers.  
- Tier 3 polishes the single-file experience and gets the app deployed.  
- Tier 4 is the destination — an agentic system that migrates hundreds of SAS scripts with a human-in-the-loop. It depends on *everything above it* working reliably.

---

## Tier 1 — Foundations

### A. Merge Feature Branches into `main`

**Status:** Not started — all 7 features are demo-ready in isolated worktrees  
**Effort:** 1–2 weeks (testing + merge conflicts + integration testing)

All 7 feature prototypes are built and running independently. They need to be acceptance-tested against their criteria, then merged into `main` as a unified app. Merge order matters because some features touch the same files.

**Recommended merge order** (least conflict → most conflict):

| Order | Feature | Branch | Rationale |
|-------|---------|--------|-----------|
| 1st | Pattern Library (#2) | `feature/pattern-library` | Self-contained component, no overlap |
| 2nd | View Mode Switcher (#7) | `feature/view-modes` | Touches `TranslationView.tsx` layout only |
| 3rd | Confidence Scoring (#3) | `feature/confidence-scoring` | Adds panel + modifies streaming response parsing |
| 4th | Line Mapping (#4) | `feature/line-mapping` | Modifies streaming response + adds Monaco overlays |
| 5th | Dialect Selector (#5) | `feature/dialect-selector` | Modifies translation prompt + route + toolbar |
| 6th | Domain Context (#6) | `feature/domain-context` | Modifies translation prompt + route + adds sidebar panel |
| 7th | Conversational Follow-up (#1) | `feature/conversational-followup` | Adds new route + panel, depends on final prompt structure |

**Per-feature merge checklist:**
- [ ] Run `npx -w packages/server tsc --noEmit` and `npx -w packages/client tsc --noEmit` — zero errors
- [ ] Manual test against acceptance criteria in the feature's plan file
- [ ] Rebase onto `main` (resolve conflicts from previously merged features)
- [ ] Squash merge: `git merge --squash feature/<name>` → single clean commit
- [ ] Remove worktree: `git worktree remove .trees/feat-N`
- [ ] Delete branch: `git branch -d feature/<name>`
- [ ] Integration smoke test: `npm run dev` → translate SAS → all merged features visible and working together

**Acceptance criteria per feature branch:**

<details>
<summary><b>Feature 1 — Conversational Follow-up</b></summary>

- [ ] "Ask" button enabled only when translation exists
- [ ] Chat panel opens/closes; history persists in same session
- [ ] Streaming works (tokens appear incrementally in chat bubbles)
- [ ] Markdown + code block rendering in responses
- [ ] New translation resets chat history
- [ ] No TypeScript errors
</details>

<details>
<summary><b>Feature 2 — Pattern Library</b></summary>

- [ ] 10 categories listed in navigation with item counts
- [ ] All 30 patterns visible with dual SAS/Hive code blocks
- [ ] Search filters real-time by title, tags, and description
- [ ] Syntax highlighting on code blocks (Prism.js)
- [ ] "Load into Editor" clears previous output, shows toast
- [ ] Scrolling and rendering performance acceptable with 30 items
- [ ] No TypeScript errors
</details>

<details>
<summary><b>Feature 3 — Confidence Scoring</b></summary>

- [ ] Static regex checks run immediately on SAS input (instant feedback)
- [ ] Panel hidden when no translation present
- [ ] Confidence badge colour: green (High), amber (Moderate), red (Low)
- [ ] Severity icons (✕ / ⚠ / ℹ) render correctly
- [ ] Warning line badges are clickable and scroll Hive editor to target line
- [ ] No TypeScript errors
</details>

<details>
<summary><b>Feature 4 — Line Mapping</b></summary>

- [ ] Gutter markers appear on all mapped SAS and Hive lines
- [ ] Hover SAS line → tooltip shows mapped Hive lines + explanation
- [ ] Hover Hive line → tooltip shows mapped SAS lines + explanation
- [ ] Click navigator item → both editors scroll to mapped region
- [ ] Active mapping highlighted in navigator list
- [ ] Layout transitions between 2-column (no mappings) and 3-column (navigator visible)
- [ ] Graceful degradation if LLM returns no mapping JSON
- [ ] No TypeScript errors
</details>

<details>
<summary><b>Feature 5 — Dialect Selector</b></summary>

- [ ] Three dialects selectable: HiveQL, BigQuery Standard SQL, Spark SQL
- [ ] Dropdown renders in toolbar alongside model selector
- [ ] Translation output syntax matches selected dialect (date functions, identifier quoting, etc.)
- [ ] Output panel label updates to reflect dialect
- [ ] Download filename extension: `.hql` for Hive, `.sql` for BigQuery/Spark
- [ ] No TypeScript errors
</details>

<details>
<summary><b>Feature 6 — Domain Context</b></summary>

- [ ] "Context" button in toolbar shows "No context loaded" default state
- [ ] Load `.json` / `.sasctx.json` from disk; invalid files show error toast
- [ ] Starter template dropdown (Form 11, Corp Tax) loads example context
- [ ] Loaded context name and summary (table count, rule count) shown in panel
- [ ] Inline Monaco JSON editor for editing context; save validates schema
- [ ] Download current context as `.sasctx.json`
- [ ] Clear context button works
- [ ] Context persists across page refresh (localStorage)
- [ ] Translation of `WORK.F11_INCOME` with Form 11 context → `form11.income_lines`
- [ ] Contexts over 50KB rejected with error
- [ ] No TypeScript errors
</details>

<details>
<summary><b>Feature 7 — View Mode Switcher</b></summary>

- [ ] Three tabs render: SAS View, Dual View, Hive/SQL View
- [ ] Flex ratios correct (4:1 dominant/recessive, 1:1 dual)
- [ ] Transitions smooth (~350ms) with no layout jank
- [ ] Monaco editors reflow correctly after resize
- [ ] Recessive pane has min-width ~160px (always partially visible)
- [ ] View mode persists across refresh (localStorage)
- [ ] Sidebar toggle works correctly in all view modes
- [ ] View mode bar hidden on mobile (≤768px)
- [ ] No TypeScript errors
</details>

---

### B. Revenue Branding (Step 7)

**Status:** Blocked — waiting on final brand colour hex values and harp SVG asset from Revenue design team  
**Effort:** 2–3 weeks once unblocked  
**Reference:** Main plan Step 7a–7g, RDS Design System instructions

Must conform to the Revenue Design System (RDS v20.0.1). The design tokens are defined, the instruction file is in the repo, but implementation hasn't started.

| Sub-step | Task | Blocker |
|----------|------|---------|
| **7a** | Define CSS custom properties using RDS colour tokens (`base-brandteal` #005a5c, `base-brandmint` #428f94, `base-cyan` #00c6c6, etc.) + typography tokens (Roboto stack per RDS §3.1) | **None — RDS tokens are documented.** Proceed with RDS values. |
| **7b** | Create `Header.tsx` — Revenue harp logo + "Revenue" wordmark + app title. `base-brandteal` background, sticky positioning | Needs approved harp SVG asset |
| **7c** | Replace placeholder favicon with Revenue harp SVG | Needs harp SVG |
| **7d** | Re-skin all components: buttons (`base-brandteal` primary actions), sidebar (`surface-100` bg), panels (`surface-50` bg, `surface-300` borders), dropdowns, spinners | Needs 7a |
| **7e** | Register custom Monaco themes (`revenue-dark`, `revenue-light`) complementing the RDS palette | Needs 7a |
| **7f** | Add harp SVG to `public/assets/`, add brand typeface to `public/fonts/` if licensed | Needs assets |
| **7g** | WCAG 2.1 AA contrast verification, `aria-label` on icon-only buttons, `base-cyan` focus rings | After 7a–7f |

**Immediate action:** 7a can proceed NOW using the documented RDS tokens (§2.1–2.4 in the design instructions). The harp SVG is the only true external blocker — use a text placeholder until it arrives.

---

### C. GCP Project Bootstrap + BigQuery Integration (GCP Phases 0–2)

**Status:** Not started  
**Effort:** 2–3 weeks  
**Reference:** `plan-gcpBigQueryDeployment.prompt.md` Phases 0–2  
**Prerequisite for:** SQL Execution Engine (D), Agentic Batch Migration (I)

This is the infrastructure layer that makes the SQL Execution Engine possible and eventually powers the agentic migration system.

#### Phase 0 — GCP Project Bootstrap

| # | Task | Detail |
|---|------|--------|
| 1 | Create GCP project | `gcloud projects create sas-hive-tool` |
| 2 | Enable APIs | `cloudrun`, `bigquery`, `secretmanager`, `artifactregistry`, `cloudbuild` |
| 3 | Create Artifact Registry | Docker repo `sas-hive-images` in chosen region |
| 4 | Create service account | `sas-hive-api@<project>.iam.gserviceaccount.com` with `bigquery.dataViewer` (dataset-scoped), `bigquery.jobUser` (project), `secretmanager.secretAccessor` |
| 5 | Store GITHUB_PAT | Secret Manager secret `github-pat` |
| 6 | Choose auth approach | Workload Identity (recommended) or JSON key via Secret Manager |
| 7 | Document all commands | `infra/setup.sh` — annotated `gcloud` commands |

#### Phase 1 — BigQuery Sample Dataset

| # | Task | Detail |
|---|------|--------|
| 8 | Create dataset | `sas_migration_samples` in GCP project |
| 9 | Write `infra/bigquery/seed.sql` | 4 tables mirroring mock SAS data: `monthly_sales`, `customers`, `transactions`, `products` — ~20 rows each |
| 10 | Apply DDL + seed data | `bq query --use_legacy_sql=false < infra/bigquery/seed.sql` |

#### Phase 2 — BigQuery Backend Integration

| # | Task | Detail |
|---|------|--------|
| 11 | Add `@google-cloud/bigquery` | `packages/server/package.json` dependency |
| 12 | Create `services/bigquery.ts` | `executeBigQuery(sql)` → `{ columns, rows, bytesScanned }`. **Safety guards:** block DDL/DML mutations (DROP/ALTER/DELETE/TRUNCATE/INSERT/UPDATE → 400), auto-append LIMIT 1000, dry-run cost check (reject >1GB scanned) |
| 13 | Rewrite `routes/hive.ts` | Delegate to `executeBigQuery()`. **Fallback:** if `GOOGLE_CLOUD_PROJECT` unset, return mock response with `X-Mock-Response: true` header |
| 14 | Update `.env.example` | Add `GOOGLE_CLOUD_PROJECT`, `BIGQUERY_DATASET`, `GOOGLE_APPLICATION_CREDENTIALS` |

**New files:** `infra/setup.sh`, `infra/bigquery/seed.sql`, `packages/server/src/services/bigquery.ts`  
**Modified files:** `packages/server/package.json`, `packages/server/src/routes/hive.ts`, `.env.example`

---

## Tier 2 — Core Capabilities

These three features unlock real-world use of the tool. Each feeds directly into the Tier 4 agentic system.

### D. SQL Execution Engine

**Type:** Feature (extends current app)  
**Effort:** High (2–3 weeks)  
**Depends on:** C (BigQuery backend integration)  
**Feeds into:** I (Agentic Batch Migration — the compare step needs real execution)

#### Problem

The "Execute" button currently returns 5 hardcoded mock rows. Users cannot validate whether translated SQL produces correct results. Trust in the tool is zero without real execution.

#### Design — Dual Execution Panel

The bottom half of the screen splits into two result panels, aligned under their respective editors:

```
┌─────────────────────────────┬─────────────────────────────┐
│   SAS Code (editor)         │   SQL Code (editor)         │
├─────────────────────────────┼─────────────────────────────┤
│   SAS Output                │   SQL Output                │
│   (uploaded/captured data)  │   (live BigQuery results)   │
└─────────────────────────────┴─────────────────────────────┘
```

**SQL Output panel (right-bottom):**
- Real BigQuery execution via `executeBigQuery()` service from Phase 2
- Click "Execute" → query runs against `sas_migration_samples` dataset
- Results display in a sortable data table:
  - Click column header → sort ASC/DESC toggle
  - Column data type badges (STRING, INT64, DATE, DECIMAL)
  - Row limit: 100 default, configurable up to 200
  - Horizontal scroll for wide result sets, vertical scroll for rows
- Metadata bar: row count, bytes scanned, execution time, cost estimate

**SAS Output panel (left-bottom):**
- Phase 1: users upload a CSV of expected SAS output → parsed into same table format
- Phase 2 (if SAS server available): connect to SAS Viya REST API to run original SAS and capture output
- Display: identical sortable table format for visual side-by-side comparison

**Diff highlighting (when both panels have data):**
- Row count mismatch → amber banner at top
- Cell-level comparison — cells that differ highlighted in `base-yellow` (warning)
- Column checksum comparison: SUM for numerics, COUNT DISTINCT for strings
- Summary bar: "1,247 of 1,247 rows match (100%)" or "891 of 892 rows match (99.9%)"

**Safety (carried from GCP plan):**
- DDL/DML mutation blocking (regex on first statement token)
- Dry-run cost check (reject >1GB scan)
- Auto-append `LIMIT 200` if no LIMIT clause
- 30-second query timeout
- Audit log of all executed queries

#### Implementation Phases

1. Replace mock with real BigQuery execution (GCP Phase 2 — done in Tier 1.C)
2. Build enhanced `ExecutionPanel.tsx` with sortable, typed data tables
3. Add SAS output upload panel (CSV parsing into same table format)
4. Add diff highlighting between panels
5. (Future) SAS Viya REST API integration for live SAS execution

#### New Files
- `packages/client/src/components/ExecutionPanel.tsx` + `.css`
- `packages/client/src/components/DataTable.tsx` + `.css` (reusable sortable table)
- `packages/client/src/lib/csv-parser.ts` (parse uploaded SAS output CSVs)

#### Modified Files
- `packages/client/src/App.tsx` — add SAS output state, execution panel toggle
- `packages/client/src/App.css` — layout for dual bottom panels
- `packages/client/src/components/HiveResults.tsx` — refactor to use shared `DataTable`
- `packages/client/src/components/Toolbar.tsx` — add "Upload SAS Output" action

#### Open Questions
- Should execution results be cached (avoid re-scanning BigQuery for same query)?
- How to handle queries referencing tables not in `sas_migration_samples`?
- Should we show a query plan / cost estimate before executing?

---

### E. Business Area Context Auto-Selection

**Type:** Feature  
**Effort:** Medium (1–2 weeks)  
**Depends on:** Feature 6 (Domain Context) merged into `main`  
**Feeds into:** I (Agentic Batch Migration — agent needs auto-context per file group)

#### Problem

Feature 6 built context file support (`.sasctx.json` with table mappings, schemas, business rules). But users must manually select which context to load. When SAS code clearly belongs to a business domain (file path contains "form11", code references `F11_` prefixed tables), the system should auto-detect and suggest the right context.

#### Design — Two-Layer Detection

**Layer 1 — Rule-based (instant, no LLM cost):**
- Maintain a mapping of file path patterns and code patterns → context template:

| Pattern Type | Pattern | Suggested Context |
|-------------|---------|-------------------|
| File path | `form11`, `f11` | form11-template.sasctx.json |
| Code refs | `VAT_`, `VIES_`, `MOSS_` tables | vat-template.sasctx.json |
| Code refs | `PAYE_`, `P35_`, `P60_` tables | paye-template.sasctx.json |
| Code refs | `CT_`, `CT1_`, `CORP_` tables | corptax-template.sasctx.json |
| Code refs | `CGT_`, `GAINS_` tables | cgt-template.sasctx.json |
| Code refs | `STAMP_`, `SD_` tables | stampduty-template.sasctx.json |
| Code refs | `CUST_`, `EXCISE_` tables | customs-template.sasctx.json |

- On SAS code load (file tree click, upload, or paste), scan for pattern matches
- If match found → non-blocking suggestion banner: *"This looks like Form 11 code. Load Form 11 context? [Accept] [Dismiss]"*

**Layer 2 — LLM classification (for ambiguous cases):**
- If no rule-based match, send lightweight classification prompt:  
  *"Given this SAS code, which Revenue business area does it belong to? Options: Form 11, VAT, PAYE, Corp Tax, CGT, Customs, Stamp Duty, Other"*
- Use cheapest model (`openai/gpt-4o-mini`) at temperature 0
- Suggest the matched context file; user can dismiss

**Context Library (replaces file-only loading):**
- Ship pre-built context templates for all major Revenue areas
- ContextPanel dropdown or card grid to browse available contexts
- Users create custom contexts saved to localStorage (or server-side later)

#### Implementation

- New service: `packages/server/src/services/context-detection.ts`
- New endpoint: `POST /api/context/detect` — accepts `{ sasCode, filePath? }`, returns `{ suggestedContext, confidence, reason }`
- Client: auto-call on SAS code load, show suggestion banner in App.tsx
- Extend ContextPanel with a library view (grid of available contexts)

#### Open Questions

- Should contexts be composable (base "Revenue common" + area-specific overlay)?
- How many business areas need templates? (Estimate: 8–10 initially)
- Should we version-control context files in the repo or store per-user?

---

### F. In-App User Guide

**Type:** Feature  
**Effort:** Low–Medium (1 week)  
**Depends on:** Feature merges (A) — tour needs to reference final UI  
**Feeds into:** I (Agentic Batch Migration — human reviewers need onboarding to the review workflow)

#### Problem

The app has 7+ feature panels, modes, and workflows. New users — especially SAS developers unfamiliar with web tools — need guided onboarding. No in-app help exists today (only a developer-facing `GETTING_STARTED.md`).

RDS Principle #3: *"Provide users with UI design options that are tried, tested, and easily understood."*  
RDS Principle #8: *"This Is for Everyone."*

#### Design — Guided Tour + Reference Modal

**Component 1: First-visit guided tour**
- Triggers automatically on first visit (tracked via localStorage `sas-hive-tour-complete`)
- Step-by-step spotlight overlay walking through key areas:
  1. "Welcome! This tool translates SAS code to SQL." (center overlay)
  2. "Paste or type your SAS code here" → spotlight SAS editor
  3. "Or browse and select a SAS file" → spotlight sidebar file tree
  4. "Click Translate to convert" → spotlight Translate button
  5. "Your SQL appears here" → spotlight SQL editor
  6. "Copy, download, or execute the result" → spotlight toolbar actions
  7. "Use the Context button to load domain knowledge" → spotlight context button
  8. "Check confidence scores for translation quality" → spotlight confidence panel
  9. "You're all set! Click ? anytime for help." (center overlay, dismiss)
- Skip button always visible; progress dots at bottom
- Library: `react-joyride` (~15KB gzipped, accessible) or lightweight custom implementation

**Component 2: Reference modal (? button in header)**
- Always visible `?` icon button in app header
- Opens modal/drawer with tabbed sections:
  - **Getting Started** — 5-step visual guide with captions
  - **Features** — brief explanation of each panel (translation, execution, confidence, chat, context, view modes, patterns)
  - **Keyboard Shortcuts** — table (Ctrl+Enter to translate, Ctrl+Shift+C to copy, etc.)
  - **Tips** — common SAS patterns and how the tool handles them
  - **FAQ** — "Why does my translation show warnings?", "How do I load domain context?", etc.
- "Restart Tour" button to re-trigger the guided tour
- Content authored in markdown, rendered via simple markdown component

**RDS styling alignment:**
- Tour tooltips: `base-brandteal` (#005a5c) background, `base-white` text
- Spotlight overlay: `surface-900` at 60% opacity
- Modal: `surface-100` background, `surface-300` border, `base-brandteal` header stripe
- Focus rings visible per RDS §4 accessibility standards

#### New Files
- `packages/client/src/components/GuidedTour.tsx` + `.css`
- `packages/client/src/components/HelpModal.tsx` + `.css`
- `packages/client/src/content/help-content.ts` (structured help data)

#### Modified Files
- `packages/client/src/App.tsx` — mount `GuidedTour`, add `?` button to header
- `packages/client/package.json` — add `react-joyride` dependency (if used)

#### Open Questions

- Should the tour re-trigger when new features ship (versioned tour)?
- Should individual components have contextual `?` hover icons?

---

## Tier 3 — Polish

### G. Minimalist / Focus Mode

**Type:** Feature  
**Effort:** Medium (1–2 weeks)  
**Depends on:** Feature merges (A), User Guide (F) — tour adapts to active mode  
**Builds on:** Feature 7 (View Mode Switcher)

#### Problem

The full UI exposes every panel simultaneously: sidebar, file browser, model selector, dialect dropdown, domain context panel, confidence scores, chat, explanation, execution results. For SAS developers who just want to convert code and check the output, this is visual overload.

RDS Principle #5: *"Direction Over Choice — one clear screen is preferable to one cluttered screen."*

Feature 7 (View Mode Switcher) adjusts pane ratios but doesn't reduce UI chrome.

#### Design — Focus Mode Toggle

A toggle button in the header (near the theme toggle) that strips the interface to essentials.

**Focus Mode ON:**
- **Hidden:** sidebar, file browser, model/dialect/context selectors, confidence panel, chat panel, explanation panel
- **Visible:** SAS editor (left), single large "Convert" button (center divider), SQL output (right)
- **Auto-behaviour:** uses whatever model, dialect, and context were last selected — silently
- **Result actions:** inline "Copy" and "Download" icon buttons on the SQL panel header — no toolbar row
- **Execution:** "Execute" pill button appears at bottom of SQL panel after translation, results slide in below
- **Keyboard shortcuts work as normal:** Ctrl+Enter translates, Ctrl+Shift+C copies
- **Exit:** click toggle again, or "Exit Focus Mode" text link in bottom-right corner

**Implementation:**
- Add `focusMode: boolean` state to `App.tsx` (persisted to localStorage)
- Conditionally render sidebar, Toolbar items, panels based on state
- Smooth transitions: fade-out chrome, expand editors
- Feature 7's ViewModeBar hidden in focus mode (defaults to 50/50)

**Not the default.** SAS developers (primary users) need the full translation context. Focus mode is an opt-in for repeat use once users are comfortable.

#### New Files
- None — modifications to existing components only

#### Modified Files
- `packages/client/src/App.tsx` — `focusMode` state, conditional rendering
- `packages/client/src/App.css` — focus mode layout styles, transitions
- `packages/client/src/components/Toolbar.tsx` — simplified rendering in focus mode
- `packages/client/src/components/TranslationView.tsx` — center "Convert" button in focus mode

---

### H. Containerisation + Cloud Run Deployment (GCP Phases 3–6)

**Status:** Not started  
**Effort:** 2–3 weeks  
**Depends on:** C (GCP bootstrap + BigQuery), A (feature merges)  
**Reference:** `plan-gcpBigQueryDeployment.prompt.md` Phases 3–6

#### Phase 3 — BigQuery Dialect in Translation Prompt

| # | Task |
|---|------|
| 15 | Extend `SYSTEM_PROMPT` with `{{DIALECT}}` conditional sections — BigQuery rules: backtick identifiers, `DATE_DIFF(date1, date2, DAY)`, `STRING_AGG`, `SAFE_DIVIDE`, `QUALIFY ROW_NUMBER()`, `ANY_VALUE`, `SELECT * EXCEPT`, `DECLARE/SET` variables |
| 16 | Export `buildTranslationMessages(sasCode, dialect)` injecting correct dialect rules |
| 17 | Update translate route to accept `dialect` param, pass to builder |

*Note: Feature 5 (Dialect Selector) already has a prototype of this in its worktree. Merge Feature 5 first, then extend the prompt with the BigQuery-specific rules from the GCP plan.*

#### Phase 4 — Dialect Selector UI

| # | Task |
|---|------|
| 18 | Add `dialect` state to `App.tsx` (`'hiveql'` \| `'bigquery'` \| `'spark'`) |
| 19 | Add "Target Dialect" dropdown to `Toolbar.tsx` |
| 20 | Thread `dialect` through to `streamTranslation()` in `api/client.ts` |
| 21 | Style consistently with model selector in `Toolbar.css` |

*Note: Feature 5 already implements this. After merge, verify BigQuery option produces correct syntax.*

#### Phase 5 — Containerisation

| # | Task | Detail |
|---|------|--------|
| 22 | `packages/server/Dockerfile` | `node:20-alpine`, `npm ci --omit=dev`, `npx tsc`, expose 3001 |
| 23 | `packages/client/Dockerfile` | Two-stage: node:20 builder → nginx:1.27-alpine |
| 24 | `packages/client/nginx.conf` | Static serve + SPA fallback (`try_files $uri /index.html`) |
| 25 | Update `vite.config.ts` | Accept `VITE_API_BASE_URL` env var at build time |
| 26 | Update `api/client.ts` | Use `__API_BASE__` constant (falls back to `''` for local dev proxy) |
| 27 | Add `.dockerignore` files | Exclude `node_modules`, `.env`, `dist/` |

#### Phase 6 — Cloud Run Deployment

| # | Task | Detail |
|---|------|--------|
| 28 | Build + push backend image | `docker build -f packages/server/Dockerfile -t <REGION>-docker.pkg.dev/<PROJECT>/sas-hive-images/api:latest .` |
| 29 | Deploy backend Cloud Run | Service account, secret mount (GITHUB_PAT), env vars, unauthenticated (POC) |
| 30 | Build + push frontend image | `--build-arg VITE_API_BASE_URL=<backend-url>` |
| 31 | Deploy frontend Cloud Run | Minimal config, unauthenticated (POC) |
| 32 | Update CORS in `index.ts` | Replace wildcard with specific frontend Cloud Run URL |

**New files:** `packages/server/Dockerfile`, `packages/client/Dockerfile`, `packages/client/nginx.conf`, `.dockerignore` files  
**Modified files:** `packages/client/vite.config.ts`, `packages/client/src/api/client.ts`, `packages/server/src/index.ts`

---

## Tier 4 — The Goal: Agentic Batch Migration

### I. Agentic Batch Migration System

**Type:** New application mode (not a bolt-on feature)  
**Effort:** Very high (6–10 weeks)  
**Depends on:** D (SQL Execution Engine), E (Context Auto-Selection), C (BigQuery), and all merged features  
**This is the end-state vision — it only works if every layer below it is solid.**

#### Problem

Revenue has **thousands** of SAS scripts grouped by business area (Form 11, VAT, PAYE, Corp Tax, etc.). Migrating them one at a time in the current editor UI is impractical. An agentic system should automate the translate → execute → compare → iterate loop across batches, with a human-in-the-loop to confirm results when the agent can't match output within a threshold.

#### Why This Must Be Last

The agentic system automates the *exact same workflow* a human does in the single-file editor:

1. Load SAS code
2. Select appropriate domain context
3. Translate to SQL
4. Execute SQL against BigQuery
5. Compare output to known SAS results
6. If wrong → refine translation → re-execute → re-compare
7. When results match → approve

Every step above corresponds to a feature in Tiers 1–3. The agent orchestrates them programmatically. If any step is unreliable (mock execution, missing context, no confidence scoring), the agent can't function.

#### Design — Three-Screen Flow

**Screen 1 — Job Setup**
- User creates a "Migration Job"
- Defines file groups (user-defined grouping by drag-and-drop or multi-select)
  - Example groups: "VAT Returns Q1", "Form 11 Income", "PAYE Monthly"
- Each group has:
  - A domain context file (auto-suggested via E, or user picks from library)
  - A target dialect (default: BigQuery)
  - An acceptance threshold (e.g., "95% row match")
  - Max iteration attempts (e.g., 5)
  - SAS output source: "Upload CSVs" or "Live SAS execution" (if available)
- "Start Migration" button queues the job

**Screen 2 — Agent Progress Dashboard**
- Real-time dashboard showing all files with per-file status:

| File | Status | Confidence | Iterations | SAS Rows | SQL Rows | Match % | Action |
|------|--------|------------|------------|----------|----------|---------|--------|
| monthly_sales.sas | ✅ Matched | High | 1 | 1,247 | 1,247 | 100% | View |
| customer_analysis.sas | 🔄 Iterating | Moderate | 3/5 | 892 | 891 | 99.9% | View |
| complex_transform.sas | ⚠️ Needs Review | Low | 5/5 | 3,201 | 3,150 | 98.4% | Review |
| macro_heavy.sas | ⏳ Queued | — | — | — | — | — | — |

- Live streaming logs per file (expand row to see agent reasoning)
- Overall job progress bar: files completed, average confidence, total iterations
- Breakdown metrics: matched, iterating, needs review, failed, queued
- WebSocket or SSE for real-time updates

**Screen 3 — File Review (human-in-the-loop)**
- Opens the standard translation editor view pre-loaded with the SAS + generated SQL
- Shows dual execution panel (from D) with SAS output vs SQL output + diff highlighting
- Agent's iteration history: "Attempt 1: 98.4% match → adjusted DATE_DIFF argument order → Attempt 2: 99.1% → ..."
- User can manually edit SQL and re-execute
- **"Approve"** → marks file as migrated, stores final SQL
- **"Reject & Re-queue"** → sends back to agent with user's feedback as additional context for the next attempt

#### Agent Loop (per file)

```
1. Load SAS file content
2. Auto-detect business area → load domain context (E)
3. Translate SAS → SQL via LLM (using context + dialect)
4. Get confidence score + warnings (Feature 3)
5. Execute SQL against BigQuery (D)
6. Compare results to SAS output:
   a. Row count match
   b. Column-level checksums (SUM for numerics, COUNT DISTINCT for strings)
   c. Sample row comparison (first 100 rows sorted by primary key)
7. If match ≥ threshold → ✅ mark Matched
8. If match < threshold AND iterations < max:
   a. Feed comparison diff + confidence warnings + iteration history to LLM
   b. Ask LLM to diagnose the discrepancy and produce corrected SQL
   c. Increment iteration count, go to step 5
9. If iterations exhausted → ⚠️ mark Needs Review (human-in-the-loop)
```

#### SAS Execution Strategy (Both Modes)

**Mode A — Real SAS execution (preferred):**
- Connect to SAS Viya REST API (`POST /compute/sessions`, `POST /compute/sessions/{id}/jobs`) to execute original scripts
- Capture output dataset as JSON/CSV
- Requires network access to SAS server + valid credentials
- Configuration: `SAS_VIYA_URL`, `SAS_CLIENT_ID`, `SAS_CLIENT_SECRET` env vars

**Mode B — Pre-captured output (fallback):**
- Users upload CSV exports of known SAS output alongside each .sas file
- Agent compares SQL results against uploaded CSVs
- No SAS server needed — works for historical migration where SAS output was captured before decommissioning

**Mode is configured per-job** (some business areas may have live SAS, others only historical exports).

#### SQL Quality Pass

After results match, the agent runs a secondary LLM pass:

*"Optimise this SQL for readability and simplicity while preserving exact output. Use clear CTEs, meaningful aliases, and add comments explaining business logic."*

This produces clean, maintainable SQL suitable for handover to the team that will own it post-migration. The human reviewer approves the optimised version.

#### Architecture Requirements

| Concern | Approach |
|---------|----------|
| **Job Queue** | Redis + BullMQ (self-hosted) or Cloud Tasks (GCP-native). Each file is a task in the queue. |
| **Persistent State** | Cloud SQL (PostgreSQL) for job metadata, file status, iteration history. Schema: `jobs`, `job_files`, `iterations`, `approved_translations` tables. |
| **Concurrent Execution** | Worker processes pull from queue. Rate-limited by LLM API quota (~30 requests/min for gpt-4o-mini). 3–5 concurrent files. |
| **Real-time Updates** | WebSocket server (ws or Socket.IO) for dashboard. SSE is per-request only — insufficient for multi-file updates. |
| **LLM Cost** | Each iteration costs ~$0.01–0.05 in tokens. A 100-file job with avg 3 iterations ≈ $3–15. Budget approval needed for large batches (1000+ files). |
| **Storage** | Final approved SQL stored in Cloud SQL + optionally committed to a git repository via GitHub API. |

#### Cross-File Dependencies

SAS scripts often have dependencies (one creates a table another reads). The agent should:

1. Build a dependency graph from `LIBNAME` + `SET`/`MERGE`/`FROM` references
2. Execute in dependency order (upstream first)
3. If an upstream translation changes, re-validate all downstream files

This is a significant complexity addition — potentially Phase 2 of the agentic system.

#### New Files (Indicative)

**Server:**
- `packages/server/src/services/agent-orchestrator.ts` — job management, file queue, iteration loop
- `packages/server/src/services/result-comparator.ts` — row/column/checksum comparison logic
- `packages/server/src/services/sas-executor.ts` — SAS Viya REST API client (or CSV loader)
- `packages/server/src/routes/jobs.ts` — CRUD for migration jobs
- `packages/server/src/routes/ws.ts` — WebSocket handler for real-time dashboard
- `packages/server/src/db/schema.sql` — Cloud SQL tables for jobs, files, iterations

**Client:**
- `packages/client/src/pages/BatchMigration.tsx` — top-level page (or route) for batch mode
- `packages/client/src/components/JobSetup.tsx` + `.css` — file grouping, config
- `packages/client/src/components/AgentDashboard.tsx` + `.css` — progress table, logs
- `packages/client/src/components/FileReview.tsx` + `.css` — review/approve workflow
- `packages/client/src/components/DiffTable.tsx` + `.css` — dual result comparison with cell-level diff

#### Open Questions

- **Budget**: What's the per-job LLM token budget for large batches?
- **Macro expansion**: Should the agent resolve `%INCLUDE` and macro variables before translation?
- **Cross-file deps**: Handle in Phase 1 or defer to Phase 2?
- **Git integration**: Auto-commit approved SQL to a migration repo?
- **SAS connectivity**: Is SAS Viya available, or only SAS 9.4? (Different API)
- **Audit trail**: What level of logging is needed for compliance? (Every LLM prompt/response, or just final results?)

---

## Appendix: Existing Feature Summaries

Quick reference for what's already built in the 7 feature branches.

| # | Feature | What It Does | Key Files |
|---|---------|-------------|-----------|
| 1 | Conversational Follow-up | Chat panel for asking questions about translations. Streaming messages, markdown rendering, context-aware. | `ChatPanel.tsx`, `/api/translate/followup` |
| 2 | Pattern Library | 30 SAS→Hive pattern pairs across 10 categories. Search, filter, load-into-editor. | `PatternLibrary.tsx`, `lib/pattern-library.ts` |
| 3 | Confidence Scoring | Two-layer scoring: instant regex checks + LLM confidence JSON. High/Moderate/Low badge, clickable warning line refs. | `ConfidencePanel.tsx`, `lib/sas-static-checks.ts` |
| 4 | Line Mapping | Visual mapping between SAS and Hive lines. Monaco gutter markers, hover tooltips, navigator panel, sync scrolling. | `MappingNavigator.tsx`, Monaco decorations |
| 5 | Dialect Selector | Target HiveQL, BigQuery, or Spark SQL. Per-dialect function mappings and structural rules in the prompt. | `Toolbar.tsx` dropdown, `DialectConfig` types |
| 6 | Domain Context | Load `.sasctx.json` files with table mappings, schemas, business rules. Inline Monaco JSON editor, starter templates. | `ContextPanel.tsx`, `context-validation.ts` |
| 7 | View Mode Switcher | Three tabs: SAS View (80/20), Dual (50/50), SQL View (20/80). Smooth flex transitions, localStorage persistence. | `ViewModeBar.tsx`, CSS flex classes |

---

## Appendix: Known Limitations (Current POC)

These are **by design** for the prototype and will be addressed in the phases above:

| Limitation | Addressed In |
|------------|-------------|
| No authentication or authorisation | Future (Cloud IAP or Identity Platform) |
| Hive/SQL execution is mocked | C (BigQuery backend) + D (Execution Engine) |
| File uploads don't persist (memory only) | Future (Cloud Storage integration) |
| Translation prompt is English-only | Not planned to change |
| No rate limiting on translation endpoint | Future (Cloud Armor / express-rate-limit) |
| No translation history persistence | Future (Cloud SQL — schema in main plan) |
| No cross-file dependency resolution | I (Agentic system, Phase 2) |

---

## Appendix: Critical Blockers

| Blocker | Impact | Status |
|---------|--------|--------|
| Revenue harp SVG asset | Can't complete Header.tsx or favicon | Requested from design team |
| GCP project creation + billing | Can't start any GCP phases | Needs org approval |
| SAS server connectivity details | Can't implement real SAS execution (Mode A in Idea I) | Needs infra team input |
| LLM token budget for batch jobs | Can't set default thresholds for agentic system | Needs management approval |
