# Plan: Feature 7 — View Mode Switcher

## Goal

Add a three-tab **view mode switcher** to the translation UI that lets users control how
much screen space each editor panel occupies. The two Monaco editor panels smoothly
resize with a CSS transition when the user switches modes. The sidebar remains visible
in all three modes.

**Target users:** Power users who want to focus on one side of the translation — e.g.
read a large SAS script without the Hive pane in the way, or review the full translated
SQL without the SAS pane taking up half the screen.

---

## The Three Modes

| Tab label | SAS panel | Hive/SQL panel | Description |
|---|---|---|---|
| **SAS View** | `flex: 4` (dominant) | `flex: 1` (narrow strip, partially visible) | Focus on SAS code; Hive pane peeks in from the right |
| **Dual View** | `flex: 1` | `flex: 1` | Equal 50/50 split — the current default |
| **Hive/SQL View** | `flex: 1` (narrow strip, partially visible) | `flex: 4` (dominant) | Focus on Hive output; SAS pane peeks in from the left |

The `flex: 4` / `flex: 1` ratio gives the dominant panel ~80% of the available width,
leaving the recessive panel visible as a narrow strip (~20%) so the user can see that
content still exists and can switch back.

---

## Architecture

### State

Add `viewMode` state to `App.tsx`:

```typescript
type ViewMode = 'sas' | 'dual' | 'hive';
const [viewMode, setViewMode] = useState<ViewMode>('dual');
```

Persist the last-used mode in `localStorage` (key: `sas-hive-view-mode`) so it
survives page refresh.

### New Component: `ViewModeBar`

Create `packages/client/src/components/ViewModeBar.tsx` + `ViewModeBar.css`.

A slim bar (32px tall) rendered between the `Toolbar` and the `TranslationView` in
`App.tsx`. Contains three tab buttons.

```tsx
interface ViewModeBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}
```

**Tab buttons** — each has an icon + label:
- 🗂 **SAS View** — icon: `PanelRight` (lucide)
- ⚖ **Dual View** — icon: `Columns2` (lucide)
- 🗂 **Hive/SQL View** — icon: `PanelLeft` (lucide)

The active tab has a bottom-border highlight using `var(--accent)` and slightly brighter
text; inactive tabs use `var(--text-secondary)`.

### Changes to `TranslationView`

Add a `viewMode` prop:

```typescript
interface TranslationViewProps {
  // ... existing props
  viewMode: 'sas' | 'dual' | 'hive';
}
```

Apply a CSS class to each `.editor-panel` based on `viewMode`:

| viewMode | SAS panel class | Hive panel class |
|---|---|---|
| `'sas'` | `editor-panel--dominant` | `editor-panel--recessive` |
| `'dual'` | _(neither)_ | _(neither)_ |
| `'hive'` | `editor-panel--recessive` | `editor-panel--dominant` |

CSS in `TranslationView.css`:

```css
.editor-panel {
  flex: 1;
  /* existing styles... */
  transition: flex 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.editor-panel--dominant {
  flex: 4;
}

.editor-panel--recessive {
  flex: 1;
  min-width: 160px; /* always show at least a sliver */
}
```

The `transition: flex` on `.editor-panel` is what creates the smooth slide animation
between modes. Because both panels are flex children of the same container, animating
`flex-grow` causes them to resize smoothly together.

**Note:** `automaticLayout: true` is already set on both Monaco editor instances, so
the editors will reflow to their new dimensions automatically as the panels resize.

---

## Files to Create / Modify

| File | Change |
|---|---|
| `packages/client/src/components/ViewModeBar.tsx` | **New** — tab bar component |
| `packages/client/src/components/ViewModeBar.css` | **New** — styles for tab bar |
| `packages/client/src/components/TranslationView.tsx` | Add `viewMode` prop; apply conditional CSS classes to `.editor-panel` divs |
| `packages/client/src/components/TranslationView.css` | Add `transition: flex` + `--dominant` / `--recessive` modifier classes |
| `packages/client/src/App.tsx` | Add `viewMode` state + localStorage persistence; render `<ViewModeBar>`; pass `viewMode` to `<TranslationView>` |

---

## Worktree Setup

```bash
# From: /Users/alan/Documents/workspace/sas-to-hive-app (main)
git worktree add ../sas-hive-feat-7 -b feature/view-modes
cd ../sas-hive-feat-7
npm install
```

`.env` for the worktree (port 3017 / 5187):
```
GITHUB_PAT=github_pat_xxxxx
PORT=3017
VITE_PORT=5187
```

Start: `npm run dev` → http://localhost:5187

---

## Demo Script

When demoing this feature:

1. Open the app at http://localhost:5187 with a translated SAS/Hive pair already loaded
   (paste any sample from the file browser and click Translate).
2. Click **SAS View** — watch the SAS panel smoothly expand to fill ~80% of the screen.
   The Hive panel is still visible as a narrow strip on the right.
3. Click **Dual View** — both panels slide back to equal width.
4. Click **Hive/SQL View** — the Hive panel expands; the SAS pane slides to a narrow
   strip on the left.
5. Refresh the page — the last-used view mode is restored from localStorage.

---

## Verification Checklist

- [ ] Three tabs render correctly in both dark and light themes
- [ ] Active tab has visible highlight (bottom border + brighter text)
- [ ] Transitions are smooth (~350ms) with no jank
- [ ] Monaco editors reflow correctly after resize (no clipped content, no scroll bars appearing incorrectly)
- [ ] `min-width: 160px` prevents the recessive panel from disappearing entirely on narrow screens
- [ ] View mode persists across page refresh
- [ ] `tsc --noEmit` passes on both server and client with no new errors
- [ ] Sidebar toggle still works correctly in all three view modes
- [ ] Mobile breakpoint (≤768px): view mode bar is hidden or stacked; panels go vertical as before (no regression)

---

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Placement** | Separate `ViewModeBar` row below the Toolbar | Keeps Toolbar clean; tabs need their own visual weight |
| **Ratios** | 4:1 (not fixed px) | Proportional ratios adapt to any window width; sidebar open/close doesn't break the layout |
| **Animation** | `transition: flex` | Native CSS; no JS animation loop; respects `prefers-reduced-motion` if we add that later |
| **Recessive min-width** | 160px | Enough to see the panel header label; signals to the user the panel still exists and is switchable |
| **Persistence** | localStorage | Lightweight; consistent with how theme preference is stored in this app |
| **Lucide icons** | `PanelRight`, `Columns2`, `PanelLeft` | Already a dependency; visually communicates the layout each mode produces |
