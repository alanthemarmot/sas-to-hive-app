import { Router, type Request, type Response } from 'express';

const router = Router();

// TODO: implement real JDBC connection when process.env.HIVE_JDBC_URL is set

router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({ error: 'query is required and must be a non-empty string.' });
      return;
    }

    const trimmedQuery = query.trim().toUpperCase();

    // Simulate processing delay (200-500ms)
    const delay = 200 + Math.floor(Math.random() * 300);
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (trimmedQuery.startsWith('SELECT')) {
      // Mock SELECT results
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
        message: `Query executed successfully. ${rows.length} rows returned. (${delay}ms)`,
      });
    } else if (trimmedQuery.startsWith('CREATE')) {
      res.json({
        columns: [],
        rows: [],
        message: `Table created successfully. (${delay}ms)`,
      });
    } else if (trimmedQuery.startsWith('INSERT')) {
      res.json({
        columns: [],
        rows: [],
        message: `Insert completed successfully. Rows affected: 5. (${delay}ms)`,
      });
    } else if (trimmedQuery.startsWith('SET')) {
      res.json({
        columns: [],
        rows: [],
        message: `Variable set successfully. (${delay}ms)`,
      });
    } else {
      res.json({
        columns: [],
        rows: [],
        message: `Statement executed successfully. (${delay}ms)`,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query execution failed';
    console.error('Hive execution error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
