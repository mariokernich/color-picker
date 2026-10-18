# Handoff: Next Steps to Store Release

This document is written for the next developer or AI assistant working on this repository on a
local Mac or Windows machine. Read it together with [`CLAUDE.md`](../CLAUDE.md),
[`README.md`](../README.md) and [`docs/STORE.md`](STORE.md).

Legend: 🧑 = needs the owner (accounts, money, legal decisions) · 🤖 = an assistant can do it.

## 1. Current state

**Done** (on `main`):

- Electron 44 + React 19 + TypeScript menu bar / tray app for macOS and Windows.
- Screen picker with loupe on every display, history, palettes (drag & drop, export), color editor
  with 17 copy formats, WCAG contrast checker, settings (shortcuts, theme, tray action, login item).
- Business model: **paid app, one-time purchase of 9.99 USD / 9.99 EUR** in the Mac App Store and
  the Microsoft Store. No in-app purchases, no subscription, no trial, no license code in the app.
- electron-builder targets: `mas`, `mas-dev`, `appx` (store) and `dmg`, `nsis` (testing only).
- Icons are generated from code: `npm run icons` (`scripts/generate-icons.mjs`).
- 60 unit tests (Vitest), typecheck and build are green. CI: `.github/workflows/ci.yml`.

**Verified only in a Linux container (Xvfb):** app start, popover, picker overlay, pixel-exact
picking, persistence. **Never run on real macOS or Windows yet.** Expect platform issues in step 2.

## 2. Verify on real hardware (🤖 with 🧑 clicking)

```bash
npm install          # .npmrc sets legacy-peer-deps (works around an npm resolver crash)
npm run dev
```

macOS checklist:

- [ ] Menu bar icon appears (template image, adapts to light/dark menu bar), no Dock icon.
- [ ] First "Pick Color" triggers the Screen Recording permission prompt. After granting (the app
      may need a restart), other apps' windows are visible in the picker, not only the wallpaper.
- [ ] If permission is denied, the popover shows the "Screen access needed" banner and the button
      opens System Settings.
- [ ] Overlay covers the menu bar and Dock, also on a second display and over full-screen apps.
- [ ] **Color accuracy:** compare picked values with *Digital Color Meter* set to "Display in sRGB",
      on a P3 (Retina) display. If they differ, the capture is not in sRGB. Then look at color space
      handling in `src/main/picker.ts` (`desktopCapturer` thumbnail) before release.
- [ ] Global shortcut (default ⌘⌥⇧C) works from other apps. Shortcut recorder in Settings works.
- [ ] Clicking the tray icon while the popover is open closes it (no flicker/reopen).
- [ ] Export dialog keeps the popover open and writes the file.

Windows checklist:

- [ ] Tray icon switches between `tray-light`/`tray-dark` with the taskbar theme.
- [ ] Popover opens above the tray icon (also with taskbar on top/left/right).
- [ ] Overlay covers the taskbar on all monitors, including mixed DPI (100 % + 150 %).
- [ ] Global shortcut (default Ctrl+Alt+Shift+C) works.

Fix whatever fails on a `fix/*` branch, keep commits small, run `npm run typecheck && npm test`.

## 3. Decide the name (🧑, blocks store records)

"Color Picker" is generic and almost certainly taken in both stores (and not protectable).
Pick a distinctive name, check availability in App Store Connect and Partner Center, then 🤖
replace it everywhere:

- `src/shared/product.ts` (`PRODUCT.name`), `package.json` (`productName`),
  `electron-builder.yml` (`productName`, `nsis.shortcutName`, `appx.displayName`),
  `README.md`, `docs/*`, UI strings that mention the name (search for `Color Picker`).
- Keep the bundle ID `de.kernich.colorpicker` unless the owner wants a new one. It cannot be
  changed after the first App Store upload.

## 4. Public privacy policy & support URL (🧑 decides, 🤖 implements) — **blocker**

Both stores require a **publicly reachable** privacy policy URL and support URL. The repository is
**private**, so the current `PRODUCT.privacyUrl`
(`github.com/mariokernich/color-picker/blob/main/docs/PRIVACY.md`) is not reachable.

Options: publish `docs/PRIVACY.md` on an own website (for example kernich.de/color-picker/privacy)
or a small public GitHub Pages repo. Then update `PRODUCT.privacyUrl` in `src/shared/product.ts`.
A German imprint (Impressum) on the support page is advisable for sales in Germany.

## 5. Mac App Store submission

### 5.1 Accounts & legal (🧑)

- [ ] Apple Developer Program (99 USD/year) on the owner's account.
- [ ] App Store Connect → Business: accept the **Paid Apps Agreement**, fill in tax forms and bank
      account. Paid apps cannot go on sale before this is complete.
- [ ] Enrol in the **App Store Small Business Program** (15 % instead of 30 % commission).

### 5.2 Certificates, profiles, entitlements (🧑 creates in the portal, 🤖 wires up)

- [ ] App ID `de.kernich.colorpicker` (Certificates, Identifiers & Profiles).
- [ ] Certificates in the login keychain: *Apple Distribution*, *Mac Installer Distribution*,
      and *Apple Development* for local testing.
- [ ] Provisioning profiles: *Mac App Store* → `build/embedded.provisionprofile`,
      *macOS App Development* → `build/development.provisionprofile` (both git-ignored).
- [ ] 🤖 Add `com.apple.application-identifier`, `com.apple.developer.team-identifier` and
      `com.apple.security.application-groups` (`TEAMID.de.kernich.colorpicker`) to
      `build/entitlements.mas.plist`, see `docs/STORE.md`. Electron does not start in the sandbox
      without the application group.

### 5.3 Test the sandboxed build (🤖)

```bash
npm run dist:mas-dev     # signed with the development profile
```

Run the app from `dist/mas-dev-universal/`. Check: starts, menu bar icon, picker + permission
prompt, export via save dialog (sandbox file access), settings persist, "Open at login" works
(`type: 'mainAppService'` in `src/main/index.ts`).

### 5.4 App Store Connect record (🧑 with 🤖 preparing texts)

- [ ] New macOS app: name, primary language English (add German), bundle ID, SKU.
- [ ] Category *Graphics & Design* (secondary: *Developer Tools*).
- [ ] **Pricing:** base price 9.99 USD, then explicitly set the EUR price to 9.99 €.
- [ ] App Privacy: **Data Not Collected**. Privacy policy URL from step 4.
- [ ] Age rating questionnaire (all "None" → 4+).
- [ ] 🤖 Description, subtitle, keywords, promotional text in EN and DE.
- [ ] 🤖 Screenshots in 2880×1800 (or 1440×900/2560×1600): picker loupe, popover with history and
      palettes, color editor, contrast checker. Take them on the real Mac (step 2), not from the
      Linux container.
- [ ] Support URL and marketing URL.

### 5.5 Build, upload, review (🤖 builds, 🧑 submits)

```bash
npm run dist:mas         # dist/mas-universal/<name>-<version>.pkg
```

- Bump `version` in `package.json` for every upload. Each upload needs a unique, increasing build
  number (set `buildVersion` in `electron-builder.yml` if you upload several builds per version).
- Upload with **Transporter** (Mac App Store app), select the build in the version, add the review
  notes from `docs/STORE.md` and submit.
- Common rejection reasons to pre-empt: missing explanation of Screen Recording use, unreachable
  privacy URL, Electron helper not signed correctly, app does nothing without a Dock icon (the
  review note explains the menu bar icon).

## 6. Microsoft Store submission

### 6.1 Account (🧑)

- [ ] Partner Center developer account (individual or company; check the current registration fee).
- [ ] Payout and tax profile completed (required for paid apps).

### 6.2 Product setup (🧑 in Partner Center, 🤖 wires up)

- [ ] Reserve the app name from step 3.
- [ ] Product identity → 🤖 put *Package/Identity/Name*, *Publisher* and *Publisher display name*
      into `appx.identityName`, `appx.publisher`, `appx.publisherDisplayName` in
      `electron-builder.yml` (currently `TODO` placeholders).
- [ ] **Pricing and availability:** base price 9.99 USD, check the EUR price is 9.99 €,
      free trial: *No free trial*.
- [ ] Properties: category *Productivity* or *Developer tools*, privacy policy URL (step 4).
- [ ] Age ratings: IARC questionnaire.
- [ ] Store listing EN + DE, screenshots (at least 1366×768) from a real Windows machine.

### 6.3 Build & submit (🤖 on Windows with the Windows SDK)

```bash
npm run dist:appx
```

- For a local test install the package must be signed with a test certificate (or install the
  unpacked build). The Store re-signs the uploaded package itself.
- Electron packages declare the restricted capability **`runFullTrust`**. Partner Center asks for a
  justification: "Desktop (Win32) app packaged with the Desktop Bridge; needs full trust to capture
  the screen for the color picker and register global shortcuts."
- Optional: "Open at login" in Store builds needs `appx.addAutoLaunchExtension: true` (StartupTask).
  The setting is currently hidden for Store builds (`supportsLoginItem` in `src/main/index.ts`).

## 7. Repository housekeeping (🧑 / 🤖)

- [ ] 🧑 GitHub → Settings → Branches: set the default branch to `main`, then delete
      `feat/color-picker-app` (it is identical to an older state of `main`).
- [ ] 🤖 Optional: ESLint + Prettier scripts (a `.prettierrc` exists, no lint script yet).
- [ ] 🤖 Optional: German UI localization (the UI is English only; store listings can still be DE).

## 8. Known gaps & ideas (not required for v1)

- `dist:mac` / `dist:win` builds have no purchase check: never publish them.
- Free trial is not possible for paid apps in the Mac App Store. Microsoft supports trials for
  paid apps, but that would need license checks via `Windows.Services.Store` (native code).
- Ideas: color blindness simulation, palette import (ASE/JSON), "send to app" integrations,
  iCloud sync of palettes, Apple Shortcuts / URL scheme.
