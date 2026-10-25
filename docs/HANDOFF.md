# Handoff: Current State & Next Steps

_Last updated: 2026-10-25_

This document is for the next developer or AI assistant working on this repository on a local Mac
or Windows machine. Read it together with [`CLAUDE.md`](../CLAUDE.md) (conventions),
[`README.md`](../README.md) (architecture) and [`docs/STORE.md`](STORE.md) (store setup).

Legend: 🧑 = needs the owner (accounts, money, legal decisions) · 🤖 = an assistant can do it ·
🌐 = an assistant with browser access (e.g. Claude in Chrome) can do it in the owner's signed-in
browser, with the owner confirming.

## 0. Status: `v0.1.4` released, Mac App Store review pending (2026-10-25)

- **GitHub:** `v0.1.4` (new icon) is public and marked "Latest":
  https://github.com/mariokernich/color-picker/releases/tag/v0.1.4.
- **Mac App Store:** version 0.1.4 (build 0.1.4, universal, with the new icon) was submitted on
  2026-10-25 and is *Waiting for Review*, with **manual release**. It replaced 0.1.3, which was
  taken out of review for the new icon. After approval, 🧑 releases it in App Store Connect
  (Distribution → macOS App → *Release This Version*). Then 🤖 replaces the "Coming soon" button
  on the website (section 7). If Apple rejects it, read the message in App Store Connect →
  App Review, fix it on a `fix/*` branch, bump the version and upload again (5.5).

How a public GitHub release is made; repeat it for the next version:

1. **Hardware check** with `npm install && npm run dev` for whatever changed (section 2).
   `npm install` builds the native sampler (needs the Xcode Command Line Tools; without them it
   only warns and the picker freezes the screen).
2. **Signed macOS build** on `main` (Developer ID key is in the owner's login keychain, App Store
   Connect API key in `~/.appstoreconnect/private_keys/`; use the key with the *Developer* role,
   key ID and issuer ID are on App Store Connect → Users and Access → Integrations →
   App Store Connect API):
   ```bash
   git checkout main && git pull
   npm ci
   APPLE_API_KEY=~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8 \
   APPLE_API_KEY_ID=<KEYID> APPLE_API_ISSUER=<issuer id> \
   npm run dist:mac-release
   xcrun notarytool submit dist/ChipDeck-<version>.dmg --key <p8> --key-id <KEYID> --issuer <issuer id> --wait
   xcrun stapler staple dist/ChipDeck-<version>.dmg
   spctl -a -vvv -t open --context context:primary-signature dist/ChipDeck-<version>.dmg
   ```
   `spctl` must report "Notarized Developer ID". Also check that the native sampler is inside and
   signed: `codesign -dv "dist/mac-universal/ChipDeck.app/Contents/Resources/native/sampler.node"`
   and `lipo -archs` on the same file (expects `x86_64 arm64`).
3. **Publish on GitHub** with `gh` (or 🌐/🧑 in the browser): in the CI draft
   `v<version>-build.<run>` delete the unsigned `ChipDeck-<version>.dmg` /
   `ChipDeck-<version>-universal-mac.zip`, the `.appx` files (Store only) and the combined
   `ChipDeck-<version>.exe`; upload the signed DMG and ZIP from `dist/`; keep the NSIS installers
   `-x64.exe` and `-arm64.exe`. Then
   `gh release edit <draft> --tag v<version> --target <main sha> --title 'ChipDeck <version>'
   --notes-file <notes> --draft=false --latest`. Release notes: changes first, then the download
   table and the signing/SmartScreen notes of the previous release.

**Next:** App Store review (above), test the new features on Windows (section 2), legal texts
(section 4) and the Microsoft Store (section 6).

## 1. Current state

### App (on `main`)

- Electron 44 + React 19 + TypeScript menu bar / tray app for macOS and Windows.
- Features: live screen picker with loupe on every display (native sampler in `native/sampler`,
  optional "Freeze screen while picking"; every pick starts with the default loupe size and zoom,
  and the bigger or further zoomed in the loupe, the slower the mouse), color history with an
  optional "Watch clipboard" (colors copied in other apps land in the history), palettes
  (drag & drop, export as JSON/CSS/SCSS/Tailwind/GIMP), color editor with 17 copy formats, WCAG
  contrast checker, settings (copy format, global shortcuts, tray click action, theme, history
  size, open at login).
- App icon (since 0.1.4): a violet circle in four quarters, deepest top left with a white dot,
  on a white macOS tile. The menu bar / tray icon is the same mark in one color (template image on
  macOS, light/dark variant following the taskbar theme on Windows). `npm run icons` generates
  all of them, including the website icon, the favicon and the Microsoft Store tiles.
- **Business model: free download from GitHub Releases, paid app (one-time purchase of 9.99 USD /
  9.99 EUR) in the Mac App Store and the Microsoft Store.** No in-app purchases, no subscription, no
  license code in the app.
- 74 unit tests (Vitest), typecheck and build are green.

### Repository & automation

- Repository is **public** (`LICENSE`: all rights reserved, source visible for transparency only).
- Default branch `main`; merged branches are deleted (only `main` exists as of 2026-10-21).
- GitHub Actions:
  | Workflow | Trigger | What it does |
  | --- | --- | --- |
  | `ci.yml` (CI) | push to `main`, PRs | typecheck, tests, build; builds the native sampler on macOS and Windows for x64 + arm64 |
  | `release.yml` (Release) | push to `main` (except docs/site), manual | builds macOS universal DMG/ZIP and Windows NSIS (x64+arm64) + APPX (x64, arm64), attaches them to a **draft** release `v<version>-build.<run>` |
  | `pages.yml` (Website) | push to `main` touching `site/`, manual | deploys `site/` to GitHub Pages |
- CI release builds stay drafts: they are **unsigned** and for testing only. Public releases
  (`v<version>`) get a signed and notarized macOS build from `npm run dist:mac-release` on the
  owner's Mac plus the Windows installers from CI (see `docs/STORE.md`).
- **Public release `v0.1.3`** (2026-10-21, "Latest"): signed and notarized universal DMG/ZIP,
  unsigned Windows NSIS installers (x64, arm64) from CI draft `v0.1.3-build.8`. `v0.1.0`,
  `v0.1.1` and `v0.1.2` were built the same way. The free download is not mentioned on the
  website or in the README on purpose.
- No CI drafts are left; the next push to `main` (except docs/site) creates a new one.

### Website (live)

- https://mariokernich.github.io/color-picker/ — landing page, sources in `site/` (plain HTML/CSS,
  no cookies, no tracking, no external resources).
- Privacy policy (DE + EN): https://mariokernich.github.io/color-picker/privacy.html — linked from
  the app (`PRODUCT.privacyUrl` in `src/shared/product.ts`).
- Imprint: https://mariokernich.github.io/color-picker/imprint.html
- The two store buttons on the landing page show "Coming soon" until the listings are live.

### Not verified yet

On real macOS (owner's Mac) these are confirmed: the live picker and its color accuracy
(2026-10-19), the slower mouse for big loupes (2026-10-20) and "Watch clipboard" (2026-10-21,
`pbcopy` test). The rest of the macOS checklist, the sandboxed App Store build beyond a start test,
and **all of Windows** are still unverified. In particular, the Windows cursor slowdown
(`WH_MOUSE_LL` hook in `native/sampler/src/sampler_win.cc`) has only been compiled in CI.

## 2. Verify on real hardware (🤖 with 🧑 clicking)

Either run from source or install the packages from release `v0.1.3` (macOS signed and
notarized; on Windows "More info → Run anyway").

```bash
npm install          # .npmrc sets legacy-peer-deps (works around an npm resolver crash)
npm run dev
```

macOS checklist:

- [ ] Menu bar icon appears and adapts to light/dark menu bar; no Dock icon.
- [ ] First "Pick Color" triggers the Screen Recording permission prompt. After granting (the app
      may need a restart), other apps' windows are visible in the picker, not only the wallpaper.
- [ ] If permission is denied, the popover shows the "Screen access needed" banner and its button
      opens System Settings.
- [ ] Overlay covers menu bar and Dock, also on a second display and over full-screen apps.
- [x] **Live picker:** a playing video stays live under the loupe; the loupe never shows itself
      or the picker overlay (no "loupe in loupe", no darkening); clicking picks the pixel under the
      cursor, also on a second display and over full-screen apps. _(Owner, 2026-10-19.)_
- [x] **Color accuracy (live):** compare picked values with *Digital Color Meter* ("Display in
      sRGB") on a P3/Retina display. The sampler converts to sRGB
      (`native/sampler/src/sampler_mac.mm`), so they should match exactly.
- [ ] **Freeze screen while picking** (Settings): the picker shows a still image again. Compare its
      colors with Digital Color Meter too; if they differ, fix the color space handling of the
      `desktopCapturer` capture in `src/main/picker.ts`.
- [x] **Slower mouse:** with a big or zoomed-in loupe the mouse moves noticeably slower and
      smoothly; every pixel is reachable on Retina. _(Owner, 2026-10-20.)_ Still open: on a second
      display and over full-screen apps.
- [x] **Watch clipboard** (Settings): a copied `#13579B`, `rgb(…)` or `c0ffee` lands in the
      history, other text does not. _(2026-10-21, `pbcopy`.)_ Still open: the macOS pasteboard
      privacy prompt on first use, and that copying a color from ChipDeck itself is not added again.
- [ ] Global shortcut (default ⌘⌥⇧C) works from other apps; shortcut recorder in Settings works.
- [ ] Clicking the menu bar icon while the popover is open closes it (no flicker/reopen).
- [ ] Export keeps the popover open and writes the file.

Windows checklist:

- [ ] Tray icon switches between light/dark variant with the taskbar theme.
- [ ] Popover opens next to the tray icon (taskbar bottom, top, left, right).
- [ ] Overlay covers the taskbar on all monitors, including mixed DPI (100 % + 150 %).
- [ ] **Live picker:** a playing video stays live under the loupe; the loupe never shows itself
      (requires Windows 10 2004+ for `WDA_EXCLUDEFROMCAPTURE`); picked values match the pixel under
      the cursor on every monitor, including mixed DPI. If the loupe is offset on the 150 %
      monitor, check the physical origin from `screen.dipToScreenPoint` in `src/main/sampler.ts`.
- [ ] **Freeze screen while picking** (Settings) still works.
- [ ] `npm install` without the Visual Studio Build Tools only warns, and the picker freezes the
      screen.
- [ ] **Slower mouse:** with a big or zoomed-in loupe the mouse moves slower and smoothly, also at
      150 % DPI; after closing the picker (also with Esc) the mouse moves normally again.
- [ ] **Watch clipboard:** copied colors land in the history.
- [ ] Global shortcut (default Ctrl+Alt+Shift+C) works.

Fix what fails on a `fix/*` branch with small commits; run `npm run typecheck && npm test` first.

## 3. Name ✅

- The app is called **ChipDeck**. Store name in App Store
  Connect: **"ChipDeck: Color Picker"**, because plain "ChipDeck" is already reserved there. Use
  the same store name in Partner Center.
- The name lives in `src/shared/product.ts` (`PRODUCT.name`), `package.json` (`productName`),
  `electron-builder.yml` (`productName`, `nsis.shortcutName`, `appx.displayName`), `site/*.html`
  and the docs.
- Bundle ID stays `de.kernich.colorpicker`; the repository and website URLs keep `color-picker`.
- 🧑 Open: trademark search (EUIPO/DPMA) for "ChipDeck" before the first release.

## 4. Legal texts (🧑)

- [ ] Have privacy policy and imprint checked (they are templates, not legal advice).
- [ ] Add a VAT ID to the imprint (`site/imprint.html`) if one exists. Selling apps is a business
      activity: clarify trade registration (Gewerbe) and tax status (Kleinunternehmer or not).

## 5. Mac App Store submission

### 5.1 Accounts & legal (🧑, 🌐 can help fill forms)

- [x] Apple Developer Program (99 USD/year).
- [x] App Store Connect → Business: **Paid Apps Agreement** (new version accepted 2026-10-20), tax
      forms, bank account and Digital Services Act trader details are active.
- [x] **App Store Small Business Program** (proceeds are 85 % of the price).

### 5.2 Certificates, profiles, entitlements (🧑/🌐 in the portal, 🤖 wires up)

- [x] App ID `de.kernich.colorpicker` (team `34JNW2E282`).
- [x] Certificates in the owner's login keychain: *Apple Distribution*, *3rd Party Mac Developer
      Installer* (= Mac Installer Distribution), *Apple Development* and *Developer ID
      Application* (for the GitHub releases).
- [x] Provisioning profiles *Color Picker Mac App Store* → `build/embedded.provisionprofile` and
      *Color Picker Mac Development* (includes the owner's MacBook Pro) →
      `build/development.provisionprofile` (both git-ignored, only on the owner's Mac).
- [x] Team entitlements in `build/entitlements.mas.plist`. `npm run dist:mas` produces a signed
      universal `.pkg` (verified locally).

### 5.3 Test the sandboxed build locally (🤖 on the Mac)

```bash
npm run dist:mas-dev     # signed with the development profile
```

Run it from `dist/mas-dev-arm64/` (`dist:mas-dev` builds for the Mac's own architecture). Check:
starts, menu bar icon, picker + permission prompt, slower mouse, watch clipboard, export via save
dialog (sandbox file access), settings persist, "Open at login" works. As of 2026-10-21 only the
start was checked (no sandbox violations in the log).

### 5.4 App Store Connect record (🧑/🌐, 🤖 prepares texts and screenshots)

- [x] New macOS app "ChipDeck: Color Picker" (Apple ID 6824296695, SKU `chipdeck-macos`, English).
- [x] German localization "ChipDeck: Farbpipette".
- [x] Category *Graphics & Design* (secondary *Developer Tools*).
- [x] **Pricing:** 9.99 USD; App Store Connect sets 9.99 € (DE, AT) and 9.00 CHF.
- [x] App Privacy: **Data Not Collected**. Privacy URL:
      `https://mariokernich.github.io/color-picker/privacy.html`.
- [x] Support and marketing URL: `https://mariokernich.github.io/color-picker/`.
- [x] Age rating 4+.
- [x] Description, subtitle, keywords, promotional text (EN + DE), review notes (they also
      explain the slower mouse and "Watch clipboard").
- [x] Screenshots 2880×1800, 5 per language: real app UI (the built renderer with the browser mock
      data, and the real picker code drawing the loupe over a made-up website) rendered by headless
      Chrome, with a caption on a gradient: `npm run store:screenshots` (see `docs/STORE.md`).

The texts (`scripts/store/listing.json`), screenshots, build and submission were set through the
**App Store Connect API** (`npm run store -- <command>`)
with the key that has the *App Manager* role (`~/.appstoreconnect/private_keys/`; key ID and
issuer ID on App Store Connect → Users and Access → Integrations). Only App Privacy and the
agreements need the browser.

### 5.5 Build, upload, review (🤖 builds, 🧑 submits)

```bash
npm run dist:mas         # dist/mas-universal/ChipDeck-<version>-universal.pkg
xcrun altool --upload-package dist/mas-universal/ChipDeck-<version>-universal.pkg --type macos \
  --apple-id 6824296695 --bundle-id de.kernich.colorpicker \
  --bundle-version <version> --bundle-short-version-string <version> \
  --apiKey <KEYID> --apiIssuer <issuer id>
```

- Bump `version` in `package.json`; every upload needs a unique, increasing build number
  (`-c.buildVersion=<n>` or `buildVersion` in `electron-builder.yml`). The App Store version
  number must match `CFBundleShortVersionString`.
- After processing (5–30 min), set the build's export compliance (no non-exempt encryption),
  select it in the version and submit (API: `reviewSubmissions` + `reviewSubmissionItems`, or
  *Add for Review* in the browser).
- Pre-empt common rejections: explain Screen Recording use and the menu bar–only UI in the review
  notes, make sure the privacy URL works, verify all Electron helpers are signed.

## 6. Microsoft Store submission

### 6.1 Account (🧑, 🌐 can help)

- [ ] Partner Center developer account (check the current registration fee).
- [ ] Payout and tax profile (required for paid apps).

### 6.2 Product setup (🧑/🌐 in Partner Center, 🤖 wires up)

- [ ] Reserve the app name (step 3).
- [ ] Product identity → 🤖 put *Package/Identity/Name*, *Publisher* and *Publisher display name*
      into `appx.identityName`, `appx.publisher`, `appx.publisherDisplayName` in
      `electron-builder.yml` (currently `TODO` placeholders — the CI APPX builds use them too).
- [ ] **Pricing:** base price 9.99 USD, check the EUR price is 9.99 €, free trial: *No free trial*.
- [ ] Properties: category *Productivity* or *Developer tools*, privacy URL (see 5.4).
- [ ] Age ratings: IARC questionnaire.
- [ ] Store listing EN + DE, screenshots (min. 1366×768) from a real Windows machine.

### 6.3 Build & submit

- Use the `.appx` files from the latest draft release (built in CI once the identity values are
  set), or build locally on Windows: `npm run dist:appx`.
- Partner Center asks for a justification of the restricted capability **`runFullTrust`**
  (all Electron apps): "Desktop (Win32) app packaged as MSIX; needs full trust to capture the screen
  for the color picker and to register global shortcuts."
- Optional: "Open at login" in Store builds needs `appx.addAutoLaunchExtension: true`; the setting
  is hidden in Store builds for now (`supportsLoginItem` in `src/main/index.ts`).

## 7. Housekeeping

- [x] Delete the outdated draft releases `v0.1.0-build.1/3/4/5` (done 2026-10-19).
- [x] Commit the `package-lock.json` update with `"hasInstallScript": true` (2026-10-20).
- [x] Delete merged branches, including `feat/color-picker-app` (2026-10-21).
- [x] App Store screenshot generator and App Store Connect API scripts in `scripts/store/`
      (`npm run store:screenshots`, `npm run store -- <command>`, see `docs/STORE.md`).
- [ ] 🧑 Decide: should `release.yml` delete older drafts automatically (e.g. keep the newest 3)?
      Otherwise every push to `main` adds a draft. 🤖 can add a cleanup step using `gh release
      delete` with the workflow token.
- [ ] 🤖 Bump the GitHub Actions to Node 24 compatible majors (CI warns that `actions/checkout@v4`,
      `actions/download-artifact@v4` and `softprops/action-gh-release@v2` run on deprecated Node 20).
- [ ] 🤖 When the store listings are live: replace the "Coming soon" buttons in `site/index.html`
      (set `href`, remove `aria-disabled`).
- [ ] 🤖 Optional: ESLint + Prettier scripts (`.prettierrc` exists, no lint script yet).
- [ ] 🤖 Optional: German UI localization (UI is English only; store listings can still be German).

## 8. Known gaps & ideas (not required for v1)

- Signed builds in CI would need certificates as GitHub secrets (Apple: Developer ID or MAS
  certificates + provisioning profile; Windows Store packages are signed by the Store).
- No free trial: not possible for paid apps in the Mac App Store; possible in the Microsoft Store
  but would need license checks via `Windows.Services.Store` (native code).
- Ideas: color blindness simulation, palette import (ASE/JSON), "send to app" integrations, palette
  sync, Apple Shortcuts / URL scheme.
