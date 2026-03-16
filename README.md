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

## Feature Prototypes

Seven features have been built as standalone prototypes, each in its own git worktree on a dedicated port pair. All are demo-ready and can run simultaneously. See [`.github/prompts/plan-sasToHiveApp.prompt.md`](.github/prompts/plan-sasToHiveApp.prompt.md) for the worktree workflow.

| # | Feature | Status | Plan |
|---|---------|--------|------|
| 1 | Conversational follow-up — ask questions about a translation | ✅ Demo-ready | [plan-feature-1](/.github/prompts/plan-feature-1-conversational-followup.prompt.md) |
| 2 | SAS pattern library / Rosetta Stone reference | ✅ Demo-ready | [plan-feature-2](/.github/prompts/plan-feature-2-pattern-library.prompt.md) |
| 3 | Translation confidence scoring & validation warnings | ✅ Demo-ready | [plan-feature-3](/.github/prompts/plan-feature-3-confidence-scoring.prompt.md) |
| 4 | Line-by-line "What Changed?" mapping panel | ✅ Demo-ready | [plan-feature-4](/.github/prompts/plan-feature-4-line-mapping.prompt.md) |
| 5 | Target dialect selector (Hive / BigQuery / Spark SQL) | ✅ Demo-ready | [plan-feature-5](/.github/prompts/plan-feature-5-dialect-selector.prompt.md) |
| 6 | Domain context files (tax-area schema & business rules) | ✅ Demo-ready | [plan-feature-6](/.github/prompts/plan-feature-6-domain-context.prompt.md) |
| 7 | View mode switcher (side-by-side / diff / unified) | ✅ Demo-ready | [plan-feature-7](/.github/prompts/plan-feature-7-view-modes.prompt.md) |

Run all prototypes simultaneously with:

```bash
npm run demo          # starts all 8 servers (main + 7 features) + opens demo/index.html
npm run demo:stop     # stops all demo server processes
npm run demo:open     # re-opens demo/index.html without restarting servers
```

## Next Steps

The prototype phase is complete. The following steps are required to move from prototype to production.

### 1. Merge Feature Branches into Main

Each feature prototype lives on its own branch and needs review before being merged. Merge in order of dependency, squash-committing for a clean history:

```bash
git merge --squash feature/conversational-followup
git merge --squash feature/pattern-library
git merge --squash feature/confidence-scoring
git merge --squash feature/line-mapping
git merge --squash feature/dialect-selector
git merge --squash feature/domain-context
git merge --squash feature/view-modes
```

### 2. Production Deployment (GCP)

Target architecture:

| Component | Technology |
|-----------|-----------|
| Frontend | Cloud Run (containerised Vite build with nginx) |
| Backend | Cloud Run (Express + Node.js) |
| Database | Cloud SQL for PostgreSQL (metadata / user data) |
| Hive execution | Dataproc (Hive on GCP) |
| Secrets | Secret Manager for `GITHUB_PAT` and DB credentials |
| File storage | Cloud Storage (replace in-memory upload store) |

### 3. Real Hive Execution

Replace the mock in `packages/server/src/routes/hive.ts` with an actual Dataproc JDBC connection. Add environment variables:

```
HIVE_JDBC_URL=jdbc:hive2://dataproc-cluster:10000/default
HIVE_USERNAME=hive
HIVE_PRINCIPAL=hive/_HOST@REALM   # for Kerberos
```

Safety constraints: block `DROP`/`ALTER`/`DELETE` statements, cap results at 1,000 rows, enforce a 30-second execution timeout, and audit-log all queries.

### 4. Persistent File Storage

Replace the in-memory mock (`services/mock-files.ts`) with Cloud Storage-backed file management so uploaded `.sas` files survive server restarts and are accessible per user.

### 5. User Authentication

Add Identity Platform (OIDC / OAuth 2.0) with session management. Protect all routes with an auth middleware. Store user records in Cloud SQL.

### 6. Translation History Database

Persist each translation in Cloud SQL so users can retrieve and compare past results:

```sql
CREATE TABLE translations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  sas_code TEXT NOT NULL,
  hive_sql TEXT NOT NULL,
  model VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_status VARCHAR(20)
);
```

### 7. Rate Limiting & Quota Management

Add rate limiting on the translation endpoint to stay within GitHub Models API quota. Track per-user usage and surface warnings when approaching limits.

### 8. CI/CD Pipeline

Set up GitHub Actions to run type-checks (`tsc --noEmit`), lint, build Docker images, and deploy to Cloud Run on merge to `main`.

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
