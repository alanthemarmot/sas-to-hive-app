import type { ChatMessage } from './github-models.js';

export type Dialect = 'hive' | 'bigquery' | 'spark';

export const VALID_DIALECTS: readonly Dialect[] = ['hive', 'bigquery', 'spark'] as const;

// ---------------------------------------------------------------------------
// Dialect configuration
// ---------------------------------------------------------------------------

interface DialectConfig {
  name: string;
  tableStorage: string;
  functionOverrides: Record<string, string>;
  structuralNotes: string;
}

const DIALECT_CONFIGS: Record<Dialect, DialectConfig> = {
  hive: {
    name: 'HiveQL (Hive 3.x on Cloudera CDP)',
    tableStorage: 'STORED AS ORC',
    functionOverrides: {},
    structuralNotes: `
- Use \`STORED AS ORC\` for all created tables
- Macro variables: \`%LET var = value;\` → \`SET hivevar:var = value;\` / \`\${hivevar:var}\`
`,
  },
  bigquery: {
    name: 'BigQuery Standard SQL (Google Cloud)',
    tableStorage: '',
    functionOverrides: {
      'SCAN(s, n, delim)': 'SPLIT(s, delim)[ORDINAL(n)]',
      'INTCK(interval, from, to)': 'DATE_DIFF(to, from, DAY)',
      'INTNX(interval, date, n)': 'DATE_ADD(date, INTERVAL n DAY)',
      'DATEPART(dt)': 'DATE(dt)',
      'TODAY()': 'CURRENT_DATE()',
      'DATETIME()': 'CURRENT_TIMESTAMP()',
    },
    structuralNotes: `
- BigQuery does NOT use \`STORED AS ORC\`. Use \`CREATE TABLE project.dataset.tablename AS SELECT ...\`
- BigQuery uses backtick-quoted identifiers for reserved words: \`\\\`table\\\`\` not "table"
- ARRAY indexing is 1-based using OFFSET(n-1) or ORDINAL(n): \`SPLIT(s, delim)[OFFSET(n-1)]\`
- Use \`DATE_DIFF(date1, date2, DAY)\` — argument order is reversed vs. DATEDIFF
- \`UNION ALL\` is standard; \`UNION\` by itself deduplicates (same as SQL standard)
- BigQuery does not have Hive's \`hivevar:\` macro system. Use scripting variables with \`DECLARE\` / \`SET\`
`,
  },
  spark: {
    name: 'Spark SQL (Apache Spark / Databricks)',
    tableStorage: 'USING DELTA',
    functionOverrides: {
      'SCAN(s, n, delim)': 'SPLIT(s, delim)[n-1]',
      'INTCK(interval, from, to)': 'DATEDIFF(to, from)',
      'INTNX(interval, date, n)': 'DATE_ADD(date, n)',
    },
    structuralNotes: `
- Spark SQL syntax is largely compatible with HiveQL but prefer \`USING DELTA\` for created tables on Databricks
- Window functions are fully supported with the same syntax as HiveQL
- Macro variables: use Databricks widgets (\`dbutils.widgets.get('var')\`) or notebook parameters
- \`DISTRIBUTE BY\` and \`CLUSTER BY\` are Spark-specific optimisations; do not add them unless requested
`,
  },
};

// ---------------------------------------------------------------------------
// Base prompt pieces (shared across all dialects)
// ---------------------------------------------------------------------------

const BASE_FUNCTION_MAP: Record<string, string> = {
  'SUBSTR(s, pos, len)': 'SUBSTR(s, pos, len)',
  'TRIM(s)': 'TRIM(s)',
  'UPCASE(s)': 'UPPER(s)',
  'LOWCASE(s)': 'LOWER(s)',
  'COMPRESS(s, chars)': "REGEXP_REPLACE(s, '[chars]', '')",
  'CATX(sep, a, b)': 'CONCAT_WS(sep, a, b)',
  'SCAN(s, n, delim)': 'SPLIT(s, delim)[n-1]',
  'INPUT(s, fmt)': 'CAST(s AS type)',
  'PUT(n, fmt)': 'CAST(n AS STRING)',
  'INTCK(interval, from, to)': 'DATEDIFF(to, from) (for days) or MONTHS_BETWEEN(to, from)',
  'INTNX(interval, date, n)': 'DATE_ADD(date, n) or ADD_MONTHS(date, n)',
  'DATEPART(dt)': 'TO_DATE(dt)',
  'TODAY()': 'CURRENT_DATE',
  'DATETIME()': 'CURRENT_TIMESTAMP',
  'MONOTONIC()': 'ROW_NUMBER() OVER ()',
  'COALESCE(a, b)': 'COALESCE(a, b)',
  'IFN(cond, t, f)': 'IF(cond, t, f)',
  'IFC(cond, t, f)': 'IF(cond, t, f)',
  'MISSING(x)': 'x IS NULL',
  'N(of vars)': 'Use CASE WHEN ... IS NOT NULL counting',
  'CATS(a, b)': 'CONCAT(TRIM(a), TRIM(b))',
  'CAT(a, b)': 'CONCAT(a, b)',
};

const BASE_PROMPT_HEADER = `You are an expert SAS programmer and SQL developer performing code migration.

## Task
Translate the provided SAS code into the target SQL dialect specified below. First, briefly explain what the SAS code does. Then provide the complete translated SQL.

## Translation Rules

### Structural
- Remove \`PROC SQL;\` and \`QUIT;\` wrappers — output bare SQL statements
- \`CALCULATED col\` → use a CTE or subquery to reference the alias
- \`OUTER UNION CORR\` → \`UNION ALL\` with explicit column alignment

### PROC Translations
- \`PROC SORT DATA=x; BY a b; RUN;\` → \`SELECT * FROM x ORDER BY a, b\`
- \`PROC SORT DATA=x NODUPKEY; BY a; RUN;\` → \`SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY a ORDER BY a) AS rn FROM x) t WHERE rn = 1\`
- \`PROC MEANS DATA=x; VAR col; CLASS grp; OUTPUT OUT=y ...\` → \`CREATE TABLE y ... AS SELECT grp, AVG(col) AS avg_col, SUM(col) AS sum_col, COUNT(*) AS _FREQ_ FROM x GROUP BY grp\`
- \`PROC FREQ DATA=x; TABLES col;\` → \`SELECT col, COUNT(*) AS frequency, COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() AS percent FROM x GROUP BY col ORDER BY col\`
- \`PROC TRANSPOSE\` → conditional aggregation with \`MAX(CASE WHEN ... THEN value END)\`
- \`PROC APPEND BASE=a DATA=b;\` → \`INSERT INTO a SELECT * FROM b\`

### DATA Step
- \`DATA y; SET x; ... RUN;\` → \`CREATE TABLE y ... AS SELECT ... FROM x\`
- \`BY var;\` with \`first.var\` / \`last.var\` → \`ROW_NUMBER() OVER (PARTITION BY var ORDER BY ...)\` = 1 for first, = max for last
- \`RETAIN\` → \`LAG()\` window function or self-join
- \`OUTPUT\` to multiple datasets → multiple \`CREATE TABLE AS SELECT\` with appropriate \`WHERE\` conditions
- SAS arrays → expand to explicit column references

### Values & Types
- SAS missing value \`.\` → \`NULL\`
- SAS missing char \`""\` or \`" "\` → \`NULL\` or empty string (context-dependent)
- SAS dates are numeric (days since 1960-01-01). Convert date arithmetic accordingly:
  - \`date_col + 30\` → \`DATE_ADD(date_col, 30)\`
  - Comparison with SAS date literal \`'01JAN2020'd\` → \`DATE '2020-01-01'\`
- SAS datetime values → \`TIMESTAMP\` type

### Macros
- Translate macro variables and control flow according to the dialect-specific rules below
- \`%MACRO name(...); ... %MEND;\` → comment explaining this is a macro template, then inline the expansion
- \`%IF / %THEN / %ELSE\` → cannot be directly translated; flag for manual review`;

const BASE_PROMPT_FOOTER = `## Output Format
1. Start with a brief explanation section wrapped in <!-- EXPLANATION_START --> and <!-- EXPLANATION_END --> markers
2. Then provide the SQL code in a \`\`\`sql code block
3. Add comments in the SQL mapping back to original SAS constructs
4. If any construct cannot be reliably translated, add a \`-- WARNING:\` comment explaining the issue

## Important
- Do NOT guess at translations you are unsure of — flag them with WARNING comments
- Preserve the logical intent of the code, not just the syntax
- Use CTEs liberally to improve readability`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(config: DialectConfig): string {
  const mergedFunctions = { ...BASE_FUNCTION_MAP, ...config.functionOverrides };
  const functionTable = Object.entries(mergedFunctions)
    .map(([sas, target]) => `| \`${sas}\` | \`${target}\` |`)
    .join('\n');

  const tableStorageNote = config.tableStorage
    ? `- All created tables should use \`${config.tableStorage}\` unless the source specifies otherwise`
    : '';

  return `${BASE_PROMPT_HEADER}

## Target Dialect
${config.name}

## Functions
| SAS | ${config.name} |
|-----|------|
${functionTable}

## Dialect-Specific Rules
${config.structuralNotes}
${tableStorageNote}

${BASE_PROMPT_FOOTER}`;
}

export function buildTranslationPrompt(
  sasCode: string,
  dialect: Dialect = 'hive',
): ChatMessage[] {
  const config = DIALECT_CONFIGS[dialect];
  return [
    {
      role: 'system',
      content: buildSystemPrompt(config),
    },
    {
      role: 'user',
      content: `Translate the following SAS code to ${config.name}:\n\n\`\`\`sas\n${sasCode}\n\`\`\``,
    },
  ];
}

export function parseTranslationResponse(response: string): { hiveSQL: string; explanation: string } {
  let explanation = '';
  let hiveSQL = '';

  // Extract explanation from markers
  const explanationMatch = response.match(
    /<!--\s*EXPLANATION_START\s*-->([\s\S]*?)<!--\s*EXPLANATION_END\s*-->/i
  );

  if (explanationMatch) {
    explanation = explanationMatch[1].trim();
  }

  // Extract SQL from code block
  const sqlMatch = response.match(/```sql\s*\n([\s\S]*?)```/);
  if (sqlMatch) {
    hiveSQL = sqlMatch[1].trim();
  }

  // Fallback: if no markers found, use the whole response as explanation
  if (!explanation) {
    // Try to split on the code block — everything before is explanation
    const codeBlockIndex = response.indexOf('```sql');
    if (codeBlockIndex !== -1) {
      explanation = response.slice(0, codeBlockIndex).trim();
      // Clean up any HTML comment markers or artifacts
      explanation = explanation
        .replace(/<!--\s*EXPLANATION_START\s*-->/gi, '')
        .replace(/<!--\s*EXPLANATION_END\s*-->/gi, '')
        .trim();
    } else {
      explanation = response;
    }
  }

  // Fallback: if still no SQL, try any code block
  if (!hiveSQL) {
    const anyCodeBlock = response.match(/```\w*\s*\n([\s\S]*?)```/);
    if (anyCodeBlock) {
      hiveSQL = anyCodeBlock[1].trim();
    }
  }

  return { hiveSQL, explanation };
}
