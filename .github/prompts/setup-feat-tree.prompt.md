# Setup Prompt: Configure a Feature Worktree for Browser Testing

## Context

This project uses git worktrees for each feature prototype. Each worktree lives at
`.trees/feat-N/` and has its own `.env` file with dedicated ports. Use this prompt
to verify and fix a worktree so it can be started and tested in the browser.

---

## Step 1 — Confirm the worktree and its ports

Read the worktree's `.env` file (e.g. `.trees/feat-N/.env`). It should contain:

```
GITHUB_PAT=<token>
PORT=301N        # server port  (3011 for feat-1, 3012 for feat-2, etc.)
VITE_PORT=518N   # client port  (5181 for feat-1, 5182 for feat-2, etc.)
```

If the file is missing, create it with the correct ports from the Feature Index table
in `.github/copilot-instructions.md`.

---

## Step 2 — Fix `vite.config.ts` to read ports from `.env`

The default `vite.config.ts` has hardcoded ports (`5173` / `3001`).  
Replace it with the dynamic version below so each worktree uses its own port pair.

**File**: `packages/client/vite.config.ts` (inside the worktree)

```typescript
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load .env from the workspace root (two levels up from packages/client/)
  const env = loadEnv(mode, '../../', '');
  const clientPort = parseInt(env.VITE_PORT || '5173', 10);
  const serverPort = parseInt(env.PORT || '3001', 10);

  return {
    plugins: [react()],
    server: {
      port: clientPort,
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
```

---

## Step 3 — Verify TypeScript compiles

Run from inside the worktree root:

```bash
npx -w packages/server tsc --noEmit
npx -w packages/client tsc --noEmit
```

Both should exit with no errors. Fix any errors before proceeding.

---

## Step 4 — Start the dev servers

```bash
npm run dev
```

Expected output:
- `[0] Server running on http://localhost:301N`
- `[1] VITE vX.X.X  ready in Xms`  →  `Local: http://localhost:518N/`

Open `http://localhost:518N` in the browser to test.

---

## Notes

- The server reads `PORT` automatically via `dotenv` pointing to `.env` at the
  workspace root of the worktree (`.trees/feat-N/.env`).
- If the Vite port is already in use (e.g. a previous run still alive), Vite will
  bump to the next port. Kill old processes with `lsof -ti:518N | xargs kill` first.
- All other worktrees (`.trees/feat-1` through `.trees/feat-7`) can run simultaneously
  since each uses a unique port pair.
