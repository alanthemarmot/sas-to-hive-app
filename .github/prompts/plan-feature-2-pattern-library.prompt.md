# Plan: SAS Pattern Library — "Rosetta Stone" Reference

## Goal

Add a browsable, categorised library of ~30 common SAS patterns with pre-translated Hive equivalents and plain-English explanations. Users can explore familiar SAS constructs before committing their own production code, reducing "blank page" anxiety and building confidence in the tool.

**Target users:** SAS developers who want to see how their day-to-day patterns translate before pasting real scripts. Also useful as an onboarding reference for new team members.

---

## Data Structure

Define the pattern library as a static TypeScript constant — no server call needed, as the data is stable reference material.

Create **`packages/client/src/lib/pattern-library.ts`**:

```typescript
export interface SasPattern {
  id: string;
  category: string;
  title: string;
  description: string;           // Plain English, 1-2 sentences
  sasCode: string;               // SAS snippet
  hiveCode: string;              // Pre-translated HiveQL
  notes?: string;                // Optional gotchas / caveats
  tags: string[];
}

export const PATTERN_CATEGORIES = [
  'Sorting & Deduplication',
  'Aggregation & Summaries',
  'Merging & Joining',
  'Reshaping & Transposing',
  'Filtering & Subsetting',
  'Dates & Times',
  'String Functions',
  'Macros & Variables',
  'Missing Values',
  'Table Creation',
] as const;
```

Populate with ~30 patterns covering the full list of categories. Each pattern should be a concrete, runnable example (not abstract pseudocode). Examples:

```typescript
{
  id: 'sort-basic',
  category: 'Sorting & Deduplication',
  title: 'Sort a table by one column',
  description: 'Orders all rows in a dataset by a single column in ascending order.',
  sasCode: `PROC SORT DATA=work.sales OUT=work.sales_sorted;\n  BY region;\nRUN;`,
  hiveCode: `CREATE TABLE sales_sorted STORED AS ORC AS\nSELECT *\nFROM sales\nORDER BY region;`,
  tags: ['proc sort', 'order by'],
},
{
  id: 'sort-nodupkey',
  category: 'Sorting & Deduplication',
  title: 'Remove duplicate rows (NODUPKEY)',
  description: 'Keeps only the first row for each unique value of the BY variable — equivalent to deduplication.',
  sasCode: `PROC SORT DATA=work.customers NODUPKEY;\n  BY customer_id;\nRUN;`,
  hiveCode: `CREATE TABLE customers_deduped STORED AS ORC AS\nSELECT *\nFROM (\n  SELECT *,\n    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY customer_id) AS rn\n  FROM customers\n) t\nWHERE rn = 1;`,
  notes: 'The ORDER BY inside the window function determines which duplicate is kept. Adjust it to match your SAS sort order.',
  tags: ['proc sort', 'nodupkey', 'deduplication', 'row_number'],
},
```

---

## New Client Component

### `packages/client/src/components/PatternLibrary.tsx` + `PatternLibrary.css`

Props:
```typescript
interface PatternLibraryProps {
  onLoadPattern: (sasCode: string) => void;  // Loads SAS into the editor
  theme: 'dark' | 'light';
  isVisible: boolean;
  onClose: () => void;
}
```

### Layout

The library opens as a full-height slide-in panel from the left (replacing or overlaying the file browser sidebar), or as a modal — choose whichever fits the existing CSS Grid layout better.

```
┌────────────────────────────────────────────────────────┐
│  📖 SAS Pattern Library                           [×]  │
├───────────────┬────────────────────────────────────────┤
│ Categories    │  [ 🔍 Search patterns...            ]  │
│               ├────────────────────────────────────────┤
│ ▶ Sorting &   │  SORTING & DEDUPLICATION               │
│   Dedup  (4)  │                                        │
│ ▶ Aggregation │  ┌──────────────────────────────────┐  │
│ ▶ Merging     │  │ Sort by one column               │  │
│ ▶ Reshaping   │  │ Orders rows ascending by column  │  │
│ ▶ Filtering   │  │ [SAS]         [HiveQL]           │  │
│ ▶ Dates       │  │ PROC SORT...  SELECT * FROM...   │  │
│ ▶ Strings     │  │           [Load into Editor →]   │  │
│ ▶ Macros      │  └──────────────────────────────────┘  │
│ ▶ Missing Val │                                        │
│ ▶ Table Create│  ┌──────────────────────────────────┐  │
│               │  │ Remove duplicates (NODUPKEY)     │  │
│               │  │ ...                              │  │
│               │  └──────────────────────────────────┘  │
└───────────────┴────────────────────────────────────────┘
```

### Pattern Card

Each card shows:
- Title and plain-English description
- Two side-by-side code blocks (SAS left, Hive right) — read-only Monaco instances or `<pre><code>` with syntax highlighting via Prism/highlight.js (lighter than two full Monaco instances per card)
- Optional "Notes" callout box (amber, with ⚠️ icon) if `notes` is set
- "Load into Editor" button — calls `onLoadPattern(pattern.sasCode)` and closes the panel

### Search

Client-side filter across `title`, `description`, `tags`, and code content. Use a simple `useState` with `.filter()` — no external library needed.

### Category Navigation

Left sidebar with category names and counts. Clicking a category scrolls to that section (use `element.scrollIntoView()`). Active category highlighted.

---

## Integration in `App.tsx`

Add state:
```tsx
const [showPatternLibrary, setShowPatternLibrary] = useState(false);
```

When `onLoadPattern` fires:
```tsx
const handleLoadPattern = (sasCode: string) => {
  setSasCode(sasCode);
  setHiveSQL('');
  setExplanation('');
  setShowPatternLibrary(false);
  // Optionally show a toast: "Pattern loaded — click Translate to convert"
  addToast('success', 'Pattern loaded into editor');
};
```

---

## Toolbar Button

Add to `Toolbar.tsx`:
```tsx
<button
  className="toolbar-btn btn-secondary"
  onClick={onOpenPatternLibrary}
  title="Browse common SAS patterns"
>
  <BookOpen size={14} />
  Examples
</button>
```

Place before the separator, alongside the Translate button group.

---

## Syntax Highlighting in Cards

Use `<pre><code>` blocks with a lightweight highlighter rather than full Monaco instances to keep performance acceptable with 30+ cards on screen. Options:

1. **Prism.js** — add `prismjs` package to `packages/client/`, import `prism-sas` (or use plaintext for SAS) and `prism-sql` for Hive. Minimal bundle impact.
2. **highlight.js** — similar approach, slightly heavier.
3. **Monaco with `options={{ readOnly: true, minimap: { enabled: false }, lineNumbers: 'off', scrollbar: { vertical: 'hidden' } }}`** — reuse existing dependency, but use with care at scale.

Recommended: Prism.js. Add it to `packages/client/package.json` as a dependency.

---

## Complete Pattern List (30 patterns across 10 categories)

### Sorting & Deduplication (4)
1. Sort by one column
2. Sort by multiple columns
3. Remove duplicates — NODUPKEY (single key)
4. Remove duplicates — NODUPKEY (composite key)

### Aggregation & Summaries (4)
5. Count rows per group (PROC FREQ)
6. Sum and average per group (PROC MEANS)
7. Multiple statistics per group (PROC SUMMARY with OUTPUT)
8. Grand total with subtotals

### Merging & Joining (4)
9. Inner join (PROC SQL / DATA MERGE)
10. Left join
11. Anti-join (rows in A but not B)
12. Stack two tables (PROC APPEND / SET with multiple datasets)

### Reshaping & Transposing (2)
13. Pivot rows to columns (PROC TRANSPOSE)
14. Unpivot columns to rows

### Filtering & Subsetting (3)
15. Filter rows with WHERE
16. First/last row per group (first./last.)
17. Top N rows per group

### Dates & Times (3)
18. Date difference in days (INTCK)
19. Add days to a date (INTNX)
20. Extract year/month from a date (YEAR(), MONTH())

### String Functions (3)
21. Trim and concatenate (CATS, CATX)
22. Find and extract substring (SCAN, SUBSTR)
23. Replace characters (COMPRESS, TRANWRD)

### Macros & Variables (3)
24. Macro variable assignment and reference (%LET, &var)
25. Simple parameterised macro (%MACRO / %MEND)
26. Conditional macro logic (%IF / %THEN)

### Missing Values (2)
27. Test for missing value (MISSING(), IF x = .)
28. Replace missing with default (COALESCE logic)

### Table Creation (2)
29. Create a table from a query (DATA step / PROC SQL CREATE TABLE)
30. Create a table with explicit column types

---

## Files to Create

- `packages/client/src/lib/pattern-library.ts` — pattern data (all 30 entries)
- `packages/client/src/components/PatternLibrary.tsx`
- `packages/client/src/components/PatternLibrary.css`

## Files to Modify

- `packages/client/src/App.tsx` — add `showPatternLibrary` state, `handleLoadPattern`, render `<PatternLibrary>`
- `packages/client/src/components/Toolbar.tsx` — add "Examples" button with `BookOpen` icon
- `packages/client/package.json` — add `prismjs` and `@types/prismjs` dependencies

---

## Acceptance Criteria

- [ ] "Examples" toolbar button opens the pattern library panel
- [ ] All 10 categories are listed; clicking a category scrolls to that section
- [ ] Each card shows plain-English description, SAS code, Hive code side-by-side
- [ ] Patterns with notes display an amber callout box
- [ ] Search filters cards in real-time across title, description, and tags
- [ ] "Load into Editor" populates the SAS editor, clears previous translation output, and shows a toast
- [ ] Panel closes after loading a pattern
- [ ] Performance is acceptable with all cards rendered (no janky scroll)
- [ ] No TypeScript or build errors
