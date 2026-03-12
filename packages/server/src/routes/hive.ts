import { Router, type Request, type Response } from 'express';
import { executeBigQuery } from '../services/bigquery.js';

const router = Router();

router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({ error: 'query is required and must be a non-empty string.' });
      return;
    }

    // Use real BigQuery when GOOGLE_CLOUD_PROJECT is configured
    if (process.env.GOOGLE_CLOUD_PROJECT) {
      const result = await executeBigQuery(query);
      res.json({
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        bytesScanned: result.bytesScanned,
        executionTimeMs: result.executionTimeMs,
        message: `Query executed successfully. ${result.rowCount} row${result.rowCount !== 1 ? 's' : ''} returned. (${result.executionTimeMs}ms)`,
      });
      return;
    }

    // Mock fallback — used when GOOGLE_CLOUD_PROJECT is not set
    res.set('X-Mock-Response', 'true');

    const trimmedQuery = query.trim().toUpperCase();
    const delay = 200 + Math.floor(Math.random() * 300);
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (trimmedQuery.startsWith('SELECT')) {
      const columns = ['id', 'name', 'region', 'amount', 'created_date'];
      const rows = [
        [1, 'Alpha Corp', 'EAST', 15230.50, '2024-01-15'],
        [2, 'Beta Industries', 'WEST', 8920.75, '2024-02-20'],
        [3, 'Gamma LLC', 'NORTH', 22100.00, '2024-03-10'],
        [4, 'Delta Partners', 'SOUTH', 5670.25, '2024-04-05'],
        [5, 'Epsilon Inc', 'EAST', 31450.80, '2024-05-18'],
      ];
      res.json({
        columns,
        rows,
        rowCount: rows.length,
        message: `[MOCK] Query executed successfully. ${rows.length} rows returned. (${delay}ms)`,
      });
    } else if (trimmedQuery.startsWith('CREATE')) {
      res.json({ columns: [], rows: [], rowCount: 0, message: `[MOCK] Table created successfully. (${delay}ms)` });
    } else if (trimmedQuery.startsWith('INSERT')) {
      res.json({ columns: [], rows: [], rowCount: 0, message: `[MOCK] Insert completed. Rows affected: 5. (${delay}ms)` });
    } else {
      res.json({ columns: [], rows: [], rowCount: 0, message: `[MOCK] Statement executed successfully. (${delay}ms)` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query execution failed';
    console.error('Execute error:', message);
    // 400 for blocked mutations / cost limit, 500 for unexpected errors
    const status = message.includes('not permitted') || message.includes('exceeds') ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

export default router;
