# Plan: GCP Deployment + BigQuery Query Execution

**TL;DR**: Deploy both the React frontend and Express backend to Cloud Run on a new GCP project, replace the mocked `/api/hive/execute` endpoint with a real `@google-cloud/bigquery` client, seed sample BigQuery datasets that mirror the existing mock SAS files, and add a "Target Dialect" dropdown so the LLM generates either BigQuery Standard SQL or HiveQL. Six phases, broadly sequential with some parallelism in the middle.

---

## Phase 0 — GCP Project Bootstrap

1. Create new GCP project (e.g. `sas-hive-tool`) via `gcloud projects create`
2. Enable required APIs in one command: `cloudrun.googleapis.com`, `bigquery.googleapis.com`, `secretmanager.googleapis.com`, `artifactregistry.googleapis.com`, `cloudbuild.googleapis.com`
3. Create an Artifact Registry Docker repository (e.g. `sas-hive-images`) in the desired region
4. Create a dedicated service account `sas-hive-api@<project>.iam.gserviceaccount.com` with minimal roles:
   - `roles/bigquery.dataViewer` (on the BigQuery dataset only, not project-wide)
   - `roles/bigquery.jobUser` (project-level, needed to run jobs)
   - `roles/secretmanager.secretAccessor` (to read GITHUB_PAT secret)
5. Store `GITHUB_PAT` in Secret Manager as the secret `github-pat`
6. Choose auth approach (see Decisions below) — Workload Identity or service account JSON key
7. Document all of the above as annotated `gcloud` commands in `infra/setup.sh`

---

## Phase 1 — BigQuery Sample Dataset

8. Create a BigQuery dataset `sas_migration_samples` in the GCP project
9. Write `infra/bigquery/seed.sql` — tables that align with the existing mock SAS file contents in `packages/server/src/services/mock-files.ts`:
   - `monthly_sales (customer_id STRING, region STRING, amount NUMERIC, sale_date DATE)` — mirrors `reports/monthly_sales.sas`
   - `customers (customer_id STRING, name STRING, region STRING, tier STRING, created_date DATE)` — mirrors `reports/customer_analysis.sas`
   - `transactions (txn_id STRING, customer_id STRING, product_id STRING, amount NUMERIC, txn_date DATE)` — general fact table for JOIN tests
   - `products (product_id STRING, name STRING, category STRING, price NUMERIC)` — dimension table for JOIN tests
   - Seed each table with ~20 representative rows
10. Apply the DDL + data via `bq query --use_legacy_sql=false < infra/bigquery/seed.sql`

---

## Phase 2 — BigQuery Backend Integration

*Depends on Phase 0 (service account). Can overlap with Phase 3.*

11. Add `@google-cloud/bigquery` to `packages/server/package.json`
12. Create `packages/server/src/services/bigquery.ts`:
    - Initialise `BigQuery` client using `GOOGLE_CLOUD_PROJECT` env var; credentials auto-detected via ADC (Workload Identity on Cloud Run, `gcloud auth application-default login` locally)
    - Export `executeBigQuery(sql: string): Promise<{ columns: string[], rows: unknown[][], bytesScanned: number }>`
    - **Safety guards** before any GCP call:
      - Block DDL/DML mutations (`DROP`, `ALTER`, `DELETE`, `TRUNCATE`, `INSERT`, `UPDATE`) — return 400
      - Auto-append `LIMIT 1000` if the query has no `LIMIT` clause
    - **Cost guard**: run a `dryRun: true` job first; reject with 400 if estimated bytes scanned > 1 GB
    - Map BigQuery `QueryRowsResponse` to the flat `{ columns, rows }` shape the client already consumes
13. Rewrite `packages/server/src/routes/hive.ts`:
    - Delegate to `executeBigQuery()` instead of the mock logic
    - Keep existing request shape `{ query: string }` and response shape `{ columns, rows, message }` — **no client changes needed**
    - Env guard: if `GOOGLE_CLOUD_PROJECT` is unset, fall back silently to the mock response (prefixed with a `X-Mock-Response: true` header) so local dev works without GCP credentials
14. Add `GOOGLE_CLOUD_PROJECT`, `BIGQUERY_DATASET`, and `GOOGLE_APPLICATION_CREDENTIALS` to `.env.example` with comments

---

## Phase 3 — BigQuery Dialect in the Translation Prompt

*Can proceed in parallel with Phase 2.*

15. In `packages/server/src/services/translation.ts`, extend `SYSTEM_PROMPT` with a `{{DIALECT}}` substitution — two conditional sections:
    - **HiveQL section** (existing rules, unchanged except parametrised)
    - **BigQuery Standard SQL section** (new rules):
      - Backtick identifier quoting: `` `project.dataset.table` ``
      - `DATE_DIFF(date1, date2, DAY)` instead of `DATEDIFF(date2, date1)`
      - `DATE_ADD(date, INTERVAL n DAY)` instead of `date + n`
      - `STRING_AGG(col, ',')` instead of `COLLECT_LIST` + `CONCAT_WS`
      - `FORMAT_DATE('%Y-%m-%d', date)` instead of `DATE_FORMAT`
      - `SAFE_DIVIDE(a, b)` instead of `CASE WHEN b = 0 THEN NULL ELSE a/b END`
      - `QUALIFY ROW_NUMBER() OVER (...) = 1` for deduplication (replaces subquery)
      - `ANY_VALUE(col)` for first-row aggregates (replaces `FIRST_VALUE` in `GROUP BY` queries)
      - `SELECT * EXCEPT (col)` — not available in HiveQL
      - Variable declarations via `DECLARE var TYPE; SET var = value;` instead of Hive `SET hivevar:`
16. Export `buildTranslationMessages(sasCode: string, dialect: 'hiveql' | 'bigquery')` — injects the right dialect section, updates the role description accordingly
17. Update `packages/server/src/routes/translate.ts` to accept an optional `dialect: 'hiveql' | 'bigquery'` body param (default `'hiveql'`) and pass it to `buildTranslationMessages()`

---

## Phase 4 — Dialect Selector UI

*Depends on Phase 3.*

18. Add `dialect` state (`'hiveql' | 'bigquery'`, default `'hiveql'`) to `packages/client/src/App.tsx` alongside existing `selectedModel` state
19. Add a "Target Dialect" `<select>` dropdown to `packages/client/src/components/Toolbar.tsx`, adjacent to the model selector:
    - Options: `HiveQL (Cloudera CDP)` | `BigQuery Standard SQL`
    - Accept `dialect` prop + `onDialectChange` callback
20. Thread `dialect` through `Toolbar` → `App.tsx` → `streamTranslation()` in `packages/client/src/api/client.ts` — add `dialect` to the SSE POST body
21. Update `packages/client/src/components/Toolbar.css` — style the new dropdown consistently with the model selector

---

## Phase 5 — Containerisation

*Can proceed in parallel with Phases 2–4.*

22. Create `packages/server/Dockerfile`:
    - Base: `node:20-alpine`
    - Copy workspace root `package.json` + `packages/server/` source
    - `npm ci --omit=dev` (production deps only)
    - Compile TypeScript: `npx tsc -p tsconfig.json --outDir dist`
    - `EXPOSE 3001`, `CMD ["node", "dist/index.js"]`
23. Create `packages/client/Dockerfile` (two-stage):
    - **Stage 1 (builder)**: `node:20-alpine` — copy entire workspace, `npm ci`, `npm run build -w packages/client` → outputs to `packages/client/dist/`
    - **Stage 2 (server)**: `nginx:1.27-alpine` — copy `dist/` from builder, copy `nginx.conf`
24. Create `packages/client/nginx.conf`:
    - Serve static files from `/usr/share/nginx/html`
    - SPA fallback: `try_files $uri $uri/ /index.html`
    - No proxy required — frontend calls the backend Cloud Run URL directly
25. Update `packages/client/vite.config.ts`: accept `VITE_API_BASE_URL` env var (injected at Docker build time via `--build-arg`); use it in `define: { __API_BASE__: ... }` for production. The existing `/api` proxy `server.proxy` block stays for local dev.
26. Update `packages/client/src/api/client.ts`: replace hardcoded `/api` base path with the injected `__API_BASE__` constant (falls back to `''` so local dev proxy still works)
27. Add `.dockerignore` to both `packages/server/` and `packages/client/` — exclude `node_modules`, `.env`, `dist/`

---

## Phase 6 — Cloud Run Deployment

*Depends on Phase 0 (registry) and Phase 5 (Dockerfiles).*

28. Build and push the backend image:
    ```sh
    docker build -f packages/server/Dockerfile \
      -t <REGION>-docker.pkg.dev/<PROJECT>/sas-hive-images/api:latest .
    docker push <REGION>-docker.pkg.dev/<PROJECT>/sas-hive-images/api:latest
    ```
29. Deploy backend Cloud Run service (`sas-hive-api`):
    - `--service-account sas-hive-api@<PROJECT>.iam.gserviceaccount.com` (enables Workload Identity)
    - `--update-secrets GITHUB_PAT=github-pat:latest`
    - `--set-env-vars GOOGLE_CLOUD_PROJECT=<PROJECT>,BIGQUERY_DATASET=sas_migration_samples`
    - `--allow-unauthenticated` (POC; add IAP for production)
    - Note the generated URL, e.g. `https://sas-hive-api-xxxxx.run.app`
30. Build and push the frontend image, injecting the backend URL:
    ```sh
    docker build -f packages/client/Dockerfile \
      --build-arg VITE_API_BASE_URL=https://sas-hive-api-xxxxx.run.app \
      -t <REGION>-docker.pkg.dev/<PROJECT>/sas-hive-images/ui:latest .
    docker push ...
    ```
31. Deploy frontend Cloud Run service (`sas-hive-ui`) — minimal CPU/memory, `--allow-unauthenticated`
32. Update CORS in `packages/server/src/index.ts`: replace `cors()` wildcard with the specific frontend Cloud Run URL

### Document all `gcloud run deploy` commands in `infra/setup.sh`.

---

## New / Modified Files

| File | Change |
|---|---|
| `infra/setup.sh` | **new** — annotated `gcloud` bootstrap commands |
| `infra/bigquery/seed.sql` | **new** — DDL + seed data |
| `packages/server/package.json` | add `@google-cloud/bigquery` |
| `packages/server/src/services/bigquery.ts` | **new** — BigQuery client wrapper with safety + cost guards |
| `packages/server/src/routes/hive.ts` | replace mock body with `executeBigQuery()` call |
| `packages/server/src/services/translation.ts` | extend `SYSTEM_PROMPT` with `{{DIALECT}}` substitution |
| `packages/server/src/routes/translate.ts` | accept `dialect` body param |
| `packages/server/Dockerfile` | **new** |
| `packages/client/src/App.tsx` | add `dialect` state |
| `packages/client/src/components/Toolbar.tsx` | add dialect dropdown |
| `packages/client/src/components/Toolbar.css` | style dialect dropdown |
| `packages/client/src/api/client.ts` | pass `dialect`; use `__API_BASE__` in production |
| `packages/client/vite.config.ts` | inject `VITE_API_BASE_URL` / `__API_BASE__` |
| `packages/client/Dockerfile` | **new** |
| `packages/client/nginx.conf` | **new** |
| `.env.example` | add GCP variables |

---

## Verification

1. **BigQuery local dev**: `gcloud auth application-default login` → translate a SAS SELECT → click Execute → real rows return from BigQuery `sas_migration_samples`
2. **Safety guard**: send `DROP TABLE customers` to `/api/hive/execute` → 400 returned before any BigQuery job is created
3. **Cost guard**: dry-run an unfiltered full table scan → confirm rejection when estimated bytes > 1 GB
4. **Dialect toggle**: translate the same SAS snippet with each dialect selected → different output syntax (date functions, variable declarations, identifier quoting)
5. **Mock fallback**: unset `GOOGLE_CLOUD_PROJECT`, hit `/api/hive/execute` → mock response returned, `X-Mock-Response: true` header present
6. **Container build**: `docker build -f packages/server/Dockerfile .` completes without error; `docker run -p 3001:3001 <image>` → `GET /api/health` responds `{"status":"ok"}`
7. **Cloud Run deploy**: `curl https://sas-hive-api-xxxxx.run.app/api/health` → `{"status":"ok"}`
8. **End-to-end in Cloud Run**: open frontend Cloud Run URL → paste SAS → translate → execute → real BigQuery rows display in HiveResults panel

---

## Decisions

| Concern | Choice |
|---|---|
| BigQuery auth in Cloud Run | **Workload Identity** (preferred) — service account attached to Cloud Run service, no JSON key to manage. Fallback: JSON key stored in Secret Manager, mounted as env var |
| BigQuery auth for local dev | ADC via `gcloud auth application-default login` |
| Frontend API routing in production | `VITE_API_BASE_URL` injected at Docker build time via `--build-arg`; nginx serves static files only, no proxy needed |
| DDL/DML blocking | Route-level regex check on the first token before any GCP call → 400 |
| Cost protection | Dry-run every query before execution; hard reject at 1 GB bytes scanned |
| IaC tooling | Plain `gcloud` CLI commands in `infra/setup.sh` — no Terraform for a POC |
| Dialect selector | Built as part of this plan (Phases 3–4), not as a separate feature worktree |

---

## Auth Option Detail

**Option A — Workload Identity (recommended for Cloud Run)**
- No JSON key to create, store, or rotate
- Attach the service account to the Cloud Run service: `--service-account sas-hive-api@<project>.iam.gserviceaccount.com`
- The `@google-cloud/bigquery` client picks up credentials automatically via ADC

**Option B — Service account JSON key via Secret Manager**
- Create key: `gcloud iam service-accounts keys create key.json --iam-account sas-hive-api@<project>.iam.gserviceaccount.com`
- Upload: `gcloud secrets create google-sa-key --data-file=key.json && rm key.json`
- Mount in Cloud Run: `--update-secrets GOOGLE_APPLICATION_CREDENTIALS=google-sa-key:latest`
- More portable (also works when hosting outside GCP), but requires key rotation discipline

---

## Known Limitations (by design for POC)

- No authentication — add Cloud IAP or Identity Platform before exposing externally
- BigQuery execution is limited to `sas_migration_samples` dataset; no cross-dataset or cross-project queries
- Uploaded `.sas` files still use in-memory storage — Cloud Storage integration deferred
- Translation history not persisted — no database yet (Cloud SQL schema is in the main plan for a future phase)
