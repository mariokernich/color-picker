# Store Distribution

## Business model

Color Picker is a **paid app**: a one-time purchase in the store, no in-app purchases, no
subscription and no license code in the app. The stores handle payment, taxes, refunds and
re-downloads.

| | Mac App Store | Microsoft Store |
| --- | --- | --- |
| Price | 9.99 USD / 9.99 EUR | 9.99 USD / 9.99 EUR |
| Store fee | 15 % (App Store Small Business Program) | 15 % (5 % for purchases via your own link) |
| Trial | Not available for paid apps | Possible, but needs license checks in the app (not implemented) |
| Package | `npm run dist:mas` (`.pkg`) | `npm run dist:appx` (`.appx`) |

Things to keep in mind:

- **No trial on the Mac App Store.** Paid apps cannot be tried before buying. Good screenshots, a
  short preview video and a clear description matter more. Refunds go through Apple.
- **Updates are free forever** for buyers. A later paid major version would need a new app record.
- **Prices per country** are derived automatically from the base price. Set the EUR price point
  explicitly to 9.99 so it does not end up at 10.99 after tax adjustments.

## Mac App Store

### One-time setup

1. Join the Apple Developer Program, accept the **Paid Apps Agreement** (App Store Connect →
   Business, including tax and banking) and enrol in the **App Store Small Business Program**.
2. Certificates & profiles (developer.apple.com):
   - App ID `de.kernich.colorpicker`.
   - Certificates: *Apple Distribution* and *Mac Installer Distribution*.
   - Provisioning profile *Mac App Store* for the App ID → save as `build/embedded.provisionprofile`
     (git-ignored). For local sandbox testing also a *Mac Development* profile →
     `build/development.provisionprofile`.
3. Add your team to `build/entitlements.mas.plist` (signing or launching fails without these;
   Electron needs the application group for its sandboxed IPC):
   ```xml
   <key>com.apple.application-identifier</key>
   <string>TEAMID.de.kernich.colorpicker</string>
   <key>com.apple.developer.team-identifier</key>
   <string>TEAMID</string>
   <key>com.apple.security.application-groups</key>
   <array>
     <string>TEAMID.de.kernich.colorpicker</string>
   </array>
   ```
4. App Store Connect → new macOS app with the bundle ID above, category *Graphics & Design*.
5. **Pricing and Availability**: base price 9.99 USD, check the EUR price (9.99 €).
6. App privacy: "Data Not Collected" (see [PRIVACY.md](PRIVACY.md)). Privacy policy URL: the
   published `docs/PRIVACY.md`.

### Build & upload

```bash
npm run dist:mas        # dist/mas-universal/Color Picker-<version>.pkg
```

Upload the `.pkg` with **Transporter**, select the build in the app version and submit it.

Review notes to include:

> Color Picker is a menu bar app (no Dock icon). Click the icon in the menu bar to open it.
> Picking colors from the screen requires the Screen Recording permission, which macOS asks for the
> first time "Pick Color" is used. Screen contents are only processed in memory to read pixel colors.

## Microsoft Store

### One-time setup

1. Partner Center → Apps and games → reserve the app name. The plain name "Color Picker" is
   probably taken; reserve an alternative such as "Color Picker – Loupe & Palettes" early.
2. Product identity → copy *Package/Identity/Name* and *Publisher* into `appx.identityName` and
   `appx.publisher` in `electron-builder.yml`.
3. **Pricing and availability**: base price **9.99 USD**, check the EUR market price (9.99 €).
   Free trial: *No free trial*.
4. Age rating, store listing (EN + DE), screenshots, privacy policy URL.

### Build & upload

```bash
npm run dist:appx       # on Windows with the Windows 10/11 SDK installed
```

Upload the `.appx` in the submission. The Store signs the package, so no code-signing certificate
is needed for Store builds.

Note: "Open at login" needs a `StartupTask` in packaged Store apps; enable
`appx.addAutoLaunchExtension` if wanted. The setting is hidden in Store builds for now.

## Builds outside the stores

`npm run dist:mac` and `npm run dist:win` produce a DMG and an NSIS installer. They contain no
license check, so use them for testing only and do not publish them, otherwise the app is
available for free.

## Release checklist

- [ ] Version bumped in `package.json`
- [ ] `npm test` and `npm run typecheck` pass
- [ ] Picker tested on a Retina and a non-Retina display, multi-monitor, light/dark mode
- [ ] macOS: Screen Recording permission flow tested on a fresh user account
- [ ] Store screenshots and description updated
