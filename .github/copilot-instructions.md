# AI Agent Instructions: SAS-to-Hive Translation App

## Project Plan & Status

The authoritative plan for this project — including completed features, current status, the prototype test phase, and the seven planned feature branches — is maintained at:

**[`.github/prompts/plan-sasToHiveApp.prompt.md`](.github/prompts/plan-sasToHiveApp.prompt.md)**

**Always read this file at the start of any session** to understand what has been built, what is in progress, and what the next priorities are. Each of the seven planned features also has its own spec file in `.github/prompts/plan-feature-N-*.prompt.md`.

### Feature Index

| # | Feature | Plan file | Branch | Worktree | Ports (server/client) |
|---|---------|-----------|--------|----------|-----------------------|
| 1 | Conversational follow-up | `plan-feature-1-conversational-followup.prompt.md` | `feature/conversational-followup` | `.trees/feat-1` | 3011 / 5181 |
| 2 | Pattern library | `plan-feature-2-pattern-library.prompt.md` | `feature/pattern-library` | `.trees/feat-2` | 3012 / 5182 |
| 3 | Confidence scoring | `plan-feature-3-confidence-scoring.prompt.md` | `feature/confidence-scoring` | `.trees/feat-3` | 3013 / 5183 |
| 4 | Line mapping | `plan-feature-4-line-mapping.prompt.md` | `feature/line-mapping` | `.trees/feat-4` | 3014 / 5184 |
| 5 | Dialect selector | `plan-feature-5-dialect-selector.prompt.md` | `feature/dialect-selector` | `.trees/feat-5` | 3015 / 5185 |
| 6 | Domain context | `plan-feature-6-domain-context.prompt.md` | `feature/domain-context` | `.trees/feat-6` | 3016 / 5186 |
| 7 | View mode switcher | `plan-feature-7-view-modes.prompt.md` | `feature/view-modes` | `.trees/feat-7` | 3017 / 5187 |

---

## Architecture Overview

**Monorepo structure** (npm workspaces):
- `packages/server/` — Express API (TypeScript, port 3001)
- `packages/client/` — React + Vite frontend (TypeScript, port 5173)

**Core flow**: User provides SAS code → GitHub Models API (`openai/gpt-4o-mini`) translates to HiveQL → Results stream back via SSE → Monaco editors display side-by-side comparison

## Environment Setup

**Required**: Create `.env` at workspace root with:
```
GITHUB_PAT=github_pat_xxxxx  # Fine-grained PAT from github.com/settings/tokens
HIVE_JDBC_URL=jdbc:hive2://localhost:10000/default  # Optional, mock used if unset
PORT=3001
```

**Dev workflow**:
```bash
npm install                    # Install all workspace dependencies
npm run dev                    # Runs both server (tsx watch) and client (vite) concurrently
npm run dev:server            # Server only
npm run dev:client            # Client only
npx -w packages/server tsc --noEmit  # Type-check server without building
```

Vite proxies `/api/*` to Express server automatically (see [packages/client/vite.config.ts](packages/client/vite.config.ts)).

## Critical Services

### Translation Pipeline ([packages/server/src/services/translation.ts](packages/server/src/services/translation.ts))

**The heart of the app**. Contains an 80+ line system prompt (`SYSTEM_PROMPT`) with:
- Function mapping table (20+ SAS functions → Hive equivalents)
- PROC translations (SORT, MEANS, FREQ, TRANSPOSE, APPEND)
- DATA step patterns (first./last., RETAIN, BY groups → window functions)
- Missing value semantics (`.` → `NULL`)
- Date arithmetic conversion rules

**When modifying translation logic**: Edit `SYSTEM_PROMPT` constant, not individual route handlers. The prompt uses markdown tables and specific output format markers (`<!-- EXPLANATION_START -->`, `<!-- EXPLANATION_END -->`).

**Temperature**: Fixed at `0.2` in [routes/translate.ts](packages/server/src/routes/translate.ts) for deterministic SQL output.

**Key translation examples** from the system prompt:
- `PROC SORT DATA=x NODUPKEY; BY a;` → `SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY a ORDER BY a) AS rn FROM x) t WHERE rn = 1`
- `CALCULATED col` in PROC SQL → Rewrite as CTE to reference derived columns
- SAS `first.var / last.var` in DATA step → `ROW_NUMBER() OVER (PARTITION BY var ...)` with condition
- `SCAN(s, n, delim)` → `SPLIT(s, delim)[n-1]` (array indexing is 0-based in Hive)
- `INTCK('day', date1, date2)` → `DATEDIFF(date2, date1)`
- `RETAIN` variables → `LAG()` window function or self-join

### Explanation Parsing ([services/translation.ts](packages/server/src/services/translation.ts#L95-L141))

The LLM response contains both explanation and SQL wrapped in markers:
```
<!-- EXPLANATION_START -->
The SAS code performs...
<!-- EXPLANATION_END -->

```sql
CREATE TABLE result STORED AS ORC AS
SELECT ...
```
```

`parseTranslationResponse()` extracts both sections using regex. The client displays explanation in [ExplanationPanel.tsx](packages/client/src/components/ExplanationPanel.tsx) below the Hive output. If markers are missing, fallback logic splits on the code block fence.

For streaming, [App.tsx](packages/client/src/App.tsx#L36-L60) accumulates tokens and splits on `---EXPLANATION---` marker to update both panels in real-time.

### GitHub Models Integration ([packages/server/src/services/github-models.ts](packages/server/src/services/github-models.ts))

Two functions:
- `chatCompletion()` — Standard request/response
- `chatCompletionStream()` — Returns `AsyncGenerator<string>` for SSE

**Endpoint**: `https://models.github.ai/inference/chat/completions`  
**Auth**: Bearer token from `GITHUB_PAT` env var  
**Default model**: `openai/gpt-4o-mini` (cheapest, sufficient quality)

**Important**: Claude/Anthropic models are NOT available on GitHub Models — only OpenAI, Meta, Microsoft, DeepSeek, xAI.

### Streaming Pattern

**Server** ([routes/translate.ts](packages/server/src/routes/translate.ts#L35-L76)):
```typescript
res.setHeader('Content-Type', 'text/event-stream');
for await (const token of chatCompletionStream(...)) {
  res.write(`data: ${JSON.stringify({ token })}\n\n`);
}
res.write('data: [DONE]\n\n');
```

**Client** ([api/client.ts](packages/client/src/api/client.ts#L25-L60)):
```typescript
export async function* streamTranslation(sasCode: string, model?: string): AsyncGenerator<string> {
  const response = await fetch(`${API_BASE}/translate/stream`, ...);
  const reader = response.body?.getReader();
  // Parse SSE 'data: ' lines, yield token content until '[DONE]'
}
```

Consumed in [App.tsx](packages/client/src/App.tsx#L36-L60) with token-by-token accumulation and explanation extraction via `---EXPLANATION---` marker.

## Component Patterns

### Monaco Editor Integration

Two instances in [TranslationView.tsx](packages/client/src/components/TranslationView.tsx):
1. Editable SAS input (`language="plaintext"`) — no custom SAS grammar yet
2. Read-only Hive output (`language="sql"`)

Both wrap `@monaco-editor/react`. Theme is VS Code Dark+.

### SAS Language Syntax Highlighting

Custom Monarch tokenizer in [lib/sas-language.ts](packages/client/src/lib/sas-language.ts) provides full SAS syntax highlighting:

**Token categories**:
- **Keywords**: `DATA`, `PROC`, `RUN`, `QUIT`, `SET`, `MERGE`, `BY`, `IF`, `THEN`, `DO`, `END`, etc.
- **PROC names**: `SORT`, `SQL`, `MEANS`, `FREQ`, `TRANSPOSE`, `PRINT`, `REG`, `LOGISTIC`, etc. (40+ procedures)
- **Built-in functions**: `SUBSTR`, `UPCASE`, `INTCK`, `LAG`, `SUM`, `COALESCE`, `MDY`, `DATEPART`, etc. (100+ functions)
- **Macro directives**: `%macro`, `%mend`, `%let`, `%if`, `%do`, `%put`, `%eval`, etc.
- **Macro variables**: `&varname`, `&&varname` (with expansion support in double-quoted strings)
- **Special variables**: `_N_`, `_ERROR_`, `_ALL_`, `_NUMERIC_`, `_CHARACTER_`, etc.
- **Comments**: Both `/* block */` and `* statement ;` styles
- **Strings**: Single and double-quoted (macro variables expanded in double-quoted strings)
- **Numbers**: Integers, floats, and SAS date/time literals (e.g., `'01JAN2020'd`)

**Integration**: Registered via `beforeMount` hook in [TranslationView.tsx](packages/client/src/components/TranslationView.tsx#L2-L3). No new dependencies — uses Monaco's built-in Monarch API. Colors auto-adapt to active vs-dark/light theme.

**Code folding**: Markers on `DATA`/`PROC`/`%MACRO` blocks → `RUN`/`QUIT`/`%MEND` for organized navigation.

### File Browser ([FileTree.tsx](packages/client/src/components/FileTree.tsx))

Uses `react-arborist` for tree rendering. Data comes from `GET /api/files` (mock tree from [services/mock-files.ts](packages/server/src/services/mock-files.ts)). Clicking a node fetches content via `GET /api/files/content/:path`.

**Mock file structure**:
```
sas-repository/
├── reports/          # Monthly sales, customer analysis, quarterly summary
├── etl/              # Data load, transform, quality checks
├── analysis/         # Regression models, frequency analysis
└── macros/           # Utility and date macros
```

Each directory contains 2-3 sample `.sas` files (~550 lines total in [mock-files.ts](packages/server/src/services/mock-files.ts)) demonstrating PROC SQL, DATA steps, PROC SORT, PROC MEANS, and macro patterns. Files are stored in-memory only.

### File Upload ([FileUpload.tsx](packages/client/src/components/FileUpload.tsx))

Drag-and-drop zone using native HTML5 File API. `POST /api/files/upload` via `multer`:
- Accept `.sas` only ([routes/files.ts](packages/server/src/routes/files.ts#L12-L17))
- 5MB limit
- Memory storage (no disk writes)

## Code Conventions

### Import extensions
All local imports use `.js` extension even in TypeScript files (ES module requirement):
```typescript
import { chatCompletion } from '../services/github-models.js';  // ✓ Correct
import { chatCompletion } from '../services/github-models';      // ✗ Will fail
```

### TypeScript configuration
- `"type": "module"` in both package.json files
- `tsconfig.base.json` at root extends to package-specific configs
- Server uses `tsx watch` instead of `ts-node` (faster, native ESM support)

### Error handling pattern
Routes return early with `res.status(4xx).json({ error: '...' })` and `return` (no throw after response sent). See [routes/translate.ts](packages/server/src/routes/translate.ts#L13-L16) for canonical pattern.

## Testing & Verification

**Manual test flow**:
1. Paste SAS PROC SQL with `CALCULATED` reference → Verify translation uses CTE
2. Upload `.sas` file with DATA step `first./last.` → Verify `ROW_NUMBER() OVER (PARTITION BY...)` pattern
3. Select different model in dropdown → Verify model parameter passed to API
4. Long translation → Verify tokens stream incrementally (not all at once)

**Smoke test commands**:
```bash
curl http://localhost:3001/api/health          # Should return {"status":"ok"}
curl http://localhost:3001/api/files           # Should return mock file tree JSON
```

## Deployment & Production Roadmap

### GCP Hosting

**Target architecture**:
- **Frontend**: Cloud Run (containerized Vite build with nginx)
- **Backend**: Cloud Run (Express + Node.js)
- **Database**: Cloud SQL for PostgreSQL (metadata/user data) + Dataproc (Hive on GCP)
- **Secrets**: Secret Manager for `GITHUB_PAT` and database credentials
- **Storage**: Cloud Storage for uploaded `.sas` files (replace in-memory storage)

**Current blockers for production**:
1. Mock file system needs real Cloud Storage integration ([services/mock-files.ts](packages/server/src/services/mock-files.ts) → new `storage.ts`)
2. Mock Hive execution needs Dataproc JDBC connection ([routes/hive.ts](packages/server/src/routes/hive.ts#L6))
3. No authentication — add Identity Platform + session management
4. No rate limiting on translation endpoint

### Real Hive Execution

Replace mock in [routes/hive.ts](packages/server/src/routes/hive.ts) with:
```typescript
import hive from 'jdbc/lib/hive'; // or use @cloudera/hive-driver
const connection = hive.createConnection(process.env.HIVE_JDBC_URL);
```

**Environment variables needed**:
- `HIVE_JDBC_URL=jdbc:hive2://dataproc-cluster:10000/default`
- `HIVE_USERNAME=hive` (optional, depends on cluster auth)
- `HIVE_PRINCIPAL=hive/_HOST@REALM` (for Kerberos)

**Execution flow**:
1. User clicks "Execute on Hive" in [Toolbar.tsx](packages/client/src/components/Toolbar.tsx)
2. `POST /api/hive/execute` receives translated HiveQL
3. Server validates query (read-only mode: block DROP/ALTER/DELETE)
4. Execute via JDBC connection with 30s timeout
5. Return results to [HiveResults.tsx](packages/client/src/components/HiveResults.tsx) for tabular display

**Safety considerations**:
- Sandbox execution in separate Dataproc namespace
- Resource limits (max rows: 1000, max execution time: 30s)
- Query sanitization to prevent injection
- Audit logging for all executed queries

### Database Setup (Cloud SQL)

**Schema for production**:
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE translations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  sas_code TEXT NOT NULL,
  hive_sql TEXT NOT NULL,
  model VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_status VARCHAR(20)  -- 'pending', 'success', 'failed'
);

CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  filename VARCHAR(255) NOT NULL,
  gcs_path VARCHAR(500) NOT NULL,  -- gs://bucket/path
  size_bytes INTEGER,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Migration path**:
1. Add Cloud SQL PostgreSQL instance in same GCP region as Cloud Run services
2. Create `packages/server/src/db/` with connection pooling (pg-pool)
3. Replace mock file tree with `SELECT * FROM uploaded_files WHERE user_id = ?`
4. Store translation history for user feedback loop
5. Expose `GET /api/translations/:id` endpoint for retrieving past translations

### Infrastructure as Code

Use Terraform or Cloud Deployment Manager:
- VPC with private subnet for Cloud SQL
- Service accounts with minimal IAM roles
- Cloud Armor WAF rules for rate limiting
- Cloud Monitoring dashboards for GitHub Models API quota tracking

## Known Limitations (by design for POC)

- No authentication/authorization
- Hive execution is mocked (returns fake result tables)
- File uploads don't persist (memory only)
- Translation prompt is English-only

## When Making Changes

**Adding new SAS→Hive translation rules**: Edit `SYSTEM_PROMPT` in [translation.ts](packages/server/src/services/translation.ts), add to function mapping table or structural patterns section. Keep examples specific (input/output pairs).

**Changing GitHub Models config**: Modify `GITHUB_MODELS_URL` or `DEFAULT_MODEL` constants in [github-models.ts](packages/server/src/services/github-models.ts). Test with actual PAT in `.env`.

**UI layout changes**: All components have paired `.css` files with BEM-style naming. Main layout is CSS Grid in [App.css](packages/client/src/App.css).

**Adding endpoints**: Create route file in `packages/server/src/routes/`, export default Express router, import and mount in [index.ts](packages/server/src/index.ts#L16-L18).

**Extending SAS syntax highlighting**: Edit the tokenizer in [lib/sas-language.ts](packages/client/src/lib/sas-language.ts) – add keywords/functions to the corresponding array (e.g., `keywords`, `procs`, `builtinFunctions`, `specialVars`), then update the Monarch `root` token rules if needed. Token colors use standard Monaco names (`keyword`, `type`, `predefined`, `variable`, `comment`, `string`, `number`) and auto-adapt to theme.
