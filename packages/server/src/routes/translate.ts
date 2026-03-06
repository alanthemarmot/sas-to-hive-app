import { Router, type Request, type Response } from 'express';
import { chatCompletion, chatCompletionStream, DEFAULT_MODEL } from '../services/github-models.js';
import { buildTranslationPrompt, parseTranslationResponse, VALID_DIALECTS, type Dialect } from '../services/translation.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { sasCode, model, dialect = 'hive' } = req.body;

    if (!sasCode || typeof sasCode !== 'string' || sasCode.trim().length === 0) {
      res.status(400).json({ error: 'sasCode is required and must be a non-empty string.' });
      return;
    }

    if (!VALID_DIALECTS.includes(dialect)) {
      res.status(400).json({ error: `Invalid dialect. Must be one of: ${VALID_DIALECTS.join(', ')}` });
      return;
    }

    const usedModel = model || DEFAULT_MODEL;
    const messages = buildTranslationPrompt(sasCode, dialect as Dialect);

    const response = await chatCompletion({
      messages,
      model: usedModel,
      temperature: 0.2,
      maxTokens: 4000,
    });

    const { hiveSQL, explanation } = parseTranslationResponse(response);

    res.json({ hiveSQL, explanation, model: usedModel });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Translation failed';
    console.error('Translation error:', message);
    res.status(500).json({ error: message });
  }
});

router.post('/stream', async (req: Request, res: Response) => {
  try {
    const { sasCode, model, dialect = 'hive' } = req.body;

    if (!sasCode || typeof sasCode !== 'string' || sasCode.trim().length === 0) {
      res.status(400).json({ error: 'sasCode is required and must be a non-empty string.' });
      return;
    }

    if (!VALID_DIALECTS.includes(dialect)) {
      res.status(400).json({ error: `Invalid dialect. Must be one of: ${VALID_DIALECTS.join(', ')}` });
      return;
    }

    const usedModel = model || DEFAULT_MODEL;
    const messages = buildTranslationPrompt(sasCode, dialect as Dialect);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const stream = chatCompletionStream({
      messages,
      model: usedModel,
      temperature: 0.2,
      maxTokens: 4000,
    });

    for await (const token of stream) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stream translation failed';
    console.error('Stream translation error:', message);

    // If headers haven't been sent yet, send error as JSON
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else {
      // If streaming already started, send error as SSE event
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
});

export default router;
