import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import translateRouter from './routes/translate.js';
import filesRouter from './routes/files.js';
import hiveRouter from './routes/hive.js';

// Load .env from workspace root (../../ from src/ directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/translate', translateRouter);
app.use('/api/files', filesRouter);
app.use('/api/hive', hiveRouter);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

export default app;
