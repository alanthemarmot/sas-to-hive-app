export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export const GITHUB_MODELS_URL = 'https://models.github.ai/inference/chat/completions';
export const DEFAULT_MODEL = 'openai/gpt-4.1-mini';

export async function chatCompletion(options: ChatCompletionOptions): Promise<string> {
  const token = process.env.GITHUB_PAT;
  if (!token) {
    throw new Error('GITHUB_PAT environment variable is not set. Please set it to your GitHub personal access token.');
  }

  const model = options.model || DEFAULT_MODEL;

  const response = await fetch(GITHUB_MODELS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub Models API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('GitHub Models API returned no choices.');
  }

  return data.choices[0].message.content;
}

export async function* chatCompletionStream(options: ChatCompletionOptions): AsyncGenerator<string> {
  const token = process.env.GITHUB_PAT;
  if (!token) {
    throw new Error('GITHUB_PAT environment variable is not set. Please set it to your GitHub personal access token.');
  }

  const model = options.model || DEFAULT_MODEL;

  const response = await fetch(GITHUB_MODELS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub Models API error (${response.status}): ${errorBody}`);
  }

  if (!response.body) {
    throw new Error('Response body is null — streaming not supported.');
  }

  const reader = response.body.getReader();
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
      if (!trimmed || trimmed.startsWith(':')) continue;

      if (trimmed === 'data: [DONE]') {
        return;
      }

      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  }
}
