# AGENTS.md

## Developer Commands

- **Start dev server** (port 3000): `npm run dev`
- **Build for production**: `npm run build`
- **Preview production build locally** (serves `dist/` for testing): `npm run preview`
- **Deploy to GitHub Pages**: `npm run deploy` (runs `predeploy` → `build` → `gh-pages -d dist`)
- **Lint**: `npm run lint`

## Critical Build & Path Quirks

- **Base path is hardcoded to `/Data-Dashboard/`** in `vite.config.ts`. All fetched assets and `BrowserRouter` use this prefix. Do not change without updating both `vite.config.ts` and the router.
- **Data comes from 7 static JSON files** in `public/data/`. These are fetched at runtime (not bundled). Use `import.meta.env.BASE_URL` as the prefix. Do not move them out of `public/`.
- **TypeScript is strict** (`noUnusedLocals`, `noUnusedParameters` in `tsconfig.app.json`). Build will fail on unused variables.
- **No test runner** is configured in this repo. There is no `test` script.

## Component & Style Conventions

- **UI components**: Place or import all shadcn/ui components from `@/components/ui/`. Existing components (Button, Card, Table, etc.) are already available there.
- **Styling**: Tailwind CSS utility-first. Theme uses shadcn's slate color scale with `text-emerald-600`, `bg-slate-50`, etc.
- **Icons**: Use `lucide-react`.

## Entrypoints

- **Main**: `src/main.tsx` (renders `App.tsx` with `BrowserRouter`)
- **Data Loading**: `src/hooks/useData.ts` fetches the 7 JSON datasets asynchronously.
- **Viz library**: `recharts` is used for all charts.
