# Plan: Line-by-Line "What Changed?" Mapping Panel

## Goal

Draw visual connections between specific SAS lines/blocks and their Hive equivalents, with plain-English tooltips explaining *why* the syntax changed. Users can see "my SAS code, rewritten" rather than "foreign code I don't understand."

**Target users:** SAS users who want to build a mental model of how their specific code maps to Hive — not just see a general explanation, but understand the 1:1 correspondence line by line.

---

## Architecture Overview

The mapping data is produced by the LLM alongside the translation. The client uses Monaco's decoration and hover provider APIs to render the visual links without any additional dependencies.

---

## Changes to the Translation API

### Extend `SYSTEM_PROMPT` in `translation.ts`

Add a third output section after the SQL code block requiring a mapping as structured JSON:

````
3. After the ```sql block, provide a line mapping as a ```json block:

```json
{
  "mappings": [
    {
      "id": "string",
      "sasLines": [1, 2],          // 1-indexed line numbers in the input SAS code
      "hiveLines": [3, 4, 5],      // 1-indexed line numbers in the output HiveQL
      "explanation": "string"      // Plain English, 1-2 sentences, non-technical
    }
  ]
}
```

Include one mapping entry per logical SAS construct (e.g. one for PROC SORT, one for each SELECT clause,
one for each BY group). Aim for 3-8 mappings per translation. The explanation should be written for a
non-technical SAS user: avoid Hive jargon and explain what the Hive construct achieves in SAS terms.
````

### Update `parseTranslationResponse()` in `translation.ts`

```typescript
export interface LineMapping {
  id: string;
  sasLines: number[];
  hiveLines: number[];
  explanation: string;
}

export interface TranslationMappings {
  mappings: LineMapping[];
}

// Update return type
export function parseTranslationResponse(response: string): {
  hiveSQL: string;
  explanation: string;
  confidence: TranslationConfidence | null;
  mappings: TranslationMappings | null;
} {
  // ... existing logic ...

  // Extract mapping JSON — look for second ```json block, or distinguish by schema
  const jsonBlocks = [...response.matchAll(/```json\s*\n([\s\S]*?)```/g)];
  let mappings: TranslationMappings | null = null;
  for (const block of jsonBlocks) {
    try {
      const parsed = JSON.parse(block[1]);
      if (parsed.mappings) {
        mappings = parsed;
        break;
      }
    } catch { /* ignore */ }
  }

  return { hiveSQL, explanation, confidence, mappings };
}
```

---

## Client State

Add to `App.tsx`:
```typescript
import type { TranslationMappings } from './types.js'; // or from api/client

const [mappings, setMappings] = useState<TranslationMappings | null>(null);
const [activeMappingId, setActiveMappingId] = useState<string | null>(null);
```

Reset to `null` at the start of each translation.

After stream completes, extract and set mappings from `fullOutput`.

---

## Monaco Editor Integration

This is the core of the feature. Both editors need to highlight their respective line ranges when a mapping is active.

### `TranslationView.tsx` Changes

Add new props:
```typescript
interface TranslationViewProps {
  // ... existing props ...
  mappings: TranslationMappings | null;
  activeMappingId: string | null;
  onMappingActivate: (id: string | null) => void;
  onSasEditorReady: (editor: editor.IStandaloneCodeEditor) => void;
  onHiveEditorReady: (editor: editor.IStandaloneCodeEditor) => void;
}
```

### Decoration Strategy

Use `editor.createDecorationsCollection()` to apply line-range highlights. Apply two types of decoration:

1. **Inactive mapping** — subtle left-border gutter marker on all mapped lines in both editors (so users can see coverage even before hovering)
2. **Active mapping** — full-line highlight in both editors when a mapping is hovered or clicked

CSS classes for decorations (register via Monaco's `editor.defineTheme` or inject global styles):

```css
/* Gutter marker for all mapped lines */
.mapping-gutter-marker {
  background: var(--rc-primary, #1a56a0);
  width: 3px !important;
  margin-left: 3px;
  border-radius: 2px;
}

/* Active highlight — SAS side */
.mapping-active-sas {
  background: rgba(255, 200, 0, 0.15);
  border-left: 3px solid #ffc800;
}

/* Active highlight — Hive side */
.mapping-active-hive {
  background: rgba(0, 120, 212, 0.15);
  border-left: 3px solid #0078d4;
}
```

### Hover Provider

Register a Monaco hover provider on both editors to show the mapping explanation when a user hovers over a mapped line:

```typescript
useEffect(() => {
  if (!sasEditor || !mappings) return;
  const disposable = monaco.languages.registerHoverProvider('sas', {
    provideHover(model, position) {
      const mapping = mappings.mappings.find(m =>
        m.sasLines.includes(position.lineNumber)
      );
      if (!mapping) return null;
      return {
        range: new monaco.Range(
          Math.min(...mapping.sasLines), 1,
          Math.max(...mapping.sasLines), model.getLineMaxColumn(Math.max(...mapping.sasLines))
        ),
        contents: [
          { value: `**SAS → Hive**` },
          { value: mapping.explanation },
          { value: `_Hive lines: ${mapping.hiveLines.join(', ')}_` },
        ],
      };
    },
  });
  return () => disposable.dispose();
}, [sasEditor, mappings]);
```

Do the same for the Hive editor (using `'sql'` language, referencing `m.hiveLines`).

### Synchronised Scrolling (Optional Enhancement)

When a mapping is activated via hover/click, scroll both editors to show the relevant lines:
```typescript
sasEditor?.revealLinesInCenter(Math.min(...mapping.sasLines), Math.max(...mapping.sasLines));
hiveEditor?.revealLinesInCenter(Math.min(...mapping.hiveLines), Math.max(...mapping.hiveLines));
```

---

## Mapping Navigator Panel

### `packages/client/src/components/MappingNavigator.tsx` + `MappingNavigator.css`

A compact vertical list of all mappings, rendered between the two editor panels (or as a narrow centre column). Each item shows a brief label and an arrow icon, and is clickable to activate the corresponding mapping.

```
┌─────────────────────┐
│ ↔ Mapping Guide     │
├─────────────────────┤
│ ► PROC SORT         │  ← click to highlight
│   Remove duplicates │
├─────────────────────┤
│ ► SELECT clause     │
│   Column selection  │
├─────────────────────┤
│ ► ROW_NUMBER()      │  ← currently active (highlighted)
│   first. detection  │
└─────────────────────┘
```

Props:
```typescript
interface MappingNavigatorProps {
  mappings: TranslationMappings | null;
  activeMappingId: string | null;
  onSelect: (id: string) => void;
}
```

This navigator is rendered between the two editor panels in the `TranslationView` layout. Adjust CSS Grid in `TranslationView.css` to add a narrow centre column when mappings are present:

```css
.translation-view {
  display: grid;
  grid-template-columns: 1fr auto 1fr;  /* sas | navigator | hive */
}

.translation-view--no-mappings {
  grid-template-columns: 1fr 1fr;
}
```

---

## Interaction Flow

1. User pastes SAS code and clicks "Translate"
2. `mappings` is `null` — `MappingNavigator` hidden, layout is 2-column
3. Stream completes — `mappings` populated from JSON block in response
4. `MappingNavigator` appears; gutter markers appear on all mapped lines in both editors
5. User hovers a mapped line in either editor → Monaco hover provider shows plain-English tooltip, both editors highlight corresponding lines
6. User clicks a mapping in the navigator → both editors scroll to and highlight that mapping's lines, active item highlighted in navigator

---

## Graceful Degradation

If the LLM does not return a valid mapping JSON block (e.g., the code is too short to warrant mappings):
- `mappings` remains `null`
- Layout stays 2-column, no navigator rendered
- No error shown to user
- Hover providers are not registered (no stale disposables)

---

## Files to Create

- `packages/client/src/components/MappingNavigator.tsx`
- `packages/client/src/components/MappingNavigator.css`

## Files to Modify

- `packages/server/src/services/translation.ts` — extend `SYSTEM_PROMPT`, add `LineMapping` / `TranslationMappings` types, update `parseTranslationResponse()`
- `packages/client/src/App.tsx` — add `mappings`, `activeMappingId` state; extract mappings after stream; pass to `TranslationView`
- `packages/client/src/components/TranslationView.tsx` — add mapping props, Monaco `onMount` callbacks, decoration management, hover providers
- `packages/client/src/components/TranslationView.css` — update grid layout for navigator column
- `packages/client/src/api/client.ts` — export `LineMapping` / `TranslationMappings` types

---

## Acceptance Criteria

- [ ] LLM returns valid mapping JSON for non-trivial SAS inputs
- [ ] Gutter markers appear on all mapped lines in both editors after translation
- [ ] Hovering a mapped SAS line shows a tooltip with plain-English explanation and corresponding Hive line numbers
- [ ] Hovering a mapped Hive line shows tooltip with corresponding SAS line numbers
- [ ] Clicking a mapping in the navigator scrolls and highlights both editors synchronously
- [ ] Active mapping highlighted in navigator list
- [ ] Layout is 2-column when no mappings, 3-column (with navigator) when mappings present
- [ ] No crash or error when LLM returns no mapping JSON
- [ ] Mappings reset when a new translation starts
- [ ] No TypeScript or build errors
