# Plan: Translation Confidence Scoring & Validation Warnings

## Goal

For each translation, show a confidence indicator (green / amber / red) and surface specific, actionable validation warnings inline. Users should know exactly *how much* to trust the output and *where* to focus their review — without needing to be Hive experts themselves.

**Target users:** Non-technical SAS users who need to know whether they can hand translated code to a DBA straight away, or whether it requires review first.

---

## Confidence Model

### Three Levels

| Level | Label | Meaning |
|-------|-------|---------|
| 🟢 **High** | "Ready to review" | Pattern is well-understood and deterministic. Translation is very likely correct. |
| 🟡 **Moderate** | "Review recommended" | Translation is plausible but involves ambiguity that depends on runtime context (column types, ordering, etc.). |
| 🔴 **Low** | "Manual review required" | Pattern has no clean Hive equivalent, or the construct is inherently non-deterministic in translation. |

### Scoring Inputs

The score is computed from two sources:

1. **LLM self-assessment** — The model rates its own confidence and lists warnings as structured JSON, returned alongside the translation.
2. **Static pattern matching** — Client-side regex checks on the original SAS code flag known high-risk constructs immediately, before the LLM responds. This gives instant feedback.

Using both means static checks catch the obvious cases immediately, while the LLM catches subtler ones.

---

## Changes to the Translation API Response

### Update `SYSTEM_PROMPT` in `translation.ts`

Extend the output format section to require a structured JSON block at the end of the response:

````
## Output Format
1. Start with explanation wrapped in <!-- EXPLANATION_START --> and <!-- EXPLANATION_END --> markers
2. Provide the HiveQL code in a ```sql code block
3. End with a confidence assessment in a ```json block with this exact schema:

```json
{
  "confidence": "high" | "moderate" | "low",
  "warnings": [
    {
      "id": "string",
      "severity": "info" | "warning" | "error",
      "sasConstruct": "string",    // The SAS construct that triggered this
      "message": "string",         // Plain English, user-facing
      "hiveLine": number | null    // Line number in translated SQL (if known)
    }
  ]
}
```
````

### Update `parseTranslationResponse()` in `translation.ts`

Add extraction of the JSON confidence block:

```typescript
export interface TranslationWarning {
  id: string;
  severity: 'info' | 'warning' | 'error';
  sasConstruct: string;
  message: string;
  hiveLine: number | null;
}

export interface TranslationConfidence {
  confidence: 'high' | 'moderate' | 'low';
  warnings: TranslationWarning[];
}

export function parseTranslationResponse(response: string): {
  hiveSQL: string;
  explanation: string;
  confidence: TranslationConfidence | null;
} {
  // ... existing extraction logic ...

  // Extract JSON block after the sql code block
  const jsonMatch = response.match(/```json\s*\n([\s\S]*?)```/);
  let confidence: TranslationConfidence | null = null;
  if (jsonMatch) {
    try {
      confidence = JSON.parse(jsonMatch[1]);
    } catch {
      confidence = null;  // Graceful degradation — don't break if JSON is malformed
    }
  }

  return { hiveSQL, explanation, confidence };
}
```

### Streaming: Extract Confidence Asynchronously

In `App.tsx`, after the stream completes and the final extraction runs, parse the confidence block from `fullOutput` alongside the SQL and explanation. Add to app state:

```typescript
const [confidence, setConfidence] = useState<TranslationConfidence | null>(null);
```

Reset to `null` when a new translation starts.

---

## Static Pre-Translation Checks

Create **`packages/client/src/lib/sas-static-checks.ts`**:

```typescript
export interface StaticCheck {
  pattern: RegExp;
  severity: 'info' | 'warning' | 'error';
  sasConstruct: string;
  message: string;
}

export const STATIC_CHECKS: StaticCheck[] = [
  {
    pattern: /%IF|%THEN|%ELSE/i,
    severity: 'error',
    sasConstruct: '%IF / %THEN / %ELSE',
    message: 'Macro conditional logic cannot be directly translated to Hive. This section will need manual rewriting.',
  },
  {
    pattern: /CALL\s+EXECUTE/i,
    severity: 'error',
    sasConstruct: 'CALL EXECUTE',
    message: 'CALL EXECUTE generates dynamic SAS code at runtime. There is no Hive equivalent — manual rewrite required.',
  },
  {
    pattern: /\bRETAIN\b/i,
    severity: 'warning',
    sasConstruct: 'RETAIN statement',
    message: 'RETAIN is translated using LAG() window functions. Verify that the row ordering in the translated SQL matches your SAS dataset.',
  },
  {
    pattern: /first\.\w+|last\.\w+/i,
    severity: 'warning',
    sasConstruct: 'first./last. variables',
    message: 'first./last. detection depends on row ordering. Confirm the ORDER BY clause in the translated ROW_NUMBER() matches your data.',
  },
  {
    pattern: /PROC\s+TRANSPOSE/i,
    severity: 'warning',
    sasConstruct: 'PROC TRANSPOSE',
    message: 'PROC TRANSPOSE with multiple ID variables or BY groups may require additional manual adjustment.',
  },
  {
    pattern: /HASH\s+/i,
    severity: 'error',
    sasConstruct: 'Hash object',
    message: 'SAS hash objects have no direct Hive equivalent. Consider rewriting as a JOIN.',
  },
  {
    pattern: /INTCK\s*\(/i,
    severity: 'info',
    sasConstruct: 'INTCK()',
    message: "SAS's INTCK counts calendar boundaries, not elapsed time. Hive's DATEDIFF counts elapsed days. Results may differ for month/year intervals.",
  },
  {
    pattern: /INTO\s*:/i,
    severity: 'info',
    sasConstruct: 'SELECT INTO :macvar',
    message: 'Macro variable assignment from SELECT is translated to a SET statement. Verify the variable is referenced correctly downstream.',
  },
];

export function runStaticChecks(sasCode: string): TranslationWarning[] {
  return STATIC_CHECKS
    .filter(check => check.pattern.test(sasCode))
    .map((check, i) => ({
      id: `static-${i}`,
      severity: check.severity,
      sasConstruct: check.sasConstruct,
      message: check.message,
      hiveLine: null,
    }));
}
```

Run static checks in `App.tsx` immediately when the Translate button is clicked (before the API call resolves), so users see instant feedback:

```tsx
const handleTranslate = useCallback(async () => {
  // ...
  const immediateWarnings = runStaticChecks(sasCode);
  setConfidence(immediateWarnings.length > 0 ? {
    confidence: immediateWarnings.some(w => w.severity === 'error') ? 'low' : 'moderate',
    warnings: immediateWarnings,
  } : null);
  // ... then begin stream ...
}, [sasCode, selectedModel]);
```

Replace/merge with LLM-returned confidence once the stream completes.

---

## New Client Component

### `packages/client/src/components/ConfidencePanel.tsx` + `ConfidencePanel.css`

Props:
```typescript
interface ConfidencePanelProps {
  confidence: TranslationConfidence | null;
  isTranslating: boolean;
}
```

Layout (rendered below the Toolbar, above the editors):

```
┌──────────────────────────────────────────────────────────────────┐
│ 🟡 Moderate Confidence — Review recommended                       │
│                                                                  │
│  ⚠  RETAIN statement — Translated using LAG(). Verify row        │
│     ordering matches your SAS dataset.                           │
│                                                                  │
│  ℹ  INTCK() — Results may differ for month/year intervals.       │
└──────────────────────────────────────────────────────────────────┘
```

States:
- **Hidden** when `confidence` is `null` and not translating
- **Pulsing skeleton** when `isTranslating` and confidence is not yet set (static checks may already have populated it)
- **Green banner** for `high` with no warnings: *"High Confidence — Translation follows standard patterns"*
- **Amber banner** for `moderate` with collapsible warning list
- **Red banner** for `low` with non-collapsible warning list (always expanded)

Warning item styling by severity:
- `error` — red left border, ✕ icon
- `warning` — amber left border, ⚠ icon
- `info` — blue left border, ℹ icon

If `hiveLine` is set on a warning, render a small clickable badge *"Line N"* that scrolls the Hive editor to that line (use Monaco's `revealLine()` API via a ref).

---

## Hive Editor Monaco Integration

To support clicking "Line N" badges:

In `TranslationView.tsx`, expose the Monaco editor instance via a ref:

```typescript
import { useRef } from 'react';
import type { editor } from 'monaco-editor';

// Add to props
onHiveEditorReady?: (editor: editor.IStandaloneCodeEditor) => void;

// Inside the Hive Editor instance:
<Editor
  onMount={(editor) => props.onHiveEditorReady?.(editor)}
  ...
/>
```

In `App.tsx`:
```typescript
const hiveEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

const handleWarningLineClick = (line: number) => {
  hiveEditorRef.current?.revealLineInCenter(line);
  hiveEditorRef.current?.setPosition({ lineNumber: line, column: 1 });
};
```

---

## Files to Create

- `packages/client/src/lib/sas-static-checks.ts`
- `packages/client/src/components/ConfidencePanel.tsx`
- `packages/client/src/components/ConfidencePanel.css`

## Files to Modify

- `packages/server/src/services/translation.ts` — extend `SYSTEM_PROMPT` output format, update `parseTranslationResponse()`, add `TranslationWarning` / `TranslationConfidence` types
- `packages/client/src/App.tsx` — add `confidence` state, run static checks pre-translate, render `<ConfidencePanel>`
- `packages/client/src/components/TranslationView.tsx` — add `onHiveEditorReady` prop, wire Monaco `onMount`
- `packages/client/src/api/client.ts` — if the non-streaming `/api/translate` endpoint is used, update its response type to include `confidence`

---

## Acceptance Criteria

- [ ] Static checks run immediately on "Translate" click, before LLM responds
- [ ] Confidence panel is hidden when no translation is present
- [ ] Green / amber / red banner matches the `confidence` value returned by the LLM
- [ ] All warnings display with correct severity icon and colour coding
- [ ] `error`-severity warnings cause the panel to be red regardless of the overall `confidence` field
- [ ] `hiveLine` badges (when present) scroll the Hive editor to the correct line on click
- [ ] Panel gracefully handles `null` confidence (LLM JSON malformed) — shows no panel rather than crashing
- [ ] No TypeScript or build errors
