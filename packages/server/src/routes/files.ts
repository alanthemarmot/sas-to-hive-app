import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import { getMockFileTree, getMockFileContent } from '../services/mock-files.js';

const router = Router();

// Configure multer: memory storage, .sas files only, 5MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.sas') {
      cb(null, true);
    } else {
      cb(new Error('Only .sas files are allowed.'));
    }
  },
});

// GET / — return mock file tree
router.get('/', (_req: Request, res: Response) => {
  const tree = getMockFileTree();
  res.json(tree);
});

// GET /content/:path(*) — return file content by path
router.get('/content/:path(*)', (req: Request<{ path: string }>, res: Response) => {
  const filePath = decodeURIComponent(req.params.path as string);
  const content = getMockFileContent(filePath);

  if (content === null) {
    res.status(404).json({ error: `File not found: ${filePath}` });
    return;
  }

  res.json({ content });
});

// POST /upload — upload a single .sas file
router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded. Please upload a .sas file.' });
    return;
  }

  res.json({
    name: req.file.originalname,
    size: req.file.size,
    content: req.file.buffer.toString('utf-8'),
  });
});

export default router;
