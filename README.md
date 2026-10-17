# Color Picker

A fast, unobtrusive color picker for **macOS** and **Windows**. It lives in the menu bar / system tray,
picks any pixel on any screen with a magnifying loupe, keeps a history, organizes palettes and
copies colors in the format you need.

![Popover, palette, color editor and contrast checker](docs/screenshots/overview.png)

## Features

- **Picker with loupe**: global shortcut, pixel-precise loupe, arrow keys for 1 px / 10 px steps,
  `+`/`-` to resize, `Alt` `+`/`-` (or the scroll wheel) to zoom, `Shift`-click to pick several colors in one go.
  Works across multiple displays and HiDPI screens.
- **History & palettes**: every pick lands in the history and is copied to the clipboard. Palettes
  can collect picked colors automatically, and colors can be dragged between them (hold `Alt` to copy).
  Palettes export as JSON, CSS and SCSS variables, a Tailwind config or a GIMP/Inkscape palette.
- **Color panel**: saturation/brightness area, hue and opacity sliders, RGB/HSL/HSB inputs, names and
  17 copy formats (CSS Hex/RGB/HSL/OKLCH, SwiftUI, UIColor, NSColor, Android XML/Compose, Flutter,
  .NET, Java, Unity, OpenGL, …).
- **Contrast checker**: WCAG 2 ratio with AA/AAA results for normal text, large text and UI components.
- Light and dark mode, native vibrancy on macOS, customizable shortcuts, open at login.
- **Monetization**: yearly subscription with a free trial through the Mac App Store and the
  Microsoft Store. See [docs/STORE.md](docs/STORE.md).

<p align="center"><img src="docs/screenshots/picker.png" width="420" alt="Picker loupe"></p>

## Development

Requirements: Node.js 22+, npm 10+.

```bash
npm install
npm run dev        # starts Electron with hot reload
npm test           # unit tests (Vitest)
npm run typecheck
```

The UI can also be opened in a plain browser with an in-memory mock of the Electron bridge, which is
handy for design work: run `npm run dev` and open the renderer URL printed by electron-vite. Query
parameters such as `?route=settings`, `?license=expired` or `?platform=win32` switch views and states.

Test the subscription states without store accounts:

```bash
COLOR_PICKER_LICENSE=expired npm run dev   # trial | active | expired | none
```

In development builds the "Subscribe" button simulates a purchase.

### Packaging

| Command              | Output                                          | Run on  |
| -------------------- | ----------------------------------------------- | ------- |
| `npm run dist:mac`   | Universal DMG + ZIP (direct download)           | macOS   |
| `npm run dist:mas`   | Mac App Store package (`.pkg`)                  | macOS   |
| `npm run dist:win`   | NSIS installer, x64 + arm64 (direct download)   | Windows |
| `npm run dist:appx`  | Microsoft Store package (`.appx`)               | Windows |
| `npm run icons`      | Regenerates all icons from `scripts/generate-icons.mjs` | any |

Signing, store identifiers and the release checklist are described in [docs/STORE.md](docs/STORE.md).

## Architecture

```
src/
  shared/     Pure TypeScript used by every process: color math, formats, contrast,
              state reducer, export, product configuration (unit tested)
  main/       Electron main process
    index.ts      App lifecycle, IPC, wiring
    store.ts      JSON persistence of the state in the user data folder
    picker.ts     Screen capture and full-screen overlay windows per display
    windows.ts    Popover window and its placement next to the tray icon
    tray.ts       Menu bar / tray icon and context menu
    shortcuts.ts  Global shortcuts
    license/      Trial and store subscriptions (Mac App Store, Microsoft Store, local)
  preload/    Typed, sandboxed bridges (`window.api`, `window.picker`)
  renderer/   React UI for the popover and a lightweight canvas UI for the picker overlay
```

- The **main process owns the state**. Windows send actions (`src/shared/state.ts`) and receive
  snapshots, so the reducer is the single place where data changes and can be tested in isolation.
- **Picking** captures every display at its native resolution (`desktopCapturer`), then covers each
  display with an overlay showing the frozen capture and the loupe. Reading pixels from the capture
  gives exact values and behaves identically on macOS and Windows. On macOS this requires the
  *Screen & System Audio Recording* permission, which the app explains when it is missing.
- All windows run with `sandbox`, `contextIsolation` and a strict Content Security Policy.

## License

Proprietary. © Mario Kernich. All rights reserved.
