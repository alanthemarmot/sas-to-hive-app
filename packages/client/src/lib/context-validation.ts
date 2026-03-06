export interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
  sasEquivalent?: string;
}

export interface TableSchema {
  targetTable: string;
  columns: ColumnDef[];
}

export interface TableMapping {
  sasLibrary: string;
  sasDataset: string;
  targetSchema: string;
  targetTable: string;
  notes?: string;
}

export interface ContextFile {
  version: '1';
  name: string;
  description?: string;
  taxArea?: string;
  targetDialect?: 'hive' | 'bigquery' | 'spark';
  tableMappings: TableMapping[];
  schemas: TableSchema[];
  businessRules: string[];
  commonPartitionKeys?: string[];
  promptNotes?: string;
}

const MAX_CONTEXT_SIZE = 50_000;

export function validateContextFile(obj: unknown): asserts obj is ContextFile {
  if (!obj || typeof obj !== 'object') throw new Error('Context must be a JSON object');
  const ctx = obj as Record<string, unknown>;

  // Size check
  const serialised = JSON.stringify(ctx);
  if (serialised.length > MAX_CONTEXT_SIZE) {
    throw new Error(`Context file exceeds the 50 KB limit (${Math.round(serialised.length / 1024)} KB)`);
  }

  if (ctx.version !== '1') throw new Error('Unsupported context version. Expected "1".');
  if (typeof ctx.name !== 'string' || !ctx.name.trim()) throw new Error('"name" is required');
  if (!Array.isArray(ctx.tableMappings)) throw new Error('"tableMappings" must be an array');
  if (!Array.isArray(ctx.schemas)) throw new Error('"schemas" must be an array');
  if (!Array.isArray(ctx.businessRules)) throw new Error('"businessRules" must be an array');

  for (const m of ctx.tableMappings as unknown[]) {
    const mapping = m as Record<string, unknown>;
    if (typeof mapping.sasLibrary !== 'string') throw new Error('Each tableMapping must have a string "sasLibrary"');
    if (typeof mapping.sasDataset !== 'string') throw new Error('Each tableMapping must have a string "sasDataset"');
    if (typeof mapping.targetSchema !== 'string') throw new Error('Each tableMapping must have a string "targetSchema"');
    if (typeof mapping.targetTable !== 'string') throw new Error('Each tableMapping must have a string "targetTable"');
  }

  for (const s of ctx.schemas as unknown[]) {
    const schema = s as Record<string, unknown>;
    if (typeof schema.targetTable !== 'string') throw new Error('Each schema must have a string "targetTable"');
    if (!Array.isArray(schema.columns)) throw new Error('Each schema must have a "columns" array');
    for (const c of schema.columns as unknown[]) {
      const col = c as Record<string, unknown>;
      if (typeof col.name !== 'string') throw new Error('Each column must have a string "name"');
      if (typeof col.type !== 'string') throw new Error('Each column must have a string "type"');
      if (typeof col.nullable !== 'boolean') throw new Error('Each column must have a boolean "nullable"');
    }
  }

  for (const rule of ctx.businessRules as unknown[]) {
    if (typeof rule !== 'string') throw new Error('Each businessRule must be a string');
  }

  if (ctx.commonPartitionKeys !== undefined) {
    if (!Array.isArray(ctx.commonPartitionKeys)) throw new Error('"commonPartitionKeys" must be an array');
    for (const k of ctx.commonPartitionKeys as unknown[]) {
      if (typeof k !== 'string') throw new Error('Each partition key must be a string');
    }
  }

  if (ctx.promptNotes !== undefined && typeof ctx.promptNotes !== 'string') {
    throw new Error('"promptNotes" must be a string');
  }
}
