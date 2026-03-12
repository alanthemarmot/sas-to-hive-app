# Plan: Angular v18 Port → `angular-copy/`

**TL;DR**: The Express server is copied verbatim (single path fix). The Angular client is **built from scratch** — the React project is used as a functional spec and data reference only, never as code to translate line-by-line. This avoids React-flavoured Angular (prop drilling instead of DI, `useEffect`-style `ngOnInit`, etc.) and produces idiomatic Angular from day one. Both live in a self-contained `angular-copy/` npm workspace.

---

## Phase 0 — Workspace scaffold
1. Create `angular-copy/` with a root `package.json` (npm workspaces: `["server", "client"]`) and `.env.example`

## Phase 1 — Copy & adapt server
2. Copy `packages/server/` → `angular-copy/server/` (all files unchanged except one line)
3. In `server/src/index.ts`: change `dotenv.config({ path: '../../.env' })` → `dotenv.config({ path: '../.env' })`

## Phase 2 — Angular project scaffold
4. Generate Angular v18 app: `ng new client --routing --style=scss --no-standalone --strict` inside `angular-copy/`
5. Install client dependencies: `primeng@17 primeicons@7 primeflex@3 @ngx-translate/core @ngx-translate/http-loader ngx-monaco-editor-v2`
6. Update `angular.json`: PrimeNG CSS in styles array, i18n assets, `proxy.conf.json` pointing `/api` → `localhost:3001`

## Phase 3 — Core configuration
7. `AppModule`: import `TranslateModule.forRoot()` (HttpLoaderFactory), `MonacoEditorModule.forRoot()` (with `onMonacoLoad` hook to register the SAS Monarch tokenizer), `MessageService` provider
8. `AppRoutingModule`: lazy-load `TranslationModule` at path `''`
9. `styles.scss`: RDS CSS custom properties (`--accent: #005a5c`, surface scale, Segoe UI), PrimeNG theme overrides

## Phase 4 — Shared layer
10. `shared/model/types.ts` — `FileNode`, `HiveResultData`, `ToastMessage` interfaces
11. `shared/lib/sas-language.ts` — verbatim copy of `packages/client/src/lib/sas-language.ts`
12. `shared/services/api.service.ts` — `streamTranslation(): Observable<string>` (wraps native `fetch` + `ReadableStream` in `new Observable()`; parses SSE `data:` lines); `translateSasToHive()`
13. `shared/services/file.service.ts` — `HttpClient`-based calls for tree, content, upload
14. `shared/services/hive.service.ts` — `HttpClient` POST `/api/hive/execute`
15. `SharedModule` — exports `CommonModule`, `FormsModule`, `TranslateModule`, `MonacoEditorModule`, all PrimeNG modules used (Button, Dropdown, Table, Tree, Toast, Toolbar, Panel, FileUpload, ProgressSpinner, Splitter)

## Phase 5 — App shell
16. `AppComponent`: RDS teal banner header (title via translate), sidebar toggle button (PrimeIcon `pi-bars`), `<router-outlet>`

## Phase 6 — `TranslationModule` + root `TranslationComponent`
17. `TranslationComponent` (≈ `App.tsx`): holds all state (sasCode, hiveSQL, explanation, isTranslating, error, selectedModel, hiveResults, panel visibility flags); `handleTranslate()` subscribes to `streamTranslation()`, accumulates tokens, parses `<!-- EXPLANATION_START/END -->` markers with real-time updates

## Phase 7 — Feature sub-components *(parallel)*
18. **ToolbarComponent** — `p-toolbar`, `p-button` (with `p-progressSpinner` during streaming), `p-dropdown` for model selector; `@Input()`/`@Output()` bindings
19. **TranslationViewComponent** — two `<ngx-monaco-editor>` instances (SAS editable left, HiveQL read-only right); translating overlay; error banner; responsive flex-column at < 768px
20. **ExplanationPanelComponent** — collapsible panel; close `@Output()`
21. **HiveResultsComponent** — `p-table` with dynamic column array; close `@Output()`
22. **FileTreeComponent** — `p-tree`; `FileNode[]` → PrimeNG `TreeNode[]` converter; folder expand/collapse; file select → `FileService.fetchFileContent()` → `@Output() fileSelect`
23. **FileUploadComponent** — `p-fileupload` with `customUpload=true`, accept `.sas`, 5 MB limit; emit `@Output() fileLoaded`

## Phase 8 — i18n
24. `assets/i18n/en.json` — all user-visible text: toolbar button labels, placeholders, panel titles, error messages, toast messages, file tree labels

## Phase 9 — Workspace scripts
25. Root `package.json`: `dev`, `dev:server`, `dev:client`, `build` scripts using `concurrently` (`npm run dev` starts both)

---

## Decisions

| Concern | Choice |
|---|---|
| Angular version | v18, NgModules |
| UI library | PrimeNG v17 + PrimeIcons + PrimeFlex |
| Code editors | `ngx-monaco-editor-v2` |
| i18n | `@ngx-translate/core` + HttpLoader, `en.json` from day one |
| Design system | RDS v20 (brandteal tokens, Segoe UI, WCAG 2.1) |
| State management | Angular services + RxJS `BehaviorSubject`; `TranslationComponent` holds root state |
| SSE streaming | Native `fetch` + `ReadableStream` wrapped in RxJS `Observable` |
| Icons | PrimeIcons (`pi-*`) replaces `lucide-react` |
| File tree | `p-tree` + `FileNode[]` → `TreeNode[]` converter replaces `react-arborist` |
| Toast notifications | PrimeNG `p-toast` + `MessageService` replaces custom `Toast.tsx` |
| Backend | Express server copied verbatim, single `dotenv` path change |

---

## File tree — `angular-copy/`

```
angular-copy/
├── package.json                          ← npm workspace root (workspaces: ["server","client"])
├── .env.example                          ← GITHUB_PAT, PORT, HIVE_JDBC_URL placeholders
├── README.md
├── server/                               ← copy of packages/server/ (one path fix in index.ts)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                      ← dotenv({ path: '../.env' })
│       ├── routes/
│       │   ├── translate.ts
│       │   ├── files.ts
│       │   └── hive.ts
│       └── services/
│           ├── github-models.ts
│           ├── translation.ts
│           └── mock-files.ts
└── client/                               ← Angular v18 NgModule project
    ├── angular.json
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.app.json
    ├── proxy.conf.json                   ← /api/* → http://localhost:3001
    └── src/
        ├── main.ts
        ├── index.html
        ├── styles.scss                   ← RDS tokens, PrimeNG theme, Segoe UI
        └── app/
            ├── app.module.ts
            ├── app-routing.module.ts
            ├── app.component.ts
            ├── app.component.html
            ├── app.component.scss
            ├── features/
            │   └── translation/
            │       ├── translation.module.ts
            │       ├── translation.component.ts
            │       ├── translation.component.html
            │       ├── translation.component.scss
            │       └── components/
            │           ├── toolbar/
            │           │   ├── toolbar.component.ts
            │           │   ├── toolbar.component.html
            │           │   └── toolbar.component.scss
            │           ├── translation-view/
            │           │   ├── translation-view.component.ts
            │           │   ├── translation-view.component.html
            │           │   └── translation-view.component.scss
            │           ├── explanation-panel/
            │           │   ├── explanation-panel.component.ts
            │           │   ├── explanation-panel.component.html
            │           │   └── explanation-panel.component.scss
            │           ├── hive-results/
            │           │   ├── hive-results.component.ts
            │           │   ├── hive-results.component.html
            │           │   └── hive-results.component.scss
            │           ├── file-tree/
            │           │   ├── file-tree.component.ts
            │           │   ├── file-tree.component.html
            │           │   └── file-tree.component.scss
            │           └── file-upload/
            │               ├── file-upload.component.ts
            │               ├── file-upload.component.html
            │               └── file-upload.component.scss
            └── shared/
                ├── shared.module.ts
                ├── model/
                │   └── types.ts
                ├── lib/
                │   └── sas-language.ts   ← verbatim copy
                └── services/
                    ├── api.service.ts
                    ├── file.service.ts
                    └── hive.service.ts
```

---

## Source file mapping

Three distinct treatments — **copy**, **reference**, and **scratch**:

| React source | Treatment | Angular target / notes |
|---|---|---|
| `packages/server/src/**` | **Copy verbatim** | `angular-copy/server/src/**` (one `dotenv` path fix only) |
| `packages/client/src/lib/sas-language.ts` | **Copy verbatim** | `client/src/app/shared/lib/sas-language.ts` — pure TypeScript/Monaco, zero React |
| `services/translation.ts` → `SYSTEM_PROMPT` | **Copy verbatim** | Paste the string constant only into the server copy |
| `services/mock-files.ts` → `FILE_CONTENTS` | **Copy verbatim** | Data only; no logic changes needed |
| `packages/client/src/api/client.ts` | **Reference** | Understand the SSE `[DONE]` / marker edge cases, then write `ApiService` in RxJS `Observable` style |
| `packages/client/src/App.tsx` | **Reference** | Use as functional spec for `TranslationComponent` state shape and handler contracts — do not translate JSX |
| `packages/client/src/components/Toolbar.tsx` | **Scratch** | `ToolbarComponent` with `@Input`/`@Output` + PrimeNG `p-toolbar`, `p-button`, `p-dropdown` |
| `packages/client/src/components/TranslationView.tsx` | **Scratch** | `TranslationViewComponent` with `ngx-monaco-editor-v2` dual-pane |
| `packages/client/src/components/ExplanationPanel.tsx` | **Scratch** | `ExplanationPanelComponent` with PrimeNG `p-panel` |
| `packages/client/src/components/HiveResults.tsx` | **Scratch** | `HiveResultsComponent` with PrimeNG `p-table` (dynamic columns) |
| `packages/client/src/components/FileTree.tsx` | **Scratch** | `FileTreeComponent` with PrimeNG `p-tree` + `FileNode[]` → `TreeNode[]` converter |
| `packages/client/src/components/FileUpload.tsx` | **Scratch** | `FileUploadComponent` with PrimeNG `p-fileupload` / drag-drop |
| `packages/client/src/components/Toast.tsx` | **Scratch (replaced)** | No custom component — PrimeNG `p-toast` + `MessageService` |

> **Rule for the agent**: never be told "translate this component". Instructions should always say "build this component to this contract" and point at the React source only for the API shape and UX behaviour.

---

## Verification checklist

1. `cd angular-copy && npm install` — clean install, no errors
2. `npm run dev` — server starts on `:3001`, Angular CLI on `:4200`
3. `curl localhost:3001/api/health` → `{"status":"ok"}`
4. Open `http://localhost:4200` — RDS teal header, Segoe UI font, PrimeNG components visible
5. Paste SAS code → click Translate → tokens stream into Monaco right pane in real time
6. Explanation panel appears below editors; close button dismisses it
7. File tree sidebar shows mock repo structure via `p-tree`; clicking a file loads it into the SAS editor
8. Drag a `.sas` file onto the upload zone → populates the SAS editor; toast notification appears
9. Click Execute on Hive → `p-table` with mock rows appears
10. Click Copy → clipboard contains HiveQL; Click Download → `translated.hql` file downloads
11. All visible text sourced from `assets/i18n/en.json` (no hardcoded strings in templates)
12. `p-toast` notifications appear for success/error events

---

## Notes & gotchas

1. **`ngx-monaco-editor-v2` assets** — requires `monaco-editor` worker assets copied via `angular.json` assets glob. Must be configured precisely or Monaco will 404 at runtime.
2. **PrimeNG v17 theme vs RDS** — `lara-light-teal` is the closest built-in theme; override `--primary-color` to `#005a5c` in `styles.scss` to exactly match the RDS brandteal token.
3. **`concurrently`** — install at workspace root (`npm install -D concurrently` in `angular-copy/`), not inside `server/` or `client/`.
4. **`p-tree` vs `FileNode`** — PrimeNG `TreeNode` type (`{ label, data, icon, expandedIcon, children }`) differs from our `FileNode` — a converter helper is needed inside `FileTreeComponent`.
5. **SSE POST streaming** — standard `EventSource` only supports GET; use `fetch` + `ReadableStream` wrapped in a plain RxJS `Observable` to parse the `data:` SSE lines from a POST endpoint.
6. **`.env` location** — lived at workspace root (`sas-to-hive-app/.env`); in `angular-copy/` it lives one level up from `server/`, so `dotenv.config({ path: '../.env' })` in `server/src/index.ts` is correct.
