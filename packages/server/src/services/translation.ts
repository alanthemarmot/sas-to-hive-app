import type { ChatMessage } from './github-models.js';

export interface TranslationWarning {
  id: string;
  severity: 'info' | 'warning' | 'error';
  sasConstruct: string;
  message: string;
  hiveLine: number | null;
}

export interface TranslationConfidence {
  confidence: 'high' | 'moderate' | 'low';
  warnings: TranslationWarning[];
}

const SYSTEM_PROMPT = `You are an expert SAS programmer and Apache Hive developer performing code migration from SAS to HiveQL (Hive 3.x on Cloudera CDP).

## Task
Translate the provided SAS code into equivalent HiveQL. First, briefly explain what the SAS code does. Then provide the complete HiveQL translation.

## Translation Rules

### Structural
- Remove \`PROC SQL;\` and \`QUIT;\` wrappers — output bare SQL statements
- \`CREATE TABLE x AS SELECT ...\` → \`CREATE TABLE x STORED AS ORC AS SELECT ...\`
- \`CALCULATED col\` → use a CTE or subquery to reference the alias
- \`OUTER UNION CORR\` → \`UNION ALL\` with explicit column alignment

### PROC Translations
- \`PROC SORT DATA=x; BY a b; RUN;\` → \`SELECT * FROM x ORDER BY a, b\`
- \`PROC SORT DATA=x NODUPKEY; BY a; RUN;\` → \`SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY a ORDER BY a) AS rn FROM x) t WHERE rn = 1\`
- \`PROC MEANS DATA=x; VAR col; CLASS grp; OUTPUT OUT=y MEAN=avg_col SUM=sum_col;\` → \`CREATE TABLE y STORED AS ORC AS SELECT grp, AVG(col) AS avg_col, SUM(col) AS sum_col, COUNT(*) AS _FREQ_ FROM x GROUP BY grp\`
- \`PROC FREQ DATA=x; TABLES col;\` → \`SELECT col, COUNT(*) AS frequency, COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() AS percent FROM x GROUP BY col ORDER BY col\`
- \`PROC TRANSPOSE\` → conditional aggregation with \`MAX(CASE WHEN ... THEN value END)\`
- \`PROC APPEND BASE=a DATA=b;\` → \`INSERT INTO a SELECT * FROM b\`

### DATA Step
- \`DATA y; SET x; ... RUN;\` → \`CREATE TABLE y STORED AS ORC AS SELECT ... FROM x\`
- \`BY var;\` with \`first.var\` / \`last.var\` → \`ROW_NUMBER() OVER (PARTITION BY var ORDER BY ...)\` = 1 for first, = max for last
- \`RETAIN\` → \`LAG()\` window function or self-join
- \`OUTPUT\` to multiple datasets → multiple \`CREATE TABLE AS SELECT\` with appropriate \`WHERE\` conditions
- SAS arrays → expand to explicit column references

### Functions
| SAS | Hive |
|-----|------|
| \`SUBSTR(s, pos, len)\` | \`SUBSTR(s, pos, len)\` |
| \`TRIM(s)\` | \`TRIM(s)\` |
| \`UPCASE(s)\` | \`UPPER(s)\` |
| \`LOWCASE(s)\` | \`LOWER(s)\` |
| \`COMPRESS(s, chars)\` | \`REGEXP_REPLACE(s, '[chars]', '')\` |
| \`CATX(sep, a, b)\` | \`CONCAT_WS(sep, a, b)\` |
| \`SCAN(s, n, delim)\` | \`SPLIT(s, delim)[n-1]\` |
| \`INPUT(s, fmt)\` | \`CAST(s AS type)\` |
| \`PUT(n, fmt)\` | \`CAST(n AS STRING)\` |
| \`INTCK(interval, from, to)\` | \`DATEDIFF(to, from)\` (for days) or \`MONTHS_BETWEEN(to, from)\` |
| \`INTNX(interval, date, n)\` | \`DATE_ADD(date, n)\` or \`ADD_MONTHS(date, n)\` |
| \`DATEPART(dt)\` | \`TO_DATE(dt)\` |
| \`TODAY()\` | \`CURRENT_DATE\` |
| \`DATETIME()\` | \`CURRENT_TIMESTAMP\` |
| \`MONOTONIC()\` | \`ROW_NUMBER() OVER ()\` |
| \`COALESCE(a, b)\` | \`COALESCE(a, b)\` |
| \`IFN(cond, t, f)\` | \`IF(cond, t, f)\` |
| \`IFC(cond, t, f)\` | \`IF(cond, t, f)\` |
| \`MISSING(x)\` | \`x IS NULL\` |
| \`N(of vars)\` | Use \`CASE WHEN ... IS NOT NULL\` counting |
| \`CATS(a, b)\` | \`CONCAT(TRIM(a), TRIM(b))\` |
| \`CAT(a, b)\` | \`CONCAT(a, b)\` |

### Values & Types
- SAS missing value \`.\` → \`NULL\`
- SAS missing char \`""\` or \`" "\` → \`NULL\` or empty string (context-dependent)
- SAS dates are numeric (days since 1960-01-01). Convert date arithmetic accordingly:
  - \`date_col + 30\` → \`DATE_ADD(date_col, 30)\`
  - Comparison with SAS date literal \`'01JAN2020'd\` → \`DATE '2020-01-01'\`
- SAS datetime values → \`TIMESTAMP\` type in Hive

### Macros
- \`%LET var = value;\` → \`SET hivevar:var = value;\`
- \`&var\` or \`&var.\` references → \`\${hivevar:var}\`
- \`%MACRO name(...); ... %MEND;\` → comment explaining this is a macro template, then inline the expansion. Flag that the user may need to handle this in their workflow tool.
- \`%IF / %THEN / %ELSE\` → cannot be directly translated; flag for manual review

## Output Format
1. Start with a brief explanation section wrapped in <!-- EXPLANATION_START --> and <!-- EXPLANATION_END --> markers
2. Then provide the HiveQL code in a \`\`\`sql code block
3. Add comments in the SQL mapping back to original SAS constructs
4. If any construct cannot be reliably translated, add a \`-- WARNING:\` comment explaining the issue
5. End with a confidence assessment in a \`\`\`json code block with this exact schema:

\`\`\`json
{
  "confidence": "high" | "moderate" | "low",
  "warnings": [
    {
      "id": "llm-1",
      "severity": "info" | "warning" | "error",
      "sasConstruct": "string",
      "message": "string",
      "hiveLine": number | null
    }
  ]
}
\`\`\`

Confidence levels:
- "high": Pattern is well-understood and deterministic. Translation is very likely correct.
- "moderate": Translation is plausible but involves ambiguity that depends on runtime context.
- "low": Pattern has no clean Hive equivalent, or the construct is inherently non-deterministic in translation.

## Important
- Do NOT guess at translations you are unsure of — flag them with WARNING comments
- Preserve the logical intent of the code, not just the syntax
- Use CTEs liberally to improve readability
- All created tables should use \`STORED AS ORC\` unless the source specifies otherwise`;

export function buildTranslationPrompt(sasCode: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `Translate the following SAS code to HiveQL:\n\n\`\`\`sas\n${sasCode}\n\`\`\``,
    },
  ];
}

export function parseTranslationResponse(response: string): {
  hiveSQL: string;
  explanation: string;
  confidence: TranslationConfidence | null;
} {
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

  // Extract JSON confidence block
  const jsonMatch = response.match(/```json\s*\n([\s\S]*?)```/);
  let confidence: TranslationConfidence | null = null;
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed && typeof parsed.confidence === 'string' && Array.isArray(parsed.warnings)) {
        confidence = parsed as TranslationConfidence;
      }
    } catch {
      confidence = null;
    }
  }

  return { hiveSQL, explanation, confidence };
}
