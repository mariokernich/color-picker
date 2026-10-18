# CLAUDE.md

ChipDeck: a menu bar / tray color picker for macOS and Windows (Electron + React + TypeScript),
sold as a paid app (9.99 one-time) in the Mac App Store and the Microsoft Store.

**Start here:** [docs/HANDOFF.md](docs/HANDOFF.md) lists the current state and the next steps to
the store release. [README.md](README.md) explains the architecture; [docs/STORE.md](docs/STORE.md)
the store setup.

## Commands

```bash
npm install            # .npmrc sets legacy-peer-deps
npm run dev            # Electron with hot reload
npm run typecheck      # main + renderer
npm test               # Vitest unit tests (src/**/*.test.ts)
npm run build          # electron-vite build to out/
npm run icons          # regenerate all icons
npm run dist:mas | dist:mas-dev | dist:appx   # store packages
```

Run `npm run typecheck && npm test` before every commit.

Every push to `main` runs CI, builds release packages into a **draft** GitHub release and, for
changes in `site/`, deploys the website. Never publish release drafts or DMG/EXE builds: the app is
paid and the packages contain no purchase check.

## Architecture in one paragraph

`src/shared` holds pure, tested logic (color math, formats, contrast, the state reducer, export).
The main process (`src/main`) owns the state (`store.ts` + `shared/state.ts` reducer), the tray,
the popover window, global shortcuts and the picker (`picker.ts`: capture every display with
`desktopCapturer`, show full-screen overlays with a loupe). Renderers talk to main only through the
typed, sandboxed preload bridges (`src/preload`, types in `src/shared/api.ts`). The popover UI is
React (`src/renderer/src`), the picker overlay is plain TypeScript + canvas
(`src/renderer/src/picker`). In a plain browser the renderer falls back to an in-memory mock API
(`lib/mockApi.ts`) for UI work.

## Conventions

- Code, comments, docs and commit messages in **English**. Chat with the owner in German.
- Branches `feat/*` or `fix/*`, never `claude/*`. Small, focused commits.
- Git author is always the owner: `Mario Kernich <mario@kernich.de>`. No AI co-author trailers.
- Keep the existing style: 2-space indent, single quotes, no semicolons, 100 columns
  (`.prettierrc`), named exports, comments only where the "why" is not obvious.
- Add or update unit tests for changes in `src/shared` and other pure logic.
- New state changes go through an `Action` in `src/shared/state.ts`, never ad hoc in windows.
- Windows run with `sandbox` + `contextIsolation`; do not enable `nodeIntegration`.
- Challenge instructions that contradict best practices, and ask when requirements are unclear.
