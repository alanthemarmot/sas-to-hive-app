import { BigQuery } from '@google-cloud/bigquery';

const MUTATION_PATTERN = /^\s*(DROP|ALTER|DELETE|TRUNCATE|INSERT|UPDATE|MERGE|CREATE)\b/i;
const HAS_LIMIT = /\bLIMIT\s+\d+/i;
const ONE_GB = 1_073_741_824;
const AUTO_LIMIT = 1000;

export interface BigQueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  bytesScanned: number;
  executionTimeMs: number;
}

/**
 * Converts BigQuery-specific value types (BigInt, BigQueryDate, etc.)
 * to plain JSON-serialisable values.
 */
function toJsonSafe(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === 'bigint') return Number(val);
  // BigQueryDate / BigQueryTimestamp / BigQueryInt have a `.value` string property
  if (typeof val === 'object' && 'value' in (val as object)) {
    return (val as { value: unknown }).value;
  }
  return val;
}

/**
 * Executes a read-only BigQuery SQL query against the configured dataset.
 *
 * Safety guards:
 *  - Blocks mutating statements (DROP, ALTER, DELETE, TRUNCATE, INSERT, UPDATE, MERGE, CREATE)
 *  - Auto-appends LIMIT 1000 when no LIMIT clause is present
 *  - Dry-run cost check: rejects queries that would scan more than 1 GB
 */
export async function executeBigQuery(sql: string): Promise<BigQueryResult> {
  const project = process.env.GOOGLE_CLOUD_PROJECT!;
  const dataset = process.env.BIGQUERY_DATASET ?? 'sas_migration_samples';

  if (MUTATION_PATTERN.test(sql.trim())) {
    throw new Error(
      'Mutating statements (DROP, ALTER, DELETE, TRUNCATE, INSERT, UPDATE, CREATE, MERGE) are not permitted.',
    );
  }

  const query = HAS_LIMIT.test(sql) ? sql : `${sql.trimEnd()}\nLIMIT ${AUTO_LIMIT}`;

  const bigquery = new BigQuery({ projectId: project });

  const defaultDataset = { datasetId: dataset, projectId: project };

  // Dry run — check bytes that would be scanned before executing
  const [dryRunJob] = await bigquery.createQueryJob({
    query,
    defaultDataset,
    dryRun: true,
    useLegacySql: false,
  });

  const bytesScanned = Number(
    dryRunJob.metadata?.statistics?.totalBytesProcessed ?? 0,
  );

  if (bytesScanned > ONE_GB) {
    throw new Error(
      `Query would scan ${(bytesScanned / ONE_GB).toFixed(2)} GB, which exceeds the 1 GB safety limit.`,
    );
  }

  const startTime = Date.now();

  const [rawRows] = await bigquery.query({
    query,
    defaultDataset,
    useLegacySql: false,
  });

  const executionTimeMs = Date.now() - startTime;

  const columns: string[] = rawRows.length > 0 ? Object.keys(rawRows[0] as object) : [];

  const rows: unknown[][] = (rawRows as Record<string, unknown>[]).map((row) =>
    columns.map((col) => toJsonSafe(row[col])),
  );

  return { columns, rows, rowCount: rows.length, bytesScanned, executionTimeMs };
}
