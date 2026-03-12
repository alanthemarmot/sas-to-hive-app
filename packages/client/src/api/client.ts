import type { TranslationConfidence } from '../lib/sas-static-checks';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

const API_BASE = '/api';

export async function translateSasToBigQuery(
  sasCode: string,
  model?: string,
): Promise<{ hiveSQL: string; explanation: string; confidence: TranslationConfidence | null; model: string }> {
  const response = await fetch(`${API_BASE}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sasCode, model }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Translation failed');
  }
  return response.json();
}

export async function* streamTranslation(
  sasCode: string,
  model?: string,
): AsyncGenerator<string> {
  const response = await fetch(`${API_BASE}/translate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sasCode, model }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Translation stream failed');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (typeof parsed.token === 'string') yield parsed.token;
        } catch (e) {
          if (e instanceof Error && e.message !== data) throw e;
          // ignore malformed lines
        }
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim().startsWith('data: ')) {
    const data = buffer.trim().slice(6);
    if (data !== '[DONE]') {
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) throw new Error(parsed.error);
        if (typeof parsed.token === 'string') yield parsed.token;
      } catch {
        // ignore malformed trailing data
      }
    }
  }
}

export async function fetchFileTree(): Promise<FileNode[]> {
  const response = await fetch(`${API_BASE}/files`);
  if (!response.ok) {
    throw new Error('Failed to fetch file tree');
  }
  const data = await response.json();
  // API returns a single root node; wrap in array for the tree component
  return Array.isArray(data) ? data : [data];
}

export async function fetchFileContent(path: string): Promise<string> {
  const response = await fetch(`${API_BASE}/files/content/${encodeURIComponent(path)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch file content');
  }
  const data = await response.json();
  return data.content;
}

export async function uploadFile(file: File): Promise<{ name: string; content: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error('Failed to upload file');
  }
  return response.json();
}

export async function executeBigQueryQuery(
  query: string,
): Promise<{ columns: string[]; rows: any[][]; message: string }> {
  const response = await fetch(`${API_BASE}/hive/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'BigQuery execution failed');
  }
  return response.json();
}
