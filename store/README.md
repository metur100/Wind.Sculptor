# Wind Sculptor – store release kit

Everything needed to publish on **Google Play** and the **Apple App Store**.

```
mobile/                         Expo app (SDK 57) that runs the game in a WebView – fully offline
  app.json / eas.json           app identity, icons, splash, build + submit profiles
  credentials.json              Android upload-key config  (NOT in git – back it up!)
  credentials/android/*.jks     Android upload keystore    (NOT in git – back it up!)
store/
  listing/google-play.md        all Play Console texts + Data safety / content rating / app content answers
  listing/app-store.md          all App Store Connect texts + App Privacy / age rating / review notes
  privacy-policy.html           privacy policy – host it and use its URL in both stores
  graphics/                     Play icon 512, feature graphic 1024×500, App Store icon 1024
  screenshots/<device>/         captioned store screenshots (8 per device size)
  screenshots/raw/<device>/     the same shots without captions
  tools/                        scripts that regenerate screenshots and graphics
```

| Identity | Value |
| --- | --- |
| App name | Wind Sculptor |
| Android package / iOS bundle ID | `com.certidevelopment.windsculptor` |
| Version | 1.0.0 (Android versionCode 1, iOS buildNumber 1) |
| Expo project | `@certi-development/wind-sculptor` (ID `52d1bd22-7fe8-47cb-b757-82a1296d97c9`) |

---

## 0. Host the privacy policy (both stores require a URL)

Upload `store/privacy-policy.html` anywhere public, e.g. GitHub Pages, Netlify Drop (drag the file onto app.netlify.com/drop), or your own website. Use that URL for the Play "Privacy policy" field, the App Store "Privacy Policy URL" and (optionally) the App Store "Support URL".

## 1. Android – Google Play

### Build the AAB
```bash
cd mobile
npm run build:game        # rebuilds the game into mobile/src/gameHtml.ts (only needed after game changes)
eas build -p android --profile production
```
The AAB is signed with the upload key from `credentials.json` (local credentials).

### First upload (must be done by hand once)
1. Play Console → **Create app** → name *Wind Sculptor*, default language English (US), **Game**, **Free**, accept declarations.
2. **App signing:** keep the default **Play App Signing**. Your keystore is the *upload key*; Google holds the app signing key.
3. Fill everything in **Policy → App content** and **Store presence** from `store/listing/google-play.md`.
4. **Testing → Internal testing** (or Closed testing) → Create release → upload the `.aab` → release notes from the listing file → Review → Roll out.
   - *New personal developer accounts* must run a **closed test with at least 12 testers for 14 days** before Production access is granted. Organisation accounts can go to Production directly.
5. **Production** → Create release → promote the same build → Send for review.

### Later uploads with EAS Submit (optional)
Create a Google Cloud service account with Play Console access, download its JSON key to `mobile/credentials/play-service-account.json`, and add to `eas.json → submit.production.android`: `"serviceAccountKeyPath": "./credentials/play-service-account.json"`. Then:
```bash
eas submit -p android --profile production --latest
```
Before every new upload, raise `android.versionCode` (and `version`) in `mobile/app.json`.

## 2. iOS – App Store (built and uploaded with Expo, no Mac needed)

Requirements: a paid **Apple Developer Program** membership.

```bash
cd mobile
eas build -p ios --profile production --auto-submit
```
- On the first run EAS asks you to log in with your Apple ID. It then creates the **distribution certificate**, **provisioning profile** and the bundle ID `com.certidevelopment.windsculptor`, and stores them on Expo's servers. Answer *Yes* when it offers to generate them.
- `--auto-submit` uploads the finished `.ipa` to **App Store Connect / TestFlight**. If the app record doesn't exist yet, EAS Submit creates it (it asks for the app name and language).
- To upload an existing build instead: `eas submit -p ios --latest`.

Then in **App Store Connect**:
1. Open the app → **App Information / Pricing / App Privacy** → fill in from `store/listing/app-store.md`.
2. Version 1.0 → upload screenshots (6.9" iPhone + 13" iPad are required), description, keywords, support URL, review notes.
3. Select the build (it appears ~10–30 min after upload, once processing finishes) → **Add for Review** → **Submit**.

Before every new upload, raise `ios.buildNumber` (and `version` for a new store version) in `mobile/app.json`.

## 3. Checklist

**Google Play**
- [ ] Privacy policy URL
- [ ] App icon 512 × 512 – `graphics/play-store-icon-512.png`
- [ ] Feature graphic 1024 × 500 – `graphics/play-feature-graphic-1024x500.png`
- [ ] Phone screenshots – `screenshots/android-phone/`
- [ ] 7" tablet screenshots – `screenshots/android-tablet-7/`
- [ ] 10" tablet screenshots – `screenshots/android-tablet-10/`
- [ ] Short + full description
- [ ] Category Puzzle, contact e-mail
- [ ] Content rating (IARC) questionnaire
- [ ] Target audience, Ads = No, Data safety = no data collected, App access = no login
- [ ] AAB uploaded to a testing track, then production

**App Store**
- [ ] Privacy policy URL + support URL
- [ ] iPhone 6.9" screenshots – `screenshots/ios-iphone-6.9/`
- [ ] iPad 13" screenshots – `screenshots/ios-ipad-13/`
- [ ] (optional) iPhone 6.5" – `screenshots/ios-iphone-6.5/`
- [ ] Name, subtitle, promotional text, description, keywords
- [ ] Category Games → Puzzle / Casual, age rating 4+, copyright
- [ ] App Privacy → Data Not Collected
- [ ] Review notes, contact details
- [ ] Build uploaded with `eas build -p ios --auto-submit` and selected for the version

## 4. Regenerating assets

```bash
npm run build:mobile                           # game → mobile/src/gameHtml.ts
node store/tools/capture-screenshots.mjs       # raw screenshots for every device size (needs Microsoft Edge)
node store/tools/render-graphics.mjs           # icons, splash, feature graphic, captioned screenshots
```

## 5. Keep these safe

The **Android upload keystore** (`mobile/credentials/android/wind-sculptor-upload.jks`) and its password (in `mobile/credentials.json`) are deliberately not committed to git. Store copies in a password manager or other secure backup. If the upload key is lost it can be reset through Play Console support (Play App Signing), but that takes days.
