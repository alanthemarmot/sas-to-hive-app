# Plan: Conversational Follow-Up — "Ask About This Translation"

## Goal

Add a chat panel beneath the translation output that allows users to ask natural-language questions about the specific translation they are viewing. The LLM already has full SAS/Hive context from the translation — this feature feeds it back as conversation history so follow-up questions are precise and contextual.

**Target users:** Non-technical SAS users who want to understand *why* the Hive code looks the way it does, and who would normally ask a colleague. This feature replaces that colleague.

---

## Architecture Overview

### New Server Endpoint

**`POST /api/translate/followup`** in `packages/server/src/routes/translate.ts`

Request body:
```typescript
{
  sasCode: string;          // Original SAS code (for context)
  hiveSQL: string;          // The translated Hive SQL (for context)
  explanation: string;      // The explanation already shown (for context)
  question: string;         // The user's follow-up question
  history: ChatMessage[];   // Previous turns in this conversation
  model?: string;
}
```

Response: SSE stream (same pattern as `/api/translate/stream`) yielding answer tokens.

The endpoint builds a message array:
1. The existing `SYSTEM_PROMPT` from `translation.ts` (reuse as-is)
2. A synthetic "assistant" turn containing the explanation + Hive SQL (reconstructs what the model originally produced)
3. Any prior conversation `history` turns
4. The new user `question`

This gives the model full context without re-translating.

### New Client Component

**`packages/client/src/components/ChatPanel.tsx`** + **`ChatPanel.css`**

Props:
```typescript
interface ChatPanelProps {
  sasCode: string;
  hiveSQL: string;
  explanation: string;
  theme: 'dark' | 'light';
  isVisible: boolean;
  onClose: () => void;
}
```

State managed inside `ChatPanel`:
- `messages: { role: 'user' | 'assistant'; content: string }[]`
- `input: string`
- `isStreaming: boolean`

Layout:
- Fixed-height scrollable message list (auto-scrolls to bottom on new tokens)
- Text input + "Ask" button at the bottom
- Each message rendered as a styled bubble (user: right-aligned, assistant: left-aligned)
- Assistant messages render markdown (use a lightweight renderer — `marked` or manual `<pre>` for code blocks, `<p>` for prose)
- A "Clear conversation" button in the panel header

### `api/client.ts` addition

```typescript
export async function* streamFollowUp(
  sasCode: string,
  hiveSQL: string,
  explanation: string,
  question: string,
  history: { role: string; content: string }[],
  model?: string
): AsyncGenerator<string> {
  // Same SSE streaming pattern as streamTranslation()
  // POST to /api/translate/followup
}
```

---

## Integration in `App.tsx`

- Add state: `chatHistory`, `showChat`
- Add a "Ask a question" / chat icon button to the `Toolbar` (only enabled when `hiveSQL` is non-empty)
- Render `<ChatPanel>` below `<ExplanationPanel>` (or in a slide-in panel from the right edge)
- When the user submits a follow-up, append the user message to `chatHistory`, stream the response, then append the completed assistant message

```tsx
// App.tsx additions
const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
const [showChat, setShowChat] = useState(false);

// Reset chat when a new translation starts
// (inside handleTranslate, before the stream loop):
setChatHistory([]);
setShowChat(false);
```

---

## Prompt Engineering

Add a new exported function to `packages/server/src/services/translation.ts`:

```typescript
export function buildFollowUpPrompt(
  sasCode: string,
  hiveSQL: string,
  explanation: string,
  question: string,
  history: ChatMessage[]
): ChatMessage[] {
  return [
    { role: 'system', content: FOLLOW_UP_SYSTEM_PROMPT },
    // Synthetic context turn
    {
      role: 'user',
      content: `Here is the SAS code I need help with:\n\`\`\`sas\n${sasCode}\n\`\`\``,
    },
    {
      role: 'assistant',
      content: `${explanation}\n\n\`\`\`sql\n${hiveSQL}\n\`\`\``,
    },
    ...history,
    { role: 'user', content: question },
  ];
}
```

`FOLLOW_UP_SYSTEM_PROMPT` should instruct the model to:
- Answer in plain English suitable for a non-technical SAS user
- Avoid jargon unless it defines it immediately (e.g., *"window function — a calculation that looks at nearby rows"*)
- Keep answers short (2-4 sentences) unless the user asks for more detail
- When showing code, show small snippets only and explain each line
- Never suggest the user modify the translated code without showing them exactly what to change

---

## Streaming Route Handler

In `packages/server/src/routes/translate.ts`, add alongside the existing `/stream` handler:

```typescript
router.post('/followup', async (req, res) => {
  const { sasCode, hiveSQL, explanation, question, history, model } = req.body;

  if (!question?.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }

  const messages = buildFollowUpPrompt(sasCode, hiveSQL, explanation, question, history ?? []);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    for await (const token of chatCompletionStream(messages, model)) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
  } finally {
    res.end();
  }
});
```

---

## UI / UX Details

### Chat Panel Layout

```
┌─────────────────────────────────────────────┐
│ 💬 Ask about this translation          [×]  │
├─────────────────────────────────────────────┤
│                                             │
│  [assistant] This translation uses a        │
│  window function to replicate SAS's         │
│  first./last. logic...                      │
│                                             │
│                [user] What is PARTITION BY? │
│                                             │
│  [assistant] PARTITION BY tells Hive to     │
│  restart the count for each unique value    │
│  of the column(s) you list...               │
│                                             │
├─────────────────────────────────────────────┤
│  [ Ask a question...              ] [Ask ▶] │
└─────────────────────────────────────────────┘
```

- Panel appears as a collapsible section below `ExplanationPanel`
- Auto-focus the text input when panel opens
- Pressing Enter submits; Shift+Enter inserts newline
- "Ask" button disabled while streaming or input is empty
- Show a subtle typing indicator (animated dots) while the assistant streams

### Toolbar Button

Add to `Toolbar.tsx`:
```tsx
<button
  className="toolbar-btn btn-secondary"
  onClick={onToggleChat}
  disabled={!hasOutput}
  title="Ask a question about this translation"
>
  <MessageCircle size={14} />
  Ask
</button>
```

---

## Files to Create

- `packages/client/src/components/ChatPanel.tsx`
- `packages/client/src/components/ChatPanel.css`

## Files to Modify

- `packages/server/src/routes/translate.ts` — add `/followup` route
- `packages/server/src/services/translation.ts` — add `buildFollowUpPrompt()` and `FOLLOW_UP_SYSTEM_PROMPT`
- `packages/client/src/api/client.ts` — add `streamFollowUp()`
- `packages/client/src/App.tsx` — add `chatHistory`, `showChat` state; render `<ChatPanel>`
- `packages/client/src/components/Toolbar.tsx` — add "Ask" button with `MessageCircle` icon

---

## Acceptance Criteria

- [ ] "Ask" button in toolbar is disabled until a translation has been produced
- [ ] Clicking "Ask" opens the chat panel with an empty message list
- [ ] User can type a question and receive a streaming answer contextualised to the current SAS/Hive translation
- [ ] Conversation history is maintained across multiple follow-up questions in the same session
- [ ] Starting a new translation resets the chat history
- [ ] The panel can be closed and re-opened without losing history (until a new translation starts)
- [ ] Answers render markdown code blocks inline with syntax highlighting
- [ ] No TypeScript or build errors
