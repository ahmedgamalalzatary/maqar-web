# Store readiness: Google Play and the App Store

Checked 2026-11-11 against the stores' current rules (sources at the end) and the code at `aaaef4b` plus the uncommitted work.
The goal is to pass review on the first try.

What the app's builds actually contain was read with `npx expo config --type introspect` (the final Android permissions and iOS `Info.plist`), not guessed from `app.json`.

Marks: ✅ done · ❌ missing (to fix in code) · 📝 to do in the store console (no code) · ⏸ deferred by the owner (contract §17.2, last line) · ⚠️ check on the first real upload.

---

## 1. What blocks a first-time pass

These are the items that would get a submission rejected or stop it from uploading. Everything else is in sections 2 to 4.

| # | Store | Item | Status |
|---|---|---|---|
| B1 | Both | **Privacy policy:** a public web page, linked in the store listing **and** inside the app | ❌ none exists |
| B2 | Google Play | **Web link for account deletion:** a public page where a user can ask for their account to be deleted, without the app | ❌ none exists (deleting from inside the app ✅ works) |
| B3 | Both | **Permissions the app never uses:** Android ships camera, microphone, calendar and old storage permissions; iOS ships calendar, reminders and Face ID texts | ✅ fixed in Phase 20 (was ❌) see §2.2 and §3.2 |
| B4 | App Store | **Vague iOS permission texts** ("Allow Maqar to access your device motion"); Apple rejects these under 5.1.1 | ✅ fixed in Phase 20 (was ❌) see §3.2 |
| B5 | App Store | **Support URL and contact details** (Apple requires a support URL; guideline 1.2 asks for published contact details when users can message) | ❌ |
| B6 | App Store | **Paid Apple Developer account, signed build, APNs key** | ⏸ OPS-02 |
| B7 | Google Play | **Firebase `google-services.json`** (no Android push without it) | ⏸ OPS-01 |
| B8 | Both | **Version and build numbers that go up on each upload.** The first upload works; the second is refused without this. | ⏸ OPS-03 |
| B9 | Google Play | **New personal developer account:** a closed test with **12 testers opted in for 14 days in a row** before production can be requested | 📝 an account choice (see §2.1) |
| B10 | Both | **A working review account and a server that stays up** throughout review | 📝 demo accounts exist ✅; the server is temporary, see §4 |

Items B1, B2, B3, B4 and B5 are small code and web changes that can be done now, without any of the deferred items.

---

## 2. Google Play

### 2.1 Account

| Item | Status | Notes |
|---|---|---|
| Play Console developer account ($25 once) | 📝 | **Personal account:** a closed test with 12 testers for 14 days, then a production-access request that Google reviews (about a week; a rejection restarts the test). **Organization account:** has no tester rule, but needs a D-U-N-S number, which can take up to 30 days. Plan about 3 weeks either way. |
| Identity verification | 📝 | Done in the Play Console when the account is created. Android "developer verification" (on-device checks of sideloaded apps) started in Brazil, Indonesia, Singapore and Thailand on 2026-09-30 and goes global in 2027. Apps from the Play Store are not affected. Later, APKs sent to testers outside Play will need the verified developer. |
| Play App Signing | 📝 | Accept it on the first upload. Our AAB is signed with the upload key (`android-aab.yml`) ✅. Keep the upload key's SHA-1. The Maps key must also be restricted to the **Play signing** SHA-1, which the Console shows after enrolment. |

### 2.2 Technical

| Item | Status | Notes |
|---|---|---|
| Target API level: Android 16 (API 36) for new apps and updates from 2026-08-31 | ✅ | React Native 0.88: `targetSdk 36`, `compileSdk 37`, `minSdk 24`. |
| 16 KB memory pages (required for apps targeting Android 15+ since 2025-11-01) | ✅ ⚠️ | React Native ≥ 0.77 and NDK 27 support it. Check the first upload in Play Console → App bundle explorer, which flags any native library that fails ("Does not support 16 KB"). |
| App Bundle (.aab), signed | ✅ | `android-aab.yml`, started by hand. |
| HTTPS only | ✅ | The release API is `https://187-55-224-15.sslip.io/v1`, so cleartext stays off. |
| **Permissions the app doesn't use** | ✅ fixed in Phase 20 (was ❌) | The final manifest has `CAMERA`, `RECORD_AUDIO`, `READ_CALENDAR`, `WRITE_CALENDAR`, `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE`. Nothing in `src/` uses camera, microphone or calendar. `expo-calendar` is a dependency but is never imported. Google checks declared permissions against the Data safety form and real use, so unused ones invite questions or a rejection. **Fix:** remove `expo-calendar` from `package.json`, and add `android.blockedPermissions` for `CAMERA`, `RECORD_AUDIO` and the two storage permissions. `SYSTEM_ALERT_WINDOW` comes from the debug manifest only; check that it's gone from the release AAB. |
| Photo access via the system photo picker (Play's Photo and Video Permissions policy) | ✅ | `expo-image-picker` uses Android's photo picker, and there is no `READ_MEDIA_IMAGES`, so no declaration is needed. |
| Push (FCM) | ⏸ | OPS-01: needs `google-services.json`. |
| **Google Maps key** | ❌ ⚠️ | The repo has **no `GOOGLE_MAPS_API_KEY` secret**, so a release AAB built today leaves out the property map (the workflow only warns). Add the key, restricted to `com.maqar.app` and the upload and Play signing SHA-1s. |
| versionCode goes up on each upload | ⏸ | OPS-03. Play refuses a versionCode it has already seen. |

### 2.3 App content (Play Console → Policy → App content)

All 📝: answers to fill in, and none needs code except the two URLs.

| Declaration | Our answer |
|---|---|
| Privacy policy URL | ❌ needs B1 |
| App access | "Some functions are restricted": give a **client** demo account (e-mail and password) plus a short note. Agents and admins are Maqar staff accounts. Give one of those as well if the staff screens should be reviewed. |
| Ads | No ads. |
| Content rating (IARC questionnaire) | Category "Utility / productivity" or "Shopping". Answer **yes** to "users can interact / exchange messages" (the client ↔ advisor chat) and "shares … info" (photos in chat). |
| Target audience | 18+ only. Not for children, so the Families policy doesn't apply. |
| Data safety | See §2.4. |
| Account deletion | "Yes", the in-app path ✅ plus the web link ❌ (B2). |
| Financial features | "None". The installment calculator only does sums: no loans, payments or credit. |
| Health, government, news, COVID apps | No. |
| Advertising ID | Not used. We have no ads or analytics SDK. Confirm that the release manifest has no `AD_ID` permission. |

### 2.4 Data safety: our answers, from the code

| Data type | Collected | Why | Optional? | Notes |
|---|---|---|---|---|
| Name, e-mail address | Yes | Account | Required to sign up | Browsing works without an account ✅ |
| Phone number | Yes | Account, and the agent calls back | Optional | |
| Messages (in-app chat) | Yes | App functionality | Optional | |
| Photos (sent in chat) | Yes | App functionality | Optional | Chat photos are public to anyone who has the URL (SEC-04, documented). The privacy policy should say so. |
| App activity (views, saves, follows, viewings booked) | Yes | App functionality (matches, listing insights) | | Insights are shown to Maqar admins. |
| Device or other IDs (push token) | Yes | Notifications | Optional | Sent to Expo's push service, then FCM/APNs. These count as **service providers**, not "sharing". |
| Location | **No** | | | The app never asks for location ✅ |
| Encrypted in transit | Yes (HTTPS) | | | |
| Users can request deletion | Yes | | | In the app ✅; web link ❌ |

What account deletion does is solid. `UsersRepository.softDelete` blanks the name, e-mail, phone and password. It also deletes preferences, saved homes, alerts, chats, photos, notifications and push tokens, and cancels upcoming viewings. Past viewings and leads stay, linked to the now-blank account. Insight counts stay, without a name. **The privacy policy must say what is kept and why.** Google's rule allows data that is kept for a stated reason.

### 2.5 Store listing

| Item | Status |
|---|---|
| App name (≤ 30 characters), short description (≤ 80), full description (≤ 4000), in Arabic (main) and English | 📝 |
| Icon: 512 × 512 PNG | ✅ `assets/brand/icon-512.png` exists. Check that it has no transparency. |
| Feature graphic: 1024 × 500 | ❌ to make |
| Phone screenshots: at least 2 (Play shows up to 8). Use the same ones as the App Store, resized. | ❌ to make |
| Category: House & Home. Contact e-mail (required); website (the B1 site) | 📝 |

---

## 3. App Store

### 3.1 Account and build

| Item | Status | Notes |
|---|---|---|
| Apple Developer Program ($99 a year), as an individual or an organization (an organization needs D-U-N-S) | ⏸ | OPS-02 |
| Register the bundle ID `com.maqar.app` | 📝 ⚠️ | Check that it's free. If another team already owns it, the ID has to change before the first build. |
| Signing, provisioning profile, **Push Notifications capability and APNs key** (uploaded to Expo for Expo push) | ⏸ | OPS-02. `ios-ipa.yml` builds unsigned on purpose today. |
| Built with **Xcode 26 / iOS 26 SDK** (required for uploads since 2026-04-28) | ⚠️ | `macos-latest` should be on Xcode 26 by now. Print `xcodebuild -version` in the workflow to prove it. Uploads must also target iOS 13 or later; Expo SDK 58 targets much higher ✅. |
| Build number goes up on each upload | ⏸ | OPS-03 |
| **Export compliance** | ✅ fixed in Phase 20 (was ❌) | Not set, so every upload stops at "Missing Compliance". The app only uses HTTPS and the OS's own encryption, which is exempt. Set `ios.config.usesNonExemptEncryption: false` (this becomes `ITSAppUsesNonExemptEncryption = NO`). |
| **Privacy manifest** (`PrivacyInfo.xcprivacy`, "required reason" APIs) | ⚠️ | Expo SDK packages ship their own. A third-party native library without one (for example `react-native-maps` or async-storage) gets an **ITMS-91053** e-mail after upload. Add what it lists under `ios.privacyManifests` in `app.json`, then upload again. Do this on the first TestFlight upload, before sending for review. |
| iPad | ⚠️ | `supportsTablet: false` ✅, so no iPad screenshots are needed. But iPhone-only apps still run on iPads in compatibility mode, and reviewers sometimes test on an iPad. Open the app once on an iPad simulator to check nothing is cut off. |

### 3.2 iOS permission texts (purpose strings)

From the final `Info.plist`:

| Key | Text now | Used? | Fix |
|---|---|---|---|
| `NSPhotoLibraryUsageDescription` | "Maqar uses your photos only when you choose some to send in a chat with your sales advisor." | Yes | ✅ Good; Arabic and English texts in `locales/` (Phase 20). |
| `NSMotionUsageDescription` | "Allow $(PRODUCT_NAME) to access your device motion" | Yes, the 360° tour gyroscope | ✅ fixed in Phase 20 (was ❌) Too vague. Say what it's for, e.g. "Maqar uses motion so you can look around a 360° tour by moving your phone." Set it through the `expo-sensors` plugin (`motionPermission`). |
| `NSCalendarsUsageDescription`, `NSCalendarsFullAccessUsageDescription`, `NSRemindersUsageDescription`, `NSRemindersFullAccessUsageDescription` | Generic | **No** (`expo-calendar` is never imported) | ✅ fixed in Phase 20 (was ❌) Remove the `expo-calendar` package. Asking for calendar access and never using it is a 5.1.1 rejection. |
| `NSFaceIDUsageDescription` | Generic | **No** (`requireAuthentication` is never used) | ✅ fixed in Phase 20 (was ❌) Add the `expo-secure-store` plugin option `faceIDPermission: false`. |

The app's main language is Arabic, so add **Arabic** permission texts too. Use Expo's `locales` (`ios.infoPlist` per language), so an Arabic phone shows them in Arabic.

### 3.3 Review guidelines that apply to Maqar

| Guideline | What Apple checks | Status |
|---|---|---|
| 2.1 App completeness | A demo account in "App Review Information". Every feature works. No crashes. No placeholder content. | Demo accounts ✅ (kept on purpose). ⚠️ Listings: the demo listings use sample data and Unsplash photos. If reviewers see obviously fake listings, they may call it a demo app (2.1 / 2.3). Have some real or realistic listings live during review. |
| 2.3 Accurate metadata | Screenshots show the real app. The description matches the features. | 📝 |
| 4.2 Minimum functionality | More than a wrapped website. | ✅ Native app with search, chat, booking and a 360° tour |
| 4.8 Login services | "Sign in with Apple" is required **only** if third-party logins (Google, Facebook…) are offered. | ✅ E-mail and password only, so it isn't required |
| 5.1.1(i) Privacy policy | A URL in App Store Connect **and** a link inside the app. | ❌ B1. The Me screen has no privacy or terms links (contract §9 lists them as [Real]). |
| 5.1.1(ii) Don't force sign-up | Features that don't need an account must work without one. | ✅ Guests can browse |
| 5.1.1(v) Account deletion | Must be possible from inside the app, not just "e-mail us". | ✅ `DeleteAccountSheet`, which deletes the data straight away |
| 5.1.1 Purpose strings | Specific and accurate. | ❌ §3.2 |
| 1.2 User-generated content | Apps where users send content need: filtering, a report option, blocking, and published contact details. | ⚠️ Our chat is client ↔ Maqar staff only (no client-to-client), so the risk is low. Cheap insurance: let an agent **report or block** an abusive client in the chat, and put a support e-mail or WhatsApp in the Me screen. |
| 4.5.4 Push | Push must not be required to use the app, and must not be used for ads without consent. | ✅ Push is a switch the user turns on. Pushes are only reminders, chat and price alerts. |
| Age rating (new questionnaire, with 13+/16+/18+ levels) | Answer it in App Store Connect before submitting. | 📝 Messaging = yes, unrestricted web = no. The likely result is 13+ or 16+. |
| App Privacy ("nutrition label") | The same data as §2.4. Nothing is used for tracking. | 📝 Tracking = no, so **no App Tracking Transparency prompt** is needed ✅ |
| EU Digital Services Act trader status | Every account must declare it. A trader's address, phone and e-mail are shown on the EU store. | 📝 Either declare it, or don't sell in the EU (choose Egypt and the MENA countries in "Availability"). |

### 3.4 Listing

| Item | Status |
|---|---|
| Name (≤ 30 characters), subtitle (≤ 30), keywords (≤ 100), description, promotional text, in Arabic and English | 📝 |
| Screenshots: **6.9-inch iPhone**, 1320 × 2868 (or 1290 × 2796). Smaller iPhones are scaled from these. No iPad set (iPhone only). | ❌ to make |
| Support URL (required), marketing URL (optional), privacy policy URL (required) | ❌ B1 and B5 |
| Category: Lifestyle (or Business). Copyright line. Review notes in English that explain the roles: "clients sign up; agents and admins are Maqar staff". | 📝 |

---

## 4. Review readiness (both stores)

- **The server.** The API runs on the temporary server at `187-55-224-15.sslip.io`. It must stay up, with HTTPS valid, for the whole review: Apple takes about 1 to 2 days, Google's first review up to a week. If the API is down, the app shows errors and gets rejected under 2.1. No backups and no automatic deploys (⏸ OPS-04 and OPS-05) are fine for review. Just don't redeploy or reset the database while a review is in progress.
- **A real domain** is not required. But the privacy, deletion and support pages need public URLs, and an `sslip.io` address in a privacy policy looks unfinished. One small static page on a real domain (or on the free domain from the Hostinger plan, contract §4) serves all three.
- **Reviewer accounts.** Use a client demo account with saved homes, one chat and one upcoming viewing, so the reviewer sees the app working straight away. Give an agent account too if the staff side should be reviewed. Apple and Google both test from the US or EU, so check that sign-in and browsing work from outside Egypt (no IP blocks).
- **Phone checks** (⏸ QA-04): the pending push and on-device checks are scheduled after Phase 20. They must pass before submitting.

---

## 5. Fix list, in order

**Code: small, and can be done now (no deferred items needed):**
1. ✅ Done (Phase 20): Remove `expo-calendar`. Add `android.blockedPermissions` (`CAMERA`, `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`) and the `expo-secure-store` option `faceIDPermission: false`. Then rerun `expo config --type introspect` and check the result.
2. ✅ Done (Phase 20): Write a clear motion permission text in Arabic and English (the `expo-sensors` plugin), and add the Arabic photo text.
3. ✅ Done (Phase 20): Set `ios.config.usesNonExemptEncryption: false`.
4. Add privacy policy, terms and support / contact rows to the Me screen. They open the public pages in `expo-web-browser`, which is already installed.
5. Optional (1.2 insurance): agents can report or block a client in the chat.

**Web: one static page set:**
6. A privacy policy (AR/EN): what we collect (§2.4), why, who handles it (Expo push, Google/Apple push, Google Maps), what deletion removes and what it keeps, that chat photos are public by link, and a contact.
7. An account-deletion page (Maqar name, steps in the app, and a request form or an e-mail address), plus a support page.

**Store consoles (no code):**
8. The Play app content forms (§2.3, §2.4), the listing (§2.5), and the closed test with 12 testers for 14 days if the account is personal.
9. App Store Connect: App Privacy, age rating, trader status, review notes and demo account, screenshots (§3.4).

**Deferred items. Each blocks an upload when its time comes:**
10. OPS-01 Firebase file, OPS-02 Apple account, signing and APNs key, OPS-03 version and build numbers. Add the Google Maps key secret at the same time.
11. First TestFlight and Play internal-test uploads. Handle any ITMS-91053 (privacy manifest) e-mail and any Play 16 KB or permission warning **before** sending for review.

---

## Sources

- Google Play target API level: [Play Console help](https://support.google.com/googleplay/android-developer/answer/11926878), [developer.android.com](https://developer.android.com/google/play/requirements/target-sdk)
- New personal accounts, testing rule: [Play Console help](https://support.google.com/googleplay/android-developer/answer/14151465)
- Android developer verification: [Play help](https://support.google.com/android-developer-console/answer/16561738), [Android Developers Blog](https://android-developers.googleblog.com/2026/03/android-developer-verification-rolling-out-to-all-developers.html), [Help Net Security](https://www.helpnetsecurity.com/2026/06/19/android-developer-verification-rollout-markets/)
- Account deletion on Play: [Play Console help](https://support.google.com/googleplay/android-developer/answer/13327111)
- Photo and video permissions: [Play Console help](https://support.google.com/googleplay/android-developer/answer/14115180)
- 16 KB pages: [developer.android.com](https://developer.android.com/16kb-page-size), [Expo FYI](https://github.com/expo/fyi/blob/main/android-16kb-page-sizes.md)
- Apple SDK minimum: [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/), [Expo blog](https://expo.dev/blog/app-store-connect-minimum-sdk-26)
- Apple account deletion: [Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app), [guideline help](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion)
- App Review guidelines, demo accounts, purpose strings: [App Review](https://developer.apple.com/distribute/app-review), [Expo: common rejections](https://expo.dev/articles/shipping-to-the-app-stores/app-store-rejection-reasons), [UGC forum thread](https://developer.apple.com/forums/thread/807358)
- Privacy manifest: [Expo guide](https://docs.expo.dev/guides/apple-privacy/)
- Age ratings: [9to5Mac](https://9to5mac.com/2025/07/24/apple-notifies-developers-of-new-app-store-age-rating-system/), [MacRumors](https://www.macrumors.com/2025/07/25/apple-overhauls-app-store-age-ratings/)
- Screenshots: [Adalo guide](https://studio.adalo.com/blog/app-store-screenshot-sizes-2026)
- EU trader status: [MacRumors](https://www.macrumors.com/2024/10/17/developers-eu-app-store-trader-requirements/)
- Expo permissions, `blockedPermissions`: [Expo docs](https://docs.expo.dev/guides/permissions/)
