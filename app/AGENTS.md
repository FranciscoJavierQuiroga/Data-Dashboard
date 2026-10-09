# AGENTS.md

## Developer Commands

- **Start dev server** (port 3000): `npm run dev`
- **Build for production**: `npm run build`
- **Preview production build locally** (serves `dist/` for testing): `npm run preview`
- **Deploy to GitHub Pages**: `npm run deploy` (runs `predeploy` → `build` → `gh-pages -d dist`)
- **Lint**: `npm run lint`
- **Run tests**: `npm run test:run` (single run; `npm run test` = watch mode)
- **Coverage report**: `npm run test:coverage` (report only — no threshold enforced)

## Critical Build & Path Quirks

- **Base path is hardcoded to `/Data-Dashboard/`** in `vite.config.ts`. All fetched assets and `BrowserRouter` use this prefix. Do not change without updating both `vite.config.ts` and the router.
- **Data comes from 9 static JSON files** in `public/data/`. These are fetched at runtime (not bundled). Use `import.meta.env.BASE_URL` as the prefix. Do not move them out of `public/`.
- **TypeScript is strict** (`noUnusedLocals`, `noUnusedParameters` in `tsconfig.app.json`). Build will fail on unused variables.

## Testing

- **Runner**: Vitest + Testing Library (jsdom). Config in `vitest.config.ts`, setup/stubs in `vitest.setup.ts` (ResizeObserver, matchMedia, getBBox, pointer events).
- **Test files live next to sources**: `src/**/*.{test,spec}.{ts,tsx}`; JSON contract tests in `src/test/contracts/`; shared fixtures in `src/test/fixtures/dashboardData.ts` (`realData()`, `withEmpty()`, `override()`).
- **Characterization tests**: bugs are intentionally frozen under `describe('BUG CONOCIDO: ...')`. Do not "fix" a test without fixing the component first — the suite documents current behavior.
- **Vitest always sets `import.meta.env.BASE_URL = "/"`**; the `/Data-Dashboard/` base from `vite.config.ts` does not apply in tests.
- **jsdom limits**: recharts renders no visible text (zero-size container) — never assert chart internals/legends; Radix Select options with month badges have accessible names like `"Sanitas Mar"` (match with `^opcion` regex); `shadcn/Progress` drops `value`, so bars are always `data-state="indeterminate"`.

## Component & Style Conventions

- **UI components**: Place or import all shadcn/ui components from `@/components/ui/`. Existing components (Button, Card, Table, etc.) are already available there.
- **Styling**: Tailwind CSS utility-first. Theme uses shadcn's slate color scale with `text-emerald-600`, `bg-slate-50`, etc.
- **Icons**: Use `lucide-react`.

## Entrypoints

- **Main**: `src/main.tsx` (renders `App.tsx` with `BrowserRouter`)
- **Data Loading**: `src/hooks/useData.ts` fetches the 9 JSON datasets asynchronously.
- **Viz library**: `recharts` is used for all charts.
