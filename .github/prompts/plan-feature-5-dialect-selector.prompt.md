# Plan: Target Dialect Selector — Hive / BigQuery / Spark SQL

## Goal

Add a dialect dropdown that lets users choose their target SQL platform. Today the tool outputs HiveQL; with this feature it can also output BigQuery Standard SQL and Spark SQL. This future-proofs the tool for platform migrations and makes it the single bridge from SAS to whatever modern platform the organisation uses.

**Target users:** Teams evaluating whether to move to BigQuery (GCP) or Spark-based platforms, and developers who need to produce SQL for multiple environments from the same SAS source.

---

## Supported Dialects

| Value | Label | Description |
|-------|-------|-------------|
| `hive` | HiveQL (Hive 3.x) | Current default. Cloudera CDP / on-prem. |
| `bigquery` | BigQuery Standard SQL | Google Cloud — new platform target. |
| `spark` | Spark SQL | Databricks / Cloudera Spark — common intermediate. |

---

## Architecture

The dialect is passed as a parameter through the entire stack: UI → API → prompt builder → LLM system prompt.

### Request Change

Add `dialect` to the existing translation request body:

```typescript
// Existing
{ sasCode: string; model?: string; }

// Updated
{ sasCode: string; model?: string; dialect?: 'hive' | 'bigquery' | 'spark'; }
```

Default: `'hive'` (backwards-compatible — no client change required until the UI is added).

---

## Server: Parameterised System Prompt

### `packages/server/src/services/translation.ts`

Replace the single `SYSTEM_PROMPT` constant with a function that generates the prompt for the requested dialect.

#### Shared Base Rules
These rules apply to all dialects and don't change:
- Structural patterns (PROC SQL wrapper removal, DATA step → SELECT, etc.)
- PROC translations (SORT, MEANS, FREQ, TRANSPOSE, APPEND)
- Function mappings for string/date/null functions
- Explanation output format (markers, JSON blocks)

#### Dialect-Specific Overrides

Each dialect override is a TypeScript object specifying:
- `name` — human-readable name for the prompt
- `tableStorage` — how to create persistent tables (e.g. `STORED AS ORC` vs `OPTIONS(...)` vs none)
- `functionOverrides` — dialect-specific function mapping entries that replace or extend the base table
- `structuralNotes` — additional rules specific to this dialect

```typescript
interface DialectConfig {
  name: string;
  tableStorage: string;
  functionOverrides: Record<string, string>;   // SAS fn → dialect fn
  structuralNotes: string;
}

const DIALECT_CONFIGS: Record<string, DialectConfig> = {
  hive: {
    name: 'HiveQL (Hive 3.x on Cloudera CDP)',
    tableStorage: 'STORED AS ORC',
    functionOverrides: {},  // Base rules already target Hive
    structuralNotes: `
- Use \`STORED AS ORC\` for all created tables
- Macro variables: \`%LET var = value;\` → \`SET hivevar:var = value;\` / \`\${hivevar:var}\`
`,
  },
  bigquery: {
    name: 'BigQuery Standard SQL (Google Cloud)',
    tableStorage: '',  // BigQuery uses project.dataset.table notation, no STORED AS
    functionOverrides: {
      'SUBSTR(s, pos, len)': 'SUBSTR(s, pos, len)',           // Same
      'UPCASE(s)': 'UPPER(s)',                                 // Same
      'COMPRESS(s, chars)': "REGEXP_REPLACE(s, '[chars]', '')",
      'CATX(sep, a, b)': 'CONCAT_WS(sep, a, b)',             // Same
      'SCAN(s, n, delim)': 'SPLIT(s, delim)[ORDINAL(n)]',    // ORDINAL is 1-based in BQ
      'INTCK(interval, from, to)': 'DATE_DIFF(to, from, DAY)',
      'INTNX(interval, date, n)': 'DATE_ADD(date, INTERVAL n DAY)',
      'DATEPART(dt)': 'DATE(dt)',
      'TODAY()': 'CURRENT_DATE()',
      'DATETIME()': 'CURRENT_TIMESTAMP()',
      'MONOTONIC()': 'ROW_NUMBER() OVER ()',
      'IFN(cond, t, f)': 'IF(cond, t, f)',
    },
    structuralNotes: `
- BigQuery does NOT use \`STORED AS ORC\`. Use \`CREATE TABLE project.dataset.tablename AS SELECT ...\`
- BigQuery uses backtick-quoted identifiers for reserved words: \`table\` not "table"
- ARRAY indexing is 1-based using OFFSET(n-1) or ORDINAL(n): \`SPLIT(s, delim)[OFFSET(n-1)]\`
- Use \`DATE_DIFF(date1, date2, DAY)\` — argument order is reversed vs. DATEDIFF
- \`UNION ALL\` is standard; \`UNION\` by itself deduplicates (same as SQL standard)
- BigQuery does not have Hive's \`hivevar:\` macro system. Use scripting variables with \`DECLARE\` / \`SET\`
- BigQuery ML and INFORMATION_SCHEMA are available — do not translate to these unless explicitly requested
`,
  },
  spark: {
    name: 'Spark SQL (Apache Spark / Databricks)',
    tableStorage: 'USING DELTA',  // Delta Lake default on Databricks
    functionOverrides: {
      'SCAN(s, n, delim)': 'SPLIT(s, delim)[n-1]',  // 0-based like Hive
      'INTCK(interval, from, to)': 'DATEDIFF(to, from)',
      'INTNX(interval, date, n)': 'DATE_ADD(date, n)',
    },
    structuralNotes: `
- Spark SQL syntax is largely compatible with HiveQL but prefer \`USING DELTA\` for created tables on Databricks
- Use \`spark.sql()\` context in PySpark; bare SQL for Databricks SQL / notebooks
- Window functions are fully supported with the same syntax as HiveQL
- Macro variables: use Databricks widgets (\`dbutils.widgets.get('var')\`) or notebook parameters
- \`DISTRIBUTE BY\` and \`CLUSTER BY\` are Spark-specific optimisations; do not add them unless requested
`,
  },
};
```

#### Updated Prompt Builder

```typescript
export function buildTranslationPrompt(
  sasCode: string,
  dialect: 'hive' | 'bigquery' | 'spark' = 'hive'
): ChatMessage[] {
  const config = DIALECT_CONFIGS[dialect];
  const systemPrompt = buildSystemPrompt(config);

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Translate the following SAS code to ${config.name}:\n\n\`\`\`sas\n${sasCode}\n\`\`\``,
    },
  ];
}

function buildSystemPrompt(config: DialectConfig): string {
  // Merge base function table with dialect-specific overrides
  const mergedFunctions = { ...BASE_FUNCTION_MAP, ...config.functionOverrides };
  const functionTable = Object.entries(mergedFunctions)
    .map(([sas, target]) => `| \`${sas}\` | \`${target}\` |`)
    .join('\n');

  return `${BASE_PROMPT_HEADER}

## Target Dialect
${config.name}

## Functions
| SAS | ${config.name} |
|-----|------|
${functionTable}

## Dialect-Specific Rules
${config.structuralNotes}

${BASE_PROMPT_FOOTER}`;
}
```

Refactor the existing monolithic `SYSTEM_PROMPT` string into:
- `BASE_PROMPT_HEADER` — role, task description, structural rules (shared)
- `BASE_FUNCTION_MAP` — SAS function → Hive mapping (base, overridden per dialect)
- `BASE_PROMPT_FOOTER` — output format instructions (shared)

---

## Server Route Change

### `packages/server/src/routes/translate.ts`

Update both `/stream` and `/followup` handlers to accept and pass `dialect`:

```typescript
const { sasCode, model, dialect = 'hive' } = req.body;

// Validate dialect
const VALID_DIALECTS = ['hive', 'bigquery', 'spark'] as const;
if (!VALID_DIALECTS.includes(dialect)) {
  return res.status(400).json({ error: `Invalid dialect. Must be one of: ${VALID_DIALECTS.join(', ')}` });
}

const messages = buildTranslationPrompt(sasCode, dialect);
```

---

## Client: Dialect Selector UI

### `packages/client/src/components/Toolbar.tsx`

Add a dialect selector alongside the existing model selector:

```tsx
const DIALECTS = [
  { id: 'hive',     label: 'HiveQL',         icon: '🔶' },
  { id: 'bigquery', label: 'BigQuery SQL',    icon: '🔵' },
  { id: 'spark',    label: 'Spark SQL',       icon: '⚡' },
] as const;

// In Toolbar props:
selectedDialect: string;
onDialectChange: (dialect: string) => void;

// In JSX — place before model selector:
<label htmlFor="dialect-select" className="model-label">Target</label>
<select
  id="dialect-select"
  className="model-select"
  value={selectedDialect}
  onChange={(e) => onDialectChange(e.target.value)}
>
  {DIALECTS.map((d) => (
    <option key={d.id} value={d.id}>{d.icon} {d.label}</option>
  ))}
</select>
```

### `packages/client/src/App.tsx`

```typescript
const [selectedDialect, setSelectedDialect] = useState<'hive' | 'bigquery' | 'spark'>('hive');
```

Pass `selectedDialect` to `streamTranslation()` via `api/client.ts`.

### `packages/client/src/api/client.ts`

Update `streamTranslation` signature:
```typescript
export async function* streamTranslation(
  sasCode: string,
  model?: string,
  dialect?: string
): AsyncGenerator<string> {
  const response = await fetch(`${API_BASE}/translate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sasCode, model, dialect }),
  });
  // ... rest unchanged ...
}
```

---

## Output Panel Label Change

When a non-Hive dialect is selected, update the Hive output panel header in `TranslationView.tsx` to reflect the target:

```typescript
const OUTPUT_LABELS: Record<string, string> = {
  hive: 'HiveQL Output',
  bigquery: 'BigQuery SQL Output',
  spark: 'Spark SQL Output',
};

// In TranslationView props:
dialect: string;

// In JSX:
<div className="editor-panel-header">{OUTPUT_LABELS[dialect] ?? 'SQL Output'}</div>
```

Also update the Monaco language for the output editor — BigQuery and Spark SQL are both valid `'sql'` for Monaco's purposes, so no grammar change needed.

---

## Download Filename Change

In `App.tsx`, update the `handleDownload` function to use the correct file extension per dialect:

```typescript
const DIALECT_EXTENSIONS: Record<string, string> = {
  hive: '.hql',
  bigquery: '.sql',
  spark: '.sql',
};

const handleDownload = () => {
  const ext = DIALECT_EXTENSIONS[selectedDialect] ?? '.sql';
  const blob = new Blob([hiveSQL], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `translated${ext}`;
  a.click();
  URL.revokeObjectURL(url);
};
```

---

## Files to Modify

- `packages/server/src/services/translation.ts` — refactor `SYSTEM_PROMPT` into dialect-parameterised builder; add `DIALECT_CONFIGS`; update `buildTranslationPrompt()` signature
- `packages/server/src/routes/translate.ts` — accept and validate `dialect` in `/stream` and `/followup` routes
- `packages/client/src/api/client.ts` — add `dialect` param to `streamTranslation()`
- `packages/client/src/App.tsx` — add `selectedDialect` state, pass to translation and download
- `packages/client/src/components/Toolbar.tsx` — add dialect selector UI
- `packages/client/src/components/TranslationView.tsx` — add `dialect` prop, update output panel header

---

## Acceptance Criteria

- [ ] Dialect selector is visible in the toolbar with three options: HiveQL, BigQuery SQL, Spark SQL
- [ ] Default is HiveQL — existing behaviour unchanged
- [ ] Selecting BigQuery and translating produces BigQuery-valid SQL (e.g., no `STORED AS ORC`, correct `DATE_DIFF` argument order, ARRAY indexing with `OFFSET`)
- [ ] Selecting Spark and translating produces Spark SQL (e.g., `USING DELTA`, Spark-compatible syntax)
- [ ] Output panel header updates to reflect the selected dialect
- [ ] Download uses `.hql` for Hive and `.sql` for BigQuery / Spark
- [ ] Invalid `dialect` values are rejected by the server with a 400 error
- [ ] Changing dialect clears the previous translation output (to avoid confusion between dialects)
- [ ] No TypeScript or build errors
