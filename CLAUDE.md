# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all workspace dependencies (run from root)
npm install

# Start both server (port 3001) and client (port 5173) concurrently
npm run dev

# Start individually
npm run dev:server   # Express server with tsx watch
npm run dev:client   # Vite dev server

# Production build (client only)
npm run build

# Type-check without emitting (run from workspace root)
npx -w packages/server tsc --noEmit
npx -w packages/client tsc --noEmit
```

No test suite exists yet.

## Environment Setup

Copy `.env.example` to `.env` in the workspace root and set:
- `GITHUB_PAT` — required; GitHub fine-grained PAT used to call the GitHub Models API
- `PORT` — optional; Express server port (default: 3001)
- `HIVE_JDBC_URL` — optional; if unset the Hive execution endpoint returns mock results

The server loads `.env` from the workspace root via `dotenv` (`resolve(__dirname, '../../../.env')`).

## Architecture

This is an **npm workspaces monorepo** with two packages:

### `packages/server` — Express + TypeScript (ESM, `tsx watch`)

API endpoints:
- `POST /api/translate` — synchronous translation via GitHub Models
- `POST /api/translate/stream` — SSE streaming translation (used by the UI)
- `GET /api/files` — returns mock directory tree
- `GET /api/files/content/:path` — returns content of a mock `.sas` file
- `POST /api/files/upload` — accepts `.sas` file upload via `multer`
- `POST /api/hive/execute` — executes HiveQL (mock; real JDBC configurable)
- `GET /api/health`

Key service layer:
- `services/github-models.ts` — thin `fetch` wrapper for `https://models.github.ai/inference/chat/completions`; exports `chatCompletion` (non-streaming) and `chatCompletionStream` (async generator yielding tokens)
- `services/translation.ts` — contains the system prompt with SAS→Hive translation rules, and `buildTranslationPrompt` / `parseTranslationResponse` helpers
- `services/mock-files.ts` — in-memory directory tree and file contents for the file browser (no disk reads)

### `packages/client` — React + Vite + TypeScript

Vite proxies all `/api/*` requests to `http://localhost:3001`.

Component hierarchy:
- `App.tsx` — root state (sasCode, hiveSQL, explanation, theme, toasts); orchestrates streaming via `streamTranslation` from `api/client.ts`
- `TranslationView.tsx` — side-by-side Monaco editors (SAS input editable, Hive output read-only)
- `Toolbar.tsx` — Translate, Copy, Download, Execute buttons + model selector dropdown
- `ExplanationPanel.tsx` — collapsible panel for the plain-English explanation
- `HiveResults.tsx` — tabular mock query results
- `FileTree.tsx` — sidebar file browser (loads mock `.sas` files into editor)
- `FileUpload.tsx` — drag-and-drop `.sas` upload
- `Toast.tsx` — notification toasts

`lib/sas-language.ts` — custom Monaco Monarch grammar for SAS syntax highlighting.

`api/client.ts` — all `fetch` calls to `/api/*`; `streamTranslation` is an async generator that consumes SSE tokens.

### Translation Output Format

The LLM response uses HTML comment markers to delimit sections:
```
<!-- EXPLANATION_START -->
plain-English explanation
<!-- EXPLANATION_END -->
```sql
HiveQL code
```
```
`App.tsx` parses these markers in real-time during streaming to split explanation and SQL into separate state values.

## Feature Development Workflow (Git Worktrees)

All 7 features are built as isolated git worktrees inside the `.trees/` directory:

```
sas-to-hive-app/
├── .trees/
│   ├── feat-1/    # feature/conversational-followup (ports 3011 / 5181)
│   ├── feat-2/    # feature/pattern-library (3012 / 5182)
│   ├── feat-3/    # feature/confidence-scoring (3013 / 5183)
│   ├── feat-4/    # feature/line-mapping (3014 / 5184)
│   ├── feat-5/    # feature/dialect-selector (3015 / 5185)
│   ├── feat-6/    # feature/domain-context (3016 / 5186)
│   └── feat-7/    # feature/view-modes (3017 / 5187)
├── demo/
│   └── index.html # demo navigator (status dashboard + links)
├── packages/
│   ├── client/    # main app (port 5173)
│   └── server/    # main app (port 3001)
└── scripts/
    ├── start-demo.sh
    └── stop-demo.sh
```

Each worktree has its own `npm install` and `.env` with the correct `PORT` and `VITE_PORT`. Feature plans are in `.github/prompts/plan-feature-N-*.prompt.md`.

**Demo commands** (run from workspace root):
```bash
npm run demo        # start all 8 servers + open demo/index.html
npm run demo:stop   # kill all demo server processes
npm run demo:open   # open demo/index.html without restarting servers
```

When working in a feature worktree, the `vite.config.ts` proxy target must point to the worktree's server port (not 3001).

## Key Conventions

- Default LLM model: `openai/gpt-4.1-mini` (GitHub Models API — only OpenAI/Meta/Microsoft/DeepSeek/xAI models are available, not Anthropic)
- All created Hive tables use `STORED AS ORC` by default
- Translation temperature is fixed at `0.2` for deterministic output
- Theme (light/dark) is stored in `localStorage` under key `sas-hive-theme` and applied via `data-theme` attribute on `<html>`
- Branding uses Revenue Commissioners (Ireland) identity; CSS tokens are in `index.css` under `--rc-*` custom properties
