# Store Distribution & Monetization

## Business model

| | Mac App Store | Microsoft Store | Direct download (DMG / NSIS) |
| --- | --- | --- | --- |
| Product | Auto-renewable subscription, 1 year | Subscription add-on, 1 year | – |
| Price | 9.99 USD / 9.99 EUR | 9.99 USD / 9.99 EUR | – |
| Free trial | Introductory offer "Free, 1 month" | Add-on free trial "1 month" | App-managed, 30 days |
| Code | `src/main/license/mas.ts` | `src/main/license/msstore.ts` (**TODO**) | `src/main/license/local.ts` |
| Store fee | 15 % (App Store Small Business Program) | 15 % (5 % for deep-link acquisitions) | – |

Identifiers live in [`src/shared/product.ts`](../src/shared/product.ts).

### Why the trial is a store introductory offer

- **Apple** explicitly allows an app-managed time-limited trial only for _non-subscription_ apps,
  via a free non-consumable "trial" in-app purchase (App Review Guideline 3.1.1). Subscription apps
  are expected to use an **introductory offer** (free trial) on the subscription. The user starts the
  subscription with 0.00 for the first month and can cancel at any time in their account settings.
- **Microsoft** supports free trials (1 week or 1 month) directly on subscription add-ons.
- Both stores then handle renewals, refunds, family sharing, taxes and invoices.

On first launch, store builds therefore show the paywall ("30 days free, then 9.99 per year").
Direct-download builds use an app-managed 30-day trial without payment details.

### Things to consider (recommendations)

- **Freemium instead of a hard paywall.** Small utilities usually convert and review better when the
  basic function stays free, for example picker + history free and palettes, formats, contrast and
  export in "Pro". The license code already exposes `entitled`, so this mostly needs feature gating
  in the UI.
- **Trial length.** 30 days is generous. Comparable tools use 7–15 days (Sip: 15 days). Shorter
  trials usually convert better because users decide while they still remember the app.
- **Lifetime option.** Many users dislike subscriptions for small tools. A non-consumable "Lifetime"
  purchase (for example 24.99) next to the subscription is common and easy to add on both stores.

## Mac App Store

### One-time setup

1. Join the Apple Developer Program and accept the **Paid Apps Agreement** (App Store Connect →
   Business). Enrol in the **App Store Small Business Program** (15 % instead of 30 %).
2. Certificates & profiles (developer.apple.com):
   - App ID `de.kernich.colorpicker` with the *In-App Purchase* capability.
   - Certificates: *Apple Distribution* and *Mac Installer Distribution*.
   - Provisioning profile *Mac App Store* for the App ID → save as `build/embedded.provisionprofile`
     (git-ignored). For local sandbox testing also a *Mac Development* profile →
     `build/development.provisionprofile`.
3. Add your team to `build/entitlements.mas.plist` (signing fails without these):
   ```xml
   <key>com.apple.application-identifier</key>
   <string>TEAMID.de.kernich.colorpicker</string>
   <key>com.apple.developer.team-identifier</key>
   <string>TEAMID</string>
   ```
4. App Store Connect → new macOS app with the bundle ID above. Category: Graphics & Design.
5. **Subscription**: Monetization → Subscriptions → group "Color Picker Pro" → subscription
   - Product ID: `de.kernich.colorpicker.pro.yearly`
   - Duration: 1 year, price 9.99 USD (choose the EUR price point 9.99 explicitly)
   - Introductory offer: *Free*, duration *1 month*, all territories
   - Localized display name and description (EN + DE), review screenshot of the paywall
6. App privacy: "Data Not Collected" (see [PRIVACY.md](PRIVACY.md)). Privacy policy URL:
   the published `docs/PRIVACY.md`.

### Build & upload

```bash
npm run dist:mas        # dist/mas-universal/Color Picker-<version>.pkg
```

Upload the `.pkg` with **Transporter**, then select the build and the subscription in the version
and submit both for review together (a first subscription must be reviewed with an app version).

Review notes to include:

> Color Picker is a menu bar app (no Dock icon). Click the icon in the menu bar to open it.
> Picking colors from the screen requires the Screen Recording permission, which macOS asks for the
> first time "Pick Color" is used. Screen contents are only processed in memory to read pixel colors.

### Testing purchases

Build with `npm run dist:mas-dev`, sign in with a **Sandbox Apple Account** (System Settings → App
Store → Sandbox Account) and run the app. In the sandbox a one-year subscription renews every hour
and the trial lasts a few minutes, which makes renewals and expiry easy to test.

### Entitlement check

`MasProvider` reads the App Store receipt (`inAppPurchase.getReceiptURL()`) and uses the latest
non-refunded expiry date of the subscription. If no receipt can be read it falls back to the last
seen transaction plus one year.

Known limitations / next steps:

- The receipt signature is **not verified** on the device. This is acceptable for a 9.99 product,
  but anything tamper-proof belongs on a server (App Store Server API + App Store Server
  Notifications).
- Apple has deprecated the app receipt in favor of StoreKit 2 (`Transaction.currentEntitlements`).
  It still works, but a small native StoreKit 2 bridge (Swift N-API addon) is the long-term path.
  Electron's built-in `inAppPurchase` module uses StoreKit 1.

## Microsoft Store

### One-time setup

1. Partner Center → Apps and games → reserve the name **Color Picker** (the plain name is probably
   taken; reserve an alternative such as "Color Picker – Loupe & Palettes" early).
2. Product identity → copy *Package/Identity/Name* and *Publisher* into `appx.identityName` and
   `appx.publisher` in `electron-builder.yml`.
3. Add-ons → new add-on, product type **Subscription**, product ID `colorpicker.pro.yearly`:
   - Subscription period 1 year, free trial **1 month**, price tier 9.99 USD
   - Copy its **Store ID** (`9N…`) into `PRODUCT.msStoreSubscriptionId`
4. Age rating, store listing (EN + DE), screenshots, privacy policy URL.

### Build & upload

```bash
npm run dist:appx       # on Windows with the Windows 10/11 SDK installed
```

Upload the `.appx` in the submission. The Store signs the package, so no code-signing certificate
is needed for Store builds.

### TODO: purchases

`MsStoreProvider` currently behaves like the local trial and does not offer a purchase. Purchases
need `Windows.Services.Store.StoreContext` (`GetAppLicenseAsync`, `RequestPurchaseAsync`). Desktop
apps must associate the StoreContext with their window handle (`IInitializeWithWindow`), which
plain Node.js cannot do. Options:

1. **Small helper** (recommended): a C#/.NET console helper bundled in the package that talks JSON
   over stdin/stdout (`status`, `purchase <hwnd>`), using `WinRT.Interop.InitializeWithWindow`.
2. **N-API addon** in C++/WinRT, loaded only in `process.windowsStore` builds.
3. Microsoft allows non-game apps to use **their own commerce**, so a license-key provider
   (Paddle, Lemon Squeezy, …) would also work and could be shared with the direct-download builds.

Also note that "Open at login" uses a `StartupTask` in packaged Store apps; enable
`appx.addAutoLaunchExtension` if needed. The setting is hidden in Store builds for now.

## Direct download (outside the stores)

`npm run dist:mac` / `npm run dist:win` produce a DMG and an NSIS installer with the app-managed
30-day trial. They do not offer purchases yet and point users to the stores. For distribution
outside the stores, sign with a *Developer ID* certificate and notarize (`mac.notarize: true` +
`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`), and sign the Windows installer with an
Authenticode certificate, otherwise SmartScreen warns users.

## Release checklist

- [ ] Version bumped in `package.json`
- [ ] `npm test` and `npm run typecheck` pass
- [ ] Picker tested on a Retina and a non-Retina display, multi-monitor, light/dark mode
- [ ] macOS: Screen Recording permission flow tested on a fresh user account
- [ ] Sandbox purchase, restore, renewal and expiry tested
- [ ] Store screenshots updated
