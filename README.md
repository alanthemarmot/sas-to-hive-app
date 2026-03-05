# SAS → HiveQL Translation Tool

An internal web application for Revenue Commissioners that translates SAS scripts into HiveQL (and optionally BigQuery / Spark SQL) using the GitHub Models API. Designed as a migration bridge for SAS users who are moving to modern data platforms, without requiring them to learn SQL from scratch.

## Features

- **Side-by-side editor** — paste or upload SAS code on the left, receive translated HiveQL on the right
- **Streaming output** — translation tokens appear in real time as the model responds
- **Plain-English explanation** — collapsible panel describing what the SAS code does and how it was translated
- **SAS syntax highlighting** — custom Monaco grammar covering keywords, PROCs, functions, macros, and special variables
- **File browser** — browse and load sample SAS scripts from the sidebar
- **File upload** — drag-and-drop `.sas` files directly into the editor
- **Copy & download** — copy translated SQL to clipboard or download as `.hql`
- **Light / dark mode** — theme toggle with `localStorage` persistence
- **Mock Hive execution** — run translated queries and view tabular results (mock; real JDBC configurable)

## Quick Start

**Prerequisites:** Node.js 18+, a [GitHub fine-grained PAT](https://github.com/settings/tokens)

```bash
# 1. Install all workspace dependencies
npm install

# 2. Create environment file
cp .env.example .env
# Edit .env and set GITHUB_PAT=github_pat_xxxxx

# 3. Start both server and client
npm run dev
# Server → http://localhost:3001
# Client → http://localhost:5173
```

See [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) for full setup instructions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TypeScript |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| Backend | Express + TypeScript (`tsx` watch) |
| LLM | GitHub Models API (`openai/gpt-4.1-mini`) |
| Monorepo | npm workspaces |

## Project Structure

```
sas-to-hive-app/
├── packages/
│   ├── client/          # React + Vite frontend (port 5173)
│   │   └── src/
│   │       ├── components/   # UI components
│   │       ├── lib/          # SAS language grammar, utilities
│   │       └── api/          # fetch wrappers for all /api/* calls
│   └── server/          # Express API (port 3001)
│       └── src/
│           ├── routes/       # translate, files, hive endpoints
│           └── services/     # GitHub Models client, translation prompt, mock files
├── docs/
│   └── GETTING_STARTED.md
└── .github/
    └── prompts/         # Feature plans (see below)
```

## Planned Features

Six features are specced and ready for implementation, each in its own git worktree on a separate branch. See [`.github/prompts/plan-sasToHiveApp.prompt.md`](.github/prompts/plan-sasToHiveApp.prompt.md) for the worktree workflow.

| # | Feature | Plan |
|---|---------|------|
| 1 | Conversational follow-up — ask questions about a translation | [plan-feature-1](/.github/prompts/plan-feature-1-conversational-followup.prompt.md) |
| 2 | SAS pattern library / Rosetta Stone reference | [plan-feature-2](/.github/prompts/plan-feature-2-pattern-library.prompt.md) |
| 3 | Translation confidence scoring & validation warnings | [plan-feature-3](/.github/prompts/plan-feature-3-confidence-scoring.prompt.md) |
| 4 | Line-by-line "What Changed?" mapping panel | [plan-feature-4](/.github/prompts/plan-feature-4-line-mapping.prompt.md) |
| 5 | Target dialect selector (Hive / BigQuery / Spark SQL) | [plan-feature-5](/.github/prompts/plan-feature-5-dialect-selector.prompt.md) |
| 6 | Domain context files (tax-area schema & business rules) | [plan-feature-6](/.github/prompts/plan-feature-6-domain-context.prompt.md) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_PAT` | ✅ | Fine-grained Personal Access Token from github.com/settings/tokens |
| `PORT` | No | Express server port (default: `3001`) |
| `HIVE_JDBC_URL` | No | Hive JDBC connection string — mock used if unset |

## Scripts

```bash
npm run dev          # Start server + client concurrently
npm run dev:server   # Server only (tsx watch, port 3001)
npm run dev:client   # Client only (Vite, port 5173)
npm run build        # Production build for both packages
```
