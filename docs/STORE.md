# Store Distribution

## Business model

ChipDeck is **free to download** from GitHub Releases and a **paid app** in the stores: a one-time
purchase, no in-app purchases, no subscription and no license code in the app. The store version
is the convenient way to support development and get automatic updates. The stores handle
payment, taxes, refunds and re-downloads.

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
3. Team `34JNW2E282` is set in `build/entitlements.mas.plist` (signing or launching fails without
   these; Electron needs the application group for its sandboxed IPC). For another team, replace it:
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
4. App Store Connect → macOS app **"ChipDeck: Color Picker"** (Apple ID 6824296695, SKU
   `chipdeck-macos`, bundle ID above). Plain "ChipDeck" is taken in the App Store; the app itself is
   called ChipDeck. Category *Graphics & Design*.
5. **Pricing and Availability**: base price 9.99 USD, check the EUR price (9.99 €).
6. App privacy: "Data Not Collected". Privacy policy URL:
   `https://mariokernich.github.io/color-picker/privacy.html`, support/marketing URL:
   `https://mariokernich.github.io/color-picker/` (sources in `site/`).

### Build & upload

```bash
npm run dist:mas        # dist/mas-universal/ChipDeck-<version>-universal.pkg
```

Upload the `.pkg` with **Transporter**, select the build in the app version and submit it.

Review notes to include:

> ChipDeck is a menu bar app (no Dock icon). Click the icon in the menu bar to open it.
> Picking colors from the screen requires the Screen Recording permission, which macOS asks for the
> first time "Pick Color" is used. Screen contents are only processed in memory to read pixel colors.

## Microsoft Store

### One-time setup

1. Partner Center → Apps and games → reserve the app name. Use the same store name as in the
   Mac App Store, "ChipDeck: Color Picker" (plain "ChipDeck" is taken in the App Store).
2. Product identity → copy *Package/Identity/Name* and *Publisher* into `appx.identityName` and
   `appx.publisher` in `electron-builder.yml`.
3. **Pricing and availability**: base price **9.99 USD**, check the EUR market price (9.99 €).
   Free trial: *No free trial*.
4. Age rating, store listing (EN + DE), screenshots, privacy policy URL
   (`https://mariokernich.github.io/color-picker/privacy.html`).

### Build & upload

```bash
npm run dist:appx       # on Windows with the Windows 10/11 SDK installed
```

Upload the `.appx` in the submission. The Store signs the package, so no code-signing certificate
is needed for Store builds.

Note: "Open at login" needs a `StartupTask` in packaged Store apps; enable
`appx.addAutoLaunchExtension` if wanted. The setting is hidden in Store builds for now.

## GitHub releases (free download)

Public releases on GitHub contain:

- **macOS**: universal DMG and ZIP, signed with *Developer ID Application: Mario Kernich
  (34JNW2E282)* and notarized. Build them on the owner's Mac (the Developer ID key is only in that
  login keychain), with the App Store Connect API key for notarization:
  ```bash
  APPLE_API_KEY=~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8 \
  APPLE_API_KEY_ID=<KEYID> APPLE_API_ISSUER=<issuer id> \
  npm run dist:mac-release
  ```
  Check with `spctl -a -vvv -t install dist/ChipDeck-<version>.dmg` (expects "Notarized Developer ID").
- **Windows**: the NSIS installers (x64, arm64) from the CI draft release of the same commit. They
  are unsigned, so SmartScreen warns on first launch.

The CI drafts (`release.yml`) stay drafts: their macOS builds are neither signed nor notarized.
Create the public release with a `v<version>` tag, upload the assets and publish it.

## Release checklist

- [ ] Version bumped in `package.json`
- [ ] `npm test` and `npm run typecheck` pass
- [ ] Picker tested on a Retina and a non-Retina display, multi-monitor, light/dark mode
- [ ] macOS: Screen Recording permission flow tested on a fresh user account
- [ ] Store screenshots and description updated
