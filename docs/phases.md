# Maqar: build phases

This file is the build plan. **One phase is one feature, built as a vertical slice**: database, API, mobile screens and tests together, finished and green before the next phase starts.

The scope of every phase comes from [project-contract.md](project-contract.md); `§` numbers point to its sections. If a phase needs something the contract does not have, add it to the contract first.

## Rules for every phase

**Definition of done ("full green"):**

1. **Database (when the phase changes the schema):** the Drizzle schema has been changed and a migration generated (`db:generate`). The migration runs on an empty database and on the previous one.
2. **API:**
   - Endpoints work as listed, with role guards and validated input.
   - OpenAPI docs are updated.
   - Unit tests cover every business rule.
   - e2e tests cover the main flow, including the forbidden and invalid cases.
3. **Mobile:**
   - Screens match the demo (`apps/demo`) or improve on it.
   - Arabic RTL and English LTR both work, in light and dark.
   - Loading, empty and error states are designed.
   - Data comes from the real API, not sample data.
4. **Green:** `pnpm build lint typecheck test test:e2e` passes at the repo root with no errors.
5. **Tests, written first, only where they matter.** Every test starts red and is seen to fail before the code is written. Test business rules, formatters, auth and role guards, data rules and each screen's main flow and key states. Do not test plumbing (framework wiring, trivial hooks, health internals) just to have more tests.
   - All tests live in `test/` next to `src/`, sorted by kind: API `test/unit` and `test/e2e`; mobile `test/unit` and `test/ui`; shared helpers in `test/utils`.
6. **Checked by hand:** the flow is run end to end on a phone or emulator against a local API and MySQL.
7. **Docs:** the phase's status is updated here. Contract items that moved from [Open] to decided are updated in the contract, with a change log line.
8. **Commit:** each phase is its own commit, pushed to `main`.

**Code layout:**
- API: one folder per feature under `src/modules/<feature>/`, holding its controller (router), service, repository, DTOs and Nest module. Shared infrastructure goes in `src/core` (config, database) and `src/common` (decorators, guards).
- Mobile: one folder per feature under `src/features/<feature>/` with `api/`, `hooks/`, `components/` and `screens/`. `src/app` holds routes only, `src/core` holds app-wide parts (API client, i18n, theme, settings, providers, navigation), and `src/components` holds shared UI.

**Order:**
- Phases run in order, because later phases build on earlier ones.
- A phase blocked by an [Open] decision (contract §16.1) cannot start until that decision is made. Each phase's "Decide first" line lists them.
- The one exception is Phase 2: it only waits for the server to be bought, so Phase 3 onwards can be built first and Phase 2 is done as soon as the server exists.
- Seed data for areas, agents and sample listings comes from the demo's `src/lib/data.ts`. That way every phase can be tried with realistic data.

**Status values:** ⬜ not started, 🟨 in progress, ✅ done.

## Overview

| # | Phase | Status | Decide first (§16.1) |
|---|---|---|---|
| 0 | Foundation | 🟨 | none (database decided) |
| 1 | Accounts and sign-in | 🟨 | ~~1, 9~~ decided |
| 2 | Production server and deploys | 🟨 | ~~7~~ decided; running on a temporary server for now |
| 3 | Browse listings | 🟨 | ~~2~~ decided |
| 4 | Property page | 🟨 | ~~4~~ decided |
| 5 | Search, filters and sort | 🟨 | |
| 6 | Preferences and smart picks | 🟨 | |
| 7 | Saved homes | 🟨 | |
| 8 | Installment calculator | 🟨 | |
| 9 | Compare two homes | 🟨 | |
| 10 | 360° virtual tour | 🟨 | ~~2~~ decided |
| 11 | Notifications and push | 🟨 | ~~3, 13~~ decided |
| 12 | Price drop alerts | 🟨 | |
| 13 | Viewing booking | 🟨 | ~~5, 8~~ decided |
| 14 | Viewing reminders | 🟨 | ~~13~~ decided |
| 15 | Sales agent app | 🟨 | |
| 16 | Live chat | 🟨 | ~~12~~ decided |
| 17 | Admin listings | 🟨 | decided |
| 18 | Admin tools | 🟨 | ~~6~~ decided |
| 19 | Listing insights (for admins) | ✅ | decided |
| 20 | Release | 🟨 | ~~14~~ out of scope |
| 21 | Admin: 360° tours | 🟨 | decided |
| 22 | Admin: clients and admins | 🟨 | decided |
| 23 | Admin: viewings | 🟨 | decided |
| 24 | Admin: chats, report and block | 🟨 | decided |
| 25 | Admin: overview | 🟨 | decided |

Phases 21–25 were added on 2026-11-12 after a review of the admin tools; they are built before Phase 20's store submission.

---

## Phase 0: Foundation

The skeleton every feature plugs into. The only feature in this phase is that the app shows it is connected to the API.

**API**
- `@nestjs/config` loads the **root** `.env` (`envFilePath: ../../.env`), and env vars are validated at start-up.
- A Drizzle MySQL connection module.
- `/v1` prefix, global validation pipe, a standard error shape, and CORS.
- Swagger at `/docs`.
- `GET /v1/health` reports whether the API and the database are up.

**Database**
- Local MySQL 8.0 (`localhost:3306`, database `maqar`; already created and connected).
- First migration and the seed script (`db:seed`): moved to Phase 1, where the first tables (users) arrive. An empty schema has nothing to migrate.

**Shared**
- `packages/shared` holds the types, enums and constants used by both the API and the app: categories, property types, finishing, features, statuses, stages, and notification kinds (contract §13).

**Mobile**
- Expo Router root layout and a font loader for Readex Pro.
- Theme tokens for light and dark (contract §6.2) and the logo.
- i18n with Arabic as the default, RTL handling, digit, money, date and percent formatting, and the language setting (contract §7).
- An API client whose base URL (`EXPO_PUBLIC_API_URL`) comes from the **root** `.env`. Expo only reads `.env` from its own folder, so the root file is loaded in `app.config.ts` or by setting the Metro env.
- Data fetching with React Query.
- Splash screen.
- Empty role-based tab layouts (contract §12).
- A toast component.

**Tests**
- API: health e2e.
- Shared: unit tests for the formatters, covering Arabic digits, `٪` and the money format.

**Done when** the app launches in Arabic and English, in light and dark, and shows that the API is healthy.

**Status (2026-11-08): in progress.** Code and tests are green; only the phone check (rule 6) is left. Notes:
- Layout direction is set on the root view from the language setting, so switching is instant.
- Navigation themes come from `expo-router` (SDK 58 bundles React Navigation).
- Checked by hand on a phone: still to do, since no emulator is installed on this PC.

---

## Phase 1: Accounts and sign-in

**Decided:** email + password now, Google OAuth later (§16.1 #1); one role per account (#9).

Contract §2 and §8.14.

**Database:** `users`, `agents`, plus sessions or refresh tokens.

**API**
- Sign-up, sign-in, refresh and sign-out.
- `GET/PATCH /me` and `DELETE /me`.
- A role guard and a `@Roles()` decorator.
- Rate limits on the auth routes.
- Seed: the 4 demo agents and 1 admin.

**Mobile**
- Sign-in and sign-up screens.
- Guest mode, with a sign-in prompt at the moment an account is needed.
- The Me screen: name, language, dark mode, edit profile, sign out, delete account, app version.
- After sign-in, the tab bar matches the user's role.

**Tests**
- Each role's guard: allowed and denied.
- Token refresh.
- Account deletion.

**Done when** a client, an owner and an agent can each sign in and land on their own home screen.

**Status (2026-11-08): in progress.** Code and tests are green; only the phone check (rule 6) is left. Notes:
- The first migration (`users`, `agents`, `refresh_tokens`) and `pnpm --filter @maqar/api db:seed` arrived here. The seed adds the 4 demo agents, 1 admin, and a demo client and owner (`client@maqar.app`, `owner@maqar.app`), all with `SEED_PASSWORD` from `.env`.
- Mobile keeps the refresh token in the phone's secure storage and the access token in memory. A 401 triggers one shared refresh and a retry; a failed refresh signs the user out.
- An admin lands on `/admin`, which shows their account until the admin tools are decided (§16.1 #6).
- Checked by hand: every seeded role signed in against the running API and got its own profile. The phone run is for the owner to do in Expo Go.

---

## Phase 2: Production server and deploys

**Decided (§16.1 #7):** Maqar gets its own new Hostinger KVM2 VPS (2 CPUs, 8 GB memory, about 100 GB disk). Nothing else runs on it. The domain is the free one that comes with the Hostinger plan; any domain works, because the HTTPS certificate is free from Let's Encrypt.

**Waits for:** the server to be bought. Until then, Phase 3 onwards is built and tested locally.

Contract §4 (production database) and §5 (production server rules).

**Server**
- Ubuntu, Docker and Docker Compose, a firewall that allows only SSH, 80 and 443, and SSH key sign-in only.
- DNS: `api.<domain>` points at the server.
- nginx on the server (not in Docker): HTTPS with a Let's Encrypt certificate that renews itself, proxies `/v1` to the API container, and serves the property images from the uploads folder with long cache headers. Run `nginx -t` before every reload.

**Docker**
- `Dockerfile.api` at the repo root: a multi-stage build that ships only the built API and its production packages.
- `docker-compose.yml`: the `api` and `mysql` services. MySQL data and the uploaded images live in named volumes, so a new deploy never loses them.
- Configuration comes from **`.env.production`** on the server (git-ignored). `.env.production.example` in the repo lists every variable.

**Every deploy (a GitHub Action on push to `main`, after the checks are green)**
1. Back up the database (`mysqldump`) and the images folder into `/root/maqar-backups`, named by date and commit.
2. Build the new API image.
3. Run the database migrations (`db:migrate`) against the production database. If they fail, the deploy stops and the old API keeps running.
4. Start the new API and wait for `GET /v1/health` to answer. If it does not, roll back to the previous image.

**Backups:** besides the one before each deploy, a daily backup of the database and the images, keeping the last 14 days. A restore is tried once on the server so we know the backups work.

**Mobile:** release builds use `EXPO_PUBLIC_API_URL=https://api.<domain>/v1`, so plain `http://` is no longer allowed in them.

**Tests:** no new code tests. The deploy itself checks the health endpoint, and a smoke check signs in over HTTPS.

**Done when** a push to `main` deploys by itself, the app signs in against `https://api.<domain>` on mobile data (not the home Wi-Fi), and a backup has been restored once.

**Status (2026-11-09): in progress, on a temporary server.** The API and MySQL run on `187.55.224.15` at `https://187-55-224-15.sslip.io`, so testing does not need this PC. It differs from the plan above until the real server exists:
- The server is shared with another live project (minikoshk), so Maqar only adds its own parts: compose project `maqar`, port `127.0.0.1:4010`, capped memory, builds at half a CPU, and the nginx site `zz-maqar`. That name keeps it after the other site, which stays the default for unknown hosts. HTTP/2 stays off because it is set per port.
- No domain: `sslip.io` gives the IP a name, with a real Let's Encrypt certificate.
- No backups, by decision, because the server is temporary and holds only demo data.
- Deploys are by hand: `sh deploy/deploy.sh` makes the server's Git clone build the exact commit on `origin/main`, migrate, start and health-check, rolling back if the new API is not healthy. The nightly image clean-up on this server can remove an older image, so a rollback may not always have one to go to.
- The seeded demo accounts are test data, with a random password in `/root/maqar/.env.production` on the server. Remove them before a real release.
- Behind nginx the API reads the client's address from the proxy (`TRUST_PROXY_HOPS=1`), so the sign-in limit stays per client.
- Still to do on the real server: everything above, plus the deploy on push, backups and a restore test.

---

## Phase 3: Browse listings

**Decided (§16.1 #2):** images are stored on the server's disk (an uploads volume) and served by nginx; on the PC they go to a local, git-ignored `uploads/` folder that the API serves in development. Uploads are resized and compressed with `sharp`, because the disk is shared with the database.

Contract §8.2 (Home) and §13 (areas, properties, property_features, property_images).

**Database:** `areas`, `properties`, `property_features`, `property_images`. The seed covers the 8 areas and 16 listings from the demo.

**API**
- `GET /areas`.
- `GET /properties`: paged, filtered by category, newest first. Only approved listings are returned.

**Mobile**
- The Home screen: headline, a search entry (which opens Explore), category shortcuts, Browse by area, New launches on installments.
- The property card.
- A plain Explore list with the category tabs.

**Tests**
- Only approved listings are public.
- Paging.
- Category filter.

**Done when** Home and Explore show real listings from MySQL with their photos.

**Status (2026-11-09): in progress.** Code and tests are green; only the phone check (rule 6) is left. Notes:
- `GET /v1/areas` and `GET /v1/properties` (`category`, `area`, `page`, `limit` up to 50; approved only, newest first). The area filter was added here so the Home area chips open a filtered Explore; the other filters stay in Phase 5.
- Migration `0001` adds `areas`, `properties`, `property_features` and `property_images`. `db:seed` adds the 8 areas and 16 listings and copies the demo photos to `apps/api/uploads/seed` (git-ignored). Photos are stored as paths (`/uploads/...`); the app puts them on the API host.
- The dev API serves `UPLOADS_DIR` at `/uploads` with `Cross-Origin-Resource-Policy: cross-origin` (needed by the web preview). In production nginx serves that folder (Phase 2).
- Mobile: Home (headline, search entry, category shortcuts, Browse by area, New launches on installments), Explore (category tabs, area chip, infinite list, pull to refresh, loading, empty and error states) and the property card. Cards open `/property/[id]`, a placeholder until Phase 4.
- The installment formula moved from `store-release` into `packages/shared` on `main` (the card shows the monthly payment).
- Home no longer shows the Phase 0 API status widget (its real data shows the connection), so the health feature was removed from the app. The API keeps `GET /v1/health`.
- Fixed: Arabic tab labels were cut off when they sit under the icons (narrow screens), and the dark-mode switch thumb sat outside its track in Arabic on the web.
- Checked by hand in the web preview (390 px wide) against the local API: Home, Explore by category, Arabic, dark mode. The phone run is for the owner to do in Expo Go.

---

## Phase 4: Property page

**Decided (§16.1 #4):** `react-native-maps`; directions open the phone's maps app.

Contract §8.5.

**API**
- `GET /properties/:id`, including the agent profile, images and features.
- `GET /properties/:id/similar`.
- Each view is counted.

**Mobile**
- The full property page:
  - gallery
  - price and price per m²
  - key facts
  - description
  - amenities
  - the named sales advisor card, with a call action (chat comes in phase 16)
  - map
  - directions
  - share
  - similar homes
- The tab bar is hidden on this screen.

**Tests**
- 404 for listings that are missing or not approved.
- The view counter.
- The similar-homes rules.

**Done when** every listing opens with all of its sections working in both languages.

**Status (2026-11-09): in progress.** Code and tests are green; only the phone check (rule 6) is left. Notes:
- `GET /v1/properties/:id` (photos, amenities, advisor, location; each request counts a view) and `GET /v1/properties/:id/similar` (up to 6: same category, same area first, then same type, then the closest price). Missing or unapproved listings are 404; a non-numeric id is 400.
- Migration `0002` adds `lat` and `lng` (they were in the contract but missing from Phase 3). The seed places each demo listing near its area's centre, and fills in listings seeded before.
- Mobile: the property page at `/property/[id]` (outside the tabs, so no tab bar) with gallery, price and price per m², old price and drop, key facts, views and days listed, the advisor card with Call, description and maintenance, amenities, a still map with Directions (opens Apple Maps or Google Maps), share, and similar homes. Loading, not-found and error states.
- Not in this phase: the interested count (it needs chats, bookings and alerts), save, price alert, compare, the 360° tour, the built-in calculator, chat and booking. Each arrives with its phase.
- `react-native-maps` works in Expo Go as is. Android store builds need `GOOGLE_MAPS_API_KEY` (a free key restricted to the app); the APK workflow reads it from a repo secret, and without it the map is empty in that build. The web preview shows the coordinates instead of a map.
- Checked by hand in the web preview (390 px wide) against the local API: every section in Arabic and dark mode. The phone run is for the owner to do in Expo Go.

---

## Phase 5: Search, filters and sort

Contract §8.4.

**API:** `GET /properties` gains:
- free-text search
- price and size ranges
- multi-select type, beds, baths, area, delivery, finishing and amenities
- quick filters: tour, plan, ready, dropped
- sort: low, high, newest
- histogram counts for the price and size sliders

**Mobile**
- Explore search.
- Quick filter chips.
- The filter sheet: two-thumb range sliders with histograms and typed min and max, plus multi-select groups.
- Active filter chips and "clear all".
- The sort sheet.
- The price scale follows the category.

**Tests:** each filter and combinations of them, the price scale for each category, the sorts, and the histogram counts.

**Done when** every filter in the demo works against the API and the result counts match.

**Status (2026-11-09): in progress.** Code and tests are green; only the phone check (rule 6) is left. Notes:
- `GET /v1/properties` takes `q`, `minPrice`/`maxPrice`, `minSize`/`maxSize`, `type`, `beds` (5 means 5 or more), `baths` (4 means 4 or more), `area`, `delivery` (`ready` or a year), `finishing`, `feature` (all must be there), `plan`, `ready`, `dropped` and `sort` (`newest`, `low`, `high`). Lists are comma-separated or repeated. A minimum above its maximum, unknown values and a search over 100 characters are 400.
- Search matches every word against title, compound, area and developer in both languages, and unit type names ("شاليه", "villa"). `%` and `_` are plain text.
- With All, a price filter limits the list to sale and project listings (contract §8.4). The price scale per category lives in `packages/shared` (`priceScale`), shared by the API and the app.
- `GET /v1/properties/facets` (same filters) gives the filter sheet its numbers: the match count for "Show N homes", 28-bar price and size histograms (each leaves out its own range, so the bars stay still while a thumb moves) and the delivery years of the category.
- Mobile: search (sent once typing pauses), quick chips, the filter sheet (it edits a copy; closing without "Show" keeps the old filters), typed min and max in Arabic or Latin digits, removable active chips, "clear filters", the sort sheet, and an empty state that offers to clear. The two-thumb slider is mirrored for Arabic and its thumbs are adjustable controls for screen readers.
- Moved: the 360° tour quick filter goes to Phase 10, which adds `tour_rooms`. "Best match" sort stays in Phase 6.
- Checked by hand in the web preview (390 px wide) against the local API: Rent sheet (monthly scale, histograms mirrored in Arabic, dragging the minimum to 50,000 leaves 1 home), the applied chip and badge, and search plus sheet counts in English and light mode. React Native Web ignores the `direction` style, so the slider relies on rows flipping by themselves and places its thumbs in code.

---

## Phase 6: Preferences and smart picks

Contract §8.1 and §8.3.

**Database:** `client_prefs`.

**API**
- `PUT /me/prefs`.
- `matchScore` on the server, with the exact rules from §8.3.
- Sort by match in `GET /properties`.
- `GET /properties/recommended`, which includes the reasons.

**Mobile**
- The onboarding steps after sign-up, which can be reopened from Me.
- "Picked for you" on Home, with match % and reasons.
- "Best match" sort in Explore.

**Tests:** the score rules (each weight, the clamp to 32–99, the rent and stay conversions) and that the reasons are correct.

**Done when** changing your preferences changes the picks and the match % the same way the demo does.

**Status (2026-11-09): in progress.** Code and tests are green; only the phone check (rule 6) is left. Notes:
- `client_prefs` holds one row per client (migration `0003`). `PUT /v1/me/prefs` replaces it whole and is for clients only; unknown areas are 400. `GET /v1/me` and the auth responses carry `prefs` for clients (`null` before onboarding). Deleting an account deletes its row.
- The score rules live in `packages/shared` (`matchScore`). The server also scores in SQL with the same constants, so `sort=match` can be ordered and paged; the e2e tests compare the two on every seed listing.
- `GET /v1/properties?sort=match` and `GET /v1/properties/recommended` (the top 6) need a signed-in client, and their cards carry `match: { score, reasons }`. A client who has no saved preferences is scored with the demo's defaults. Public routes still read a valid token; a missing or bad one means a guest.
- Added beyond the plan: `GET /v1/properties/match-count`, the live "N homes match you 70% or more" on the last onboarding step, as in the demo.
- Mobile: a new client goes from sign-up to `/onboarding`; Me → "Edit your preferences" reopens it from the saved values. The contract's seven questions fit in five screens: name and purpose, budget, areas, unit types, then bedrooms and must-haves. "Picked for you" on Home shows match % and reasons, guests get an invitation to sign up instead, and "Best match" joins the sort sheet for clients. The budget slider is mirrored for Arabic.
- The +2 for a 360° tour scores 0 until Phase 10 brings the tour data.
- Checked by hand in the web preview (390 px wide) against the local API: sign-up through all the steps, the slider in both directions, picks changing after editing preferences, See all opening best match, in English light and Arabic dark. `expo-secure-store` has no web version, so sign-in cannot finish on web; for this check only, the test browser swapped it for `localStorage` while loading the bundle. Nothing in the repo changed for that, and phones use the real store.

---

## Phase 7: Saved homes

Contract §8.9 (saving part).

**Database:** `favorites`.

**API:** `GET /favorites` and `PUT/DELETE /favorites/:propertyId`.

**Mobile**
- The heart on cards and on the property page, updated straight away on screen.
- The Saved tab with its empty state.
- Guests are asked to sign in.

**Tests:** saving twice does nothing extra, the list belongs to its owner only, and guests are refused.

**Done when** saved homes stay saved across devices and after reinstalling.

**Status (2026-11-09): in progress.** Code and tests are green; only the phone check (rule 6) is left. Notes:
- `favorites` is keyed by client and listing (migration `0004`), with millisecond times so quick saves stay in order. `GET /v1/favorites` returns every saved home as cards, most recently saved first, with no paging, because the hearts need the whole list. `PUT` and `DELETE` answer 204 and do nothing extra when repeated. Deleting an account deletes its rows.
- A listing that is not approved cannot be saved (404). One that stops being approved leaves the list but keeps its row, so it comes back if it is approved again; it can still be removed meanwhile.
- Mobile: the heart is on every card and on the property page, and changes on screen before the server answers. If the server refuses, it goes back and a toast says so. Quick taps reach the server one at a time, in order. Guests get the sign-in prompt; owners, agents and admins see no heart. The cached list is kept per account.
- The Saved tab shows the list, an empty state leading to Explore, a retry when it cannot load, and a sign-in invitation for guests. The Price alerts tab and the bell arrive with Phase 12, so the empty state does not mention following prices yet.

---

## Phase 8: Installment calculator

Contract §8.11.

**API:** the listing's plan fields (`plan_down_pct` and `plan_years`) are included in the property response. The formula lives in `packages/shared`, so the app and any server use give the same numbers.

**Mobile**
- The standalone `/calculator` screen.
- The calculator built into the property page, filled with the listing's plan.
- The plan line "X% down over Y years".

**Tests:** unit tests for the formula: 0% and with interest, monthly and quarterly, against known values.

**Done when** the calculator gives the same results as the demo for the same inputs.

**Status (2026-11-09): in progress.** Code and tests are green; only the phone check (rule 6) is left. Notes:
- The formula is in `packages/shared`, and it gave the same numbers as the demo's on every combination tried (price, down payment, years, interest, monthly and quarterly). The API already sent each listing's `plan`, so this phase changed nothing on the server.
- `/calculator` opens from Home and from Me (guests and clients), and starts like the demo: 8 million, 10% down, 6 years. The property page has the calculator for homes to buy (sale and project), not rent or stays, as in the demo. It starts from the listing's plan, or 20% over 5 years with none, and shows the plan line.
- Interest is typed in Arabic or Latin digits and capped at 40%. The demo's animated number is left out.
- The `store-release` branch keeps its own smaller screen (0%, monthly) for the store-approval app.

---

## Phase 9: Compare two homes

Contract §8.10.

**API:** none new. It uses `GET /properties/:id`. Optionally add `GET /properties?ids=`.

**Mobile**
- The compare button on cards and on the property page.
- At most 2 homes, with replace-the-oldest and a toast.
- The compare tray above the tab bar.
- The compare screen: every row from §8.10, the better value marked, and the verdict.
- The compare list is kept on the device.

**Tests:** the rule for which value is better and the verdict (unit tests in shared).

**Done when** comparing any two seed homes matches the demo.

**Status (2026-11-09): in progress.** Code and tests are green; only the phone check (rule 6) is left. Notes:
- The rules are in `packages/shared` (`winner`, `compareMonthly`, `compareVerdict`). Checked against the demo's own code on all 240 ordered pairs of its 16 homes, in Arabic and English: every row's better value and every verdict line match. The only differences are invisible spacing characters, "K" where the demo's browser writes "k", and the monthly difference rounded to whole pounds where the demo showed fractions.
- Added beyond the plan: `GET /v1/properties/compare?ids=4,9` (one or two ids, public). It returns the property page's details in the order asked, leaves out missing or unapproved homes, and counts no view. `GET /properties/:id` counts a view on every call, so using it would have inflated views each time the compare screen opened.
- Mobile: the scale button sits next to the heart on every card and on the property page, for guests and clients (not owners or agents). The third pick replaces the oldest, with the demo's toasts; the "ready" toast opens `/compare`. The tray sits above the client tab bar. `/compare` has the column heads with Change and Remove, a "Pick a home" sheet (search; saved homes first, then the other home's category), the verdict, and the rows. The better value is tinted gold with a crown, and screen readers hear "better". Signed-in clients also get the "better fit" line from their match score. The list is kept on the device (`maqar.compare`), and homes no longer listed drop out of it.
- Left for later phases: the "interested" demand row (12, 13 and 16 bring follows, bookings and chats), the 360° tour amenity row (10), the "Book viewing" buttons (13), and lifting the chat button above the tray (16).
- Checked by hand in the web preview (390 px wide, Arabic dark) against the local API: picking from Explore cards, the tray, and the compare screen.

---

## Phase 10: 360° virtual tour

**Decided (§16.1 #2):** panoramas are stored like photos, on the server's disk.

Contract §8.6.

**Database:** `tour_rooms`. The seed has the 6 demo panoramas.

**API:** the tour rooms are included in `GET /properties/:id`. `GET /properties` and its facets gain the `tour` quick filter (moved here from Phase 5, which had no tour data yet).

**Mobile:** the "360° tour" quick chip on Explore.

**Match score:** turn on the +2 for a tour, in both `matchScoreSql` and the `tour` value passed to `matchScore` (both are off until this phase).

**Mobile**
- A full-screen panorama viewer: drag with inertia, pinch zoom, gyroscope, hotspots, room list, cross-fade.
- Rooms load one at a time.

**Owner role removed (2026-11-09 decision).** Owners deal with Maqar directly, and admins create and manage every listing. In this phase:
- The `owner` role goes from `packages/shared`, sign-up (clients only), the API's role checks, the seed (`owner@maqar.app`) and any owner accounts in the database (a migration moves the role enum).
- The owner tab area in the app (`src/app/owner`) and its screens go.
- Anything built for owners that admins can use moves to the admin side instead of being deleted.

**Tests:** API tests for the room order, and that sign-up refuses the `owner` role. On a real device, check the frame rate and the gyroscope.

**Done when** the tour runs smoothly on a mid-range Android phone and on an iPhone, and no owner role is left in the app, the API or the database.

**Status (2026-11-09): in progress.** Code and tests are green; the phone check (rule 6) is left, and it matters most here: the frame rate and the gyroscope can only be judged on real phones. Notes:
- Database (migration `0005`): `tour_rooms` (name in both languages, the panorama's path, order). The seed copies the demo's 6 panoramas (4096×2048) to `uploads/seed/pano` and gives the 13 demo homes that have a tour the demo's rooms; re-running the seed adds tours to homes seeded before.
- API: `GET /properties/:id` (and `/properties/compare`) carry `tourRooms`; every card carries `tour` (has one). `GET /properties` and its facets take `tour=true|false`. The match score's +2 for a tour is on, in SQL and in the shared rules, and the e2e test still finds them equal on every listing.
- Mobile: a "360° tour" button over the gallery on homes that have one opens `/property/:id/tour` (the property route moved to `property/[id]/index.tsx`). The viewer draws with expo-gl and a small shader of its own instead of the demo's three.js: each pixel reads the panorama in its direction, so there is no sphere mesh, and it runs the same on phones and the web. Drag with inertia, pinch zoom, the gyroscope (expo-sensors, asks permission; the button only shows when the phone has the sensor), white dots that lead to the other rooms (placed as in the demo), a cross-fade between rooms, the room list, the compass and the first-time hint. Rooms load one at a time. It stops drawing when nothing moves, to save the battery.
- The "360° tour" quick chip is first on Explore, as in the demo. Compare gained its "360° tour" amenity row, and the "better fit" line counts the tour.
- Left out: the demo's "Like it? Book a real viewing" button waits for booking (Phase 13); the demo's fullscreen button is web-only.
- Owner role removed: `owner` is gone from `packages/shared`, sign-up (clients only; `role` is now optional and only `client` is accepted, so older apps still work), the seed, the role guards' tests, and the database. Migration `0005` deletes owner accounts (their sessions, saved homes and preferences go with them) before removing `owner` from the role list, and drops `properties.owner_id`. In the app, the owner tabs are gone, sign-up has no role choice, and admins get their own tab bar (Listings and Add a property, built in Phase 17, plus Me), which is where the owner's planned screens moved.
- Checked by hand in the web preview (390 px, Arabic) against the local API: the button, the panorama, dragging, the dots, changing rooms and the cross-fade. The test browser draws without a GPU, so its frame rate says nothing about phones.
- Deployed 2026-11-09 (`e0664c1`): migration `0005` ran, and the seed was run again with the demo's `img` and `pano` folders mounted (`docker compose run --rm --no-deps -T -v /root/maqar/apps/demo/public/img:/app/apps/demo/public/img:ro -v /root/maqar/apps/demo/public/pano:/app/apps/demo/public/pano:ro api node dist/core/db/seed.js`), which copied the 6 panoramas to `/srv/maqar/uploads/seed/pano` and added the tour rooms. 13 homes have tours on the server.

---

## Phase 11: Notifications and push

**Decide first:** the push provider (§16.1 #3) and the background jobs and queue (#13).

Contract §8.13.

**Database:** `notifications`, `push_tokens`.

**API**
- A notifications service: other modules call it, and it saves the notification and sends the push.
- `GET /notifications`, read-all, and read one.
- `POST /me/push-tokens`.
- The `push_enabled` setting is respected.

**Mobile**
- The notifications inbox: unread dots, "mark all read", and tap to open the target.
- The bell badge on Home.
- The Alerts tab for owners and agents.
- The phone notifications switch in Me, which can be turned on **and** off, with the permission flow.
- Push deep links.

**Tests:** a notification is created and sent; no push when the switch is off; read state.

**Done when** a test notification arrives in the app and as a phone push, and tapping it opens the right screen.

**Status (2026-11-09): in progress.** Code and tests are green. The phone check (rule 6) is left, and real pushes first need two things only the project owner can set up (see the last note). Notes:
- Database (migration `0006`): `notifications` (text in both languages, `href`, `read_at`) and `push_tokens` (one row per phone; the token is unique, so it moves to whoever signs in on that phone). Deleting an account deletes both.
- API: `NotificationsService.notify(userId, …)` is the one way other modules tell someone something: it saves the inbox entry, then, unless the account turned phone notifications off, pushes it to every phone of the account in the account's language, with `{ id, href }` as data and the unread count as the badge. Expo's push service is called over HTTPS (`EXPO_ACCESS_TOKEN` is optional, for Expo's "enhanced security"); a token Expo reports as `DeviceNotRegistered` is deleted, and a failed push is logged, never thrown. The e2e tests swap the sender for one that records messages. Routes: `GET /notifications` (newest first, at most 50, plus the unread count), `POST /notifications/read-all`, `POST /notifications/:id/read`, `POST /notifications/test` (a "Notifications are on" entry for yourself), `POST` and `DELETE /me/push-tokens`.
- Kinds: `approval` is gone with the owner role; `system` is new, for Maqar's own messages such as the test one. Nothing else sends notifications yet: price drops come in Phase 12, bookings and reminders in 13, chat in 14.
- Mobile: the inbox at `/notifications` (the bell on Home, with a dot while something is unread) and as the agent's Alerts tab (with a count badge). Unread entries are tinted with a dot; "Mark all read"; a tap marks it read and opens its screen; pull to refresh; designed empty, guest and error states. It refreshes every minute while the app is open, when the app comes back to the front, and when a push lands. Me has the "Phone notifications" switch: on asks the phone (once), sends this phone's token, saves the choice and sends the test notification; off keeps the permission but stops pushes to the account; when the phone blocks them it says so and links to the phone's settings. Tapping a push opens its screen, also when the tap starts the app, and only for the app's own paths. Signing out removes the phone's token first, and every sign-in sends it (even with the switch off), so it always belongs to whoever is signed in. The app icon's badge follows the unread count.
- Not on the web: phone pushes, and the switch says "Not available on this device". Found while checking: signing in has never worked in the web preview, because `expo-secure-store` has no web version (not new; earlier previews ran as a guest). The inbox was checked by the UI tests instead.
- Expo project: `@alzatary/maqar` (https://expo.dev/accounts/alzatary/projects/maqar), created 2026-11-09; its id is in `apps/mobile/app.json` (`extra.eas.projectId`).
- ⚑ **Accounts needed before a real push can arrive (owner's action):**
  - **Android: a Firebase project** (free, any Google account; no Play Console needed). Add an Android app with package `com.maqar.app`, download its `google-services.json` (path in `GOOGLE_SERVICES_JSON`), and upload its FCM v1 service-account key to the Expo project (Credentials → Android). Hand-installed APKs then get pushes.
  - **iOS: the Apple Developer Program** ($99 a year). Apple sends every iPhone push, and the APNs key can only be made in a paid account; a free Apple ID cannot receive pushes. Upload the key to the Expo project (Credentials → iOS). The store publisher's account can be used if they have one.
  - **Store accounts are for publishing only:** the Google Play Console ($25 once) for the Play Store, and the same Apple membership for the App Store and TestFlight.
  - Expo Go cannot receive pushes on Android since SDK 53, so the check needs a build. Without these the app still runs; the switch then says it could not turn notifications on.
- Deployed 2026-11-09 (`e0664c1`, migration `0006`). GitHub Actions builds are not run yet (kept in progress).

---

## Phase 12: Price drop alerts

Contract §8.9 (alerts part).

**Database:** `price_alerts`, `price_history`.

**API**
- `GET /alerts` and `PUT/DELETE /alerts/:propertyId`.
- Every price change writes to price history. A price **drop** notifies everyone following that home.
- `old_price` and the drop % are included in property responses.
- The "price dropped" quick filter works.

**Mobile**
- The "follow price" bell on the property page and in Saved.
- The old price struck through, plus the drop % badge.
- The "Price drops" section on Home.

**Tests:** a drop notifies followers; a price rise notifies no one; unfollowing stops alerts.

**Done when** lowering a price notifies everyone who follows that home.

**Status (2026-11-09): in progress.** Code and tests are green; the phone check (rule 6) is left. Deployed 2026-11-09 (`8a76a85`, migration `0007`, after the CodeRabbit fixes). Notes:
- Database (migration `0007`): `price_alerts` (client, home) and `price_history` (old and new price, who changed it, when). Deleting an account deletes its alerts; the history keeps the change with `changed_by` emptied.
- API: `GET /alerts` (followed homes as cards, newest first), `PUT/DELETE /alerts/:propertyId` (clients only; a missing or unapproved home is 404). `PATCH /admin/listings/:id/price` (admins only) is the one way a price changes for now; the admin listing tools in Phase 17 build on the same `PricesService.changePrice`. The change runs in one transaction with the listing locked and writes a `price_history` row; the same price writes nothing.
- The rule (`applyPriceChange` in `packages/shared`, unit-tested): a drop keeps the highest earlier price as `old_price`, so a home cut twice shows its whole fall; the notification gives this drop's %. A rise is never announced, and clears `old_price` once the price is back up to it. A drop on a live (`approved`) listing notifies every follower through Phase 11's service, in the app and on the phone: "السعر نزل ٦٪" / "Price dropped 6%", "X is now Y (was Z)", opening the home.
- `old_price`, the drop % and the "price dropped" filter already worked since Phase 3; they now follow real changes.
- Mobile: "Alert on drop" / "Following" beside the price on the property page (clients only, not for stays; a guest is asked to sign in), with a toast. Saved has two tabs, as in the demo: Saved and Price alerts. Price alerts lists followed homes, then other homes whose price fell, each with its switch. Home has "Price drops": up to three homes, with the old price and the drop %. A new compact `PropertyRow` serves both.
- Checked by hand: the Home section and the property page button in the web preview (as a guest; signing in does not work on the web, see Phase 11), and the whole flow against the local API (a client follows, the admin lowers the price, the client's inbox gets "السعر نزل ٦٪").
- Admins cannot change a price from the app yet: that screen is Phase 17. Until then the check uses the API route.

---

## Phase 13: Viewing booking

**Decided:** in-person visits only for now (§16.1 #5; ⚑ video may come later, so `viewings.mode` stays, with `visit` only). Agent availability (#8): each agent has weekly working hours per day, plus holidays and days off (single dates). An admin can set the same hours for several agents at once, or one agent's alone. This phase adds the tables (`agent_hours`, `agent_days_off`), seeds the default 10:00–20:00 with Friday from 14:00, and makes slots follow them; the admin screens for them come in Phase 18.

Contract §8.7 and §8.8.

**Database:** `viewings`, `leads` (created on booking).

**API**
- `GET /properties/:id/slots`. Slot rules:
  - 14 days ahead
  - 10:00–20:00 every hour
  - closed Friday before 14:00
  - past hours are not shown
  - taken slots are marked
- `POST /viewings` books a slot **atomically**, so the same agent and hour can't be booked twice.
- `GET /viewings`.
- `PATCH /viewings/:id` to reschedule (keeps `rescheduledFrom`) or cancel.
- `GET /viewings/:id/ics`.
- Booking creates the lead or moves it to `viewing`.
- Booking, rescheduling and cancelling send notifications (from phase 11).

**Mobile**
- The booking screen:
  - mode: visit or video
  - 14-day strip
  - grouped hour slots with their states
  - the advisor shown by name
  - reminder choices
  - confirm
- The success screen.
- Add to calendar.
- My viewings: upcoming and past, reschedule, cancel, directions, contact the advisor.
- "Your next viewing" card on Home.
- The upcoming count on the Viewings tab.

**Tests**
- Every slot rule.
- Two people booking the same slot at the same moment: only one succeeds.
- Reschedule and cancel.
- A client can only change their own viewings.

**Status (2026-11-09): in progress.** Code and tests are green; the phone check (rule 6) is left. Deployed 2026-11-09 (`8a76a85`, migration `0008`, with the seed run again for the agents' default hours). Notes:
- Database (migration `0008`): `viewings`, `viewing_reminders`, `leads`, `agent_hours`, `agent_days_off`. A viewing has one `starts_at` in UTC; the app gets the Cairo day and hour (Egypt has summer time, so the API converts with `@date-fns/tz`). A generated `active` column (1 while confirmed or rescheduled) is part of the unique key (agent, hour, active), so the database itself refuses a second live booking of an agent's hour, and a cancelled viewing frees it. The e2e test books one hour twice at the same moment: one 201, one 409.
- Agent hours: the first and last hour a viewing can start, per weekday. The seed writes the default (10–20, Friday 14–20) for the demo agents; an agent with no rows uses the default; a day off closes the whole day. The admin screens for them are Phase 18.
- Slot rules (unit-tested in `slots.ts`): 14 days from Cairo's today; past (today up to the current hour) before closed (outside the agent's hours or a day off) before taken before free. The default day is today, or tomorrow from 19:00, moved on to the first day with a free hour.
- API: `GET /properties/:id/slots` (public, so a guest sees the times; `?reschedule=<id>` shows that viewing's own hour free), `POST /viewings` (clients; checks the slot, then the unique key settles races), `GET /viewings` (a client's own, an agent's with who is coming), `PATCH /viewings/:id` (the client's own: reschedule keeps `rescheduledFrom` and makes the reminders unsent again, or cancel; not once it has started), `GET /viewings/:id/ics` (45 minutes, alarm 2 hours before). A client has one live viewing per home. Stays are refused (stay booking is not in any phase yet). Booking creates the client's lead with the home's agent at `viewing`, or moves it there from new, contacted or lost. The client gets `booking` notifications and the agent `lead` ones, for booking, moving and cancelling. Deleting an account cancels its coming viewings.
- Reminders: the choices are saved in `viewing_reminders` now; Phase 14 adds the job that sends them.
- Video (decision #5) is left out: no mode choice, every viewing is "on site".
- Mobile: "Book a viewing" bar on the property page (not for stays or staff); `/property/:id/book` (`?reschedule=<id>` to move one) with the 14-day strip, hours grouped Morning / Afternoon / Evening with their states, the advisor by name, the reminder chips and confirm; a guest is asked to sign in at confirm; a taken hour says so and asks for another. The success screen has the summary, the reminders, Add to calendar and My viewings. My viewings: Upcoming and Past & cancelled, each card with its status, where it was before a reschedule, the advisor and a call button, and Change, Calendar, Directions and Cancel (asks first); past ones offer Book again. Home shows "Your next viewing"; the Viewings tab shows the upcoming count.
- Add to calendar fetches the `.ics` file: a phone saves it and opens the share sheet (pick the calendar app); the web downloads it. Chat with the advisor comes with the chat phase; for now the card has a call button.
- Checked by hand: the booking screen and the property page bar in the web preview (as a guest), and booking, the calendar file and cancelling against the local API.

**Done when** two phones racing for the same slot can't both get it, and booking, rescheduling and cancelling all work end to end.

---

## Phase 14: Viewing reminders

**Decide first:** background jobs and queue (§16.1 #13).

Contract §8.7 (reminders) and §8.8.

**Database:** `viewing_reminders` already exists from Phase 13, with the client's choices.

**API**
- A scheduled job sends `reminder` notifications at 1 day, 2 hours and 30 minutes before, as the client chose.
- Reminders are moved on reschedule and dropped on cancel.
- Each reminder is sent only once.

**Mobile:** the reminder choices from phase 13 are saved. Reminder pushes open My viewings.

**Tests:** each reminder fires once at the right time, moves on reschedule, and is skipped after cancel.

**Done when** a viewing booked about 35 minutes ahead gets its 30-minute reminder on the phone.

**Status (2026-11-10): done, except the push.** Deployed 2026-11-10 (`89afb44`, with Phases 15 and 16). Checked on the phone: the reminders arrive in the app's inbox. The push part still needs Firebase (Phase 11 status). Notes:
- Decided (#13, earlier): `@nestjs/schedule` inside the API. `RemindersJob` runs every minute and skips a run while the last one is still going. Tests do not load it; they call `sendDueReminders(now)` with their own clock.
- Each reminder row is claimed (stamped `sent_at` where it is still empty) before it is sent, so two servers or a restart cannot send it twice.
- A choice already due when the viewing is booked or moved is stamped at once and never sent. Booked 35 minutes ahead, only "30 minutes before" comes.
- Reminders missed while the API was down become one message, if the viewing has not started yet. The message gives the home, the date and time, and the advisor; it opens My viewings.
- A reschedule keeps the choices (or takes new ones) and counts them from the new time, so one already sent is sent again for the new time.
- The app needed no change: the inbox already has the reminder icon, and a push opens its link.
- Tests: unit tests for the timing (`reminders.spec.ts`) and 8 e2e tests (`viewing-reminders.e2e-spec.ts`): the right time, once only, only the choices made, missed ones merged, nothing after the start, reschedule, cancel, three runs at once, and a booking 35 minutes ahead.

---

## Phase 15: Sales agent app

Contract §10.1 and §10.2.

**Database:** `leads` (fully used now), `lead_notes`.

**API**
- `GET /agent/today`: the stats, today's viewings and the ones coming up, the pipeline counts, "needs a first call", and the monthly target.
- `GET /agent/leads` with a stage filter.
- `GET/PATCH /agent/leads/:id` to change the stage.
- `POST /agent/leads/:id/notes`.
- Agents see only their own leads.
- A new booking sends a `lead` notification to the agent.

**Mobile**
- The agent Today screen.
- The leads list with stage filters, hot markers and masked phone numbers.
- The lead page: details, viewing, stage picker, notes, call.

**Tests:** the stage changes, notes, data limited to the agent's own, and the target maths.

**Done when** a viewing booked by a client shows up on the agent's Today screen and lead list straight away, marked "New from app".

**Status (2026-11-10): done.** Deployed 2026-11-10 (`89afb44`). Checked on the phone: the agent's Today, Leads and lead page against the live server. Notes:
- Decided while building: "New from app" lasts until the agent opens the lead (`leads.seen_at`, cleared by each new booking). A booking marks the lead hot; the agent can switch it. The monthly target counts leads moved to Won this month (`leads.won_at`), against the average of the active agents.
- Migration `0009`: `lead_notes`, `leads.seen_at` and `won_at`, millisecond `last_activity_at`, and lead sources renamed (`app` became `booking`). The seed adds six sample leads (calls, walk-ins) to each agent that has none, with two notes and one deal won.
- `GET /agent/today` gives the stats, target, today's viewings (until an hour after they start), the next five, the pipeline counts and the `new` leads. Leads lists mask phones; the lead page has the full number and marks the lead seen.
- The agent's booking notification now opens the lead page (`/agent/lead/:id`).
- The agent routes moved into `agent/(tabs)/`, with `agent/lead/[id]` over the tabs, like the client's property page. The URLs did not change.
- Found and fixed: the API reads times as UTC, but MySQL on this PC runs in Cairo time, so times MySQL filled in itself (`created_at`) came back 2 hours ahead. Every pooled session now sets `time_zone = '+00:00'`. Production's MySQL was already UTC, so nothing changes there.
- Left for later: chat from the lead page (Phase 16), the "Live video" start button (video is out, #5), and leads the agent adds by hand.
- Checked by hand against the local API and database: a client booking one of Omar's homes showed on his Today at once, marked "New from app", with the lead hot at Viewing and his notification opening it. No web preview: signing in does not work on the web (Phase 11).
- Tests: API e2e (`agent.e2e-spec.ts`, 11), shared unit tests for the masked phone and the target maths, and UI tests for the three screens (13).

---

## Phase 16: Live chat

**Decide first:** what happens when the agent is away (§16.1 #12).

Contract §8.12 and §10.3.

**Database:** `chat_threads`, `chat_messages`.

**API**
- `GET/POST /chats` (one conversation per client and home).
- Message history with paging.
- A WebSocket gateway with the same auth as the HTTP API: messages, typing and read receipts.
- Every message type from §8.12.
- Booking from a `slots` card uses the phase 13 booking logic.
- `chat` notifications go out when the conversation is closed.

**Mobile**
- The client chat list and conversation screen: text, photos, quick-question chips, typing indicator, read ticks, and rich cards.
- The floating chat button above the tab bar, with its unread badge.
- The agent's Chats tab and conversation screen, where the agent can send cards.

**Tests**
- Gateway auth.
- A client can only open their own conversations.
- Booking from the slots card.
- Unread counts.

**Done when** a client and an agent on two phones chat in real time, and the client books from a times card the agent sent.

**Status (2026-11-10): done, except the push.** Deployed 2026-11-10 (`89afb44`), with the nginx socket and photo blocks. Checked on two sides (the phone as the client, a script as the agent): live messages, typing, read ticks, every card, booking from a times card, photos, the away rules and the lead. Fixed on the phone after: photo sending (Expo's fetch needs parts that carry their bytes), the agent's own bubbles in dark mode, Arabic lines that start with an English name, and sheets taller than the screen. Pushes need Firebase (Phase 11). Notes:
- Decided (#12, earlier): outside working hours, one automatic reply says to contact Maqar during working hours, until the agent answers in person. Working hours are the agent's viewing hours to the end of the last hour (10 to 20 means 10:00 to 20:59), and days off count.
- Migration `0010`: `chat_threads` (one per client and home, with `last_message_at`) and `chat_messages` (`body` is JSON).
- Messages go over HTTP; the Socket.IO gateway at `/v1/socket.io` (behind the same `/v1/` proxy) signs in with the access token and brings `message`, `updated`, `typing` and `read` to the other side. The app tells it which conversation is `open`, so those messages send no notification. A refused token is renewed and the socket reconnects.
- Found and fixed: the global HTTP guards also ran on socket events and failed on them; they now handle HTTP only, and the gateway checks sockets when they connect (clients and agents only).
- Cards: home details and 360° tour show the conversation's home; the payment plan keeps the plan as sent; a times card lists that day's free hours. Booking from it uses the booking screen's rules (one live viewing per home, the hour must be free), marks the card, and adds a confirmation card already read by the client.
- Starting a conversation adds the client to the advisor's leads (source `chat`); the lead page's Chat button opens it. Deleting an account deletes the client's conversations.
- Photos: picked with `expo-image-picker` (added to `app.json` with its photo-library text; no camera), resized on the phone with `expo-image-manipulator`, then resized again and stored as JPEG by the API. **A new build is needed** for the picker, as it is a native module.
- App: the Messages list (`/chat`), the conversation screen (shared by both sides), the floating chat button above the client's tabs (above the compare tray when it shows), the Chats tab badge, and a Chat button in the property page's bottom bar.
- **For the deploy:** copy `deploy/nginx-maqar.conf` to the server's `/etc/nginx/sites-available/maqar` (it adds the WebSocket upgrade for `/v1/socket.io/` and 12 MB uploads for chat photos), run `nginx -t`, then reload. Without it the socket falls back to HTTP polling and photos over 1 MB are refused.
- Checked by hand against the local API and database with two sockets (a client and Omar): the message, typing and read receipt arrived live, the times card arrived live, the client booked 11:00 from it, Omar saw the card marked, and the confirmation card followed (the test viewing was cancelled after). No web preview: signing in does not work on the web (Phase 11).
- Tests: API e2e (`chat.e2e-spec.ts`, 18, including the socket), unit tests for the away rules and `chatPreview`, and UI tests for the conversation, the list, the chat button, the property page's Chat button and the lead page's.

---

## Phase 17: Admin listings

**Decided (2026-11-09):** there are no owner accounts. An owner talks to Maqar, and an admin creates and manages the listing for them. The owner's name and phone are kept on the listing, visible to admins only. Listings go live when the admin publishes them; there is no review step and no "Verified owner listing" badge.

Contract §9.2 and §11 (to be updated to match).

**API**
- `POST /uploads` for photos: type and size checks, resizing.
- `POST /admin/listings` (draft), `PATCH /admin/listings/:id`, `GET /admin/listings` (every status).
- Publish (assigns an advisor), unpublish, mark sold or rented.

**Admin UI:** both the web dashboard (§16.1 #6; it starts in this phase) and screens inside the app: the 5-step listing form (type, location, details, photos with the first as the cover, review), and the list of listings with status badges.

**Tests:** admin-only access, form validation (at least one photo), the status changes, upload limits, and that a published listing appears in public search and an unpublished one does not.

**Done when** an admin creates a listing with real photos on the web dashboard or in the app, publishes it, and it appears in Explore.

**Status (2026-11-11): in progress.** Code and tests are green. Deployed 2026-11-11 (`964efb7`, migration `0011`, with Phase 18), with the nginx `/admin/` and `/v1/uploads` blocks; the dashboard is at `https://187-55-224-15.sslip.io/admin/`. The phone check (rule 6) is left. Notes:
- Decided: the web dashboard is `apps/web` (`@maqar/web`): Next.js 16 and Tailwind like the demo, a static export served by nginx at `/admin/` on the API's host, so it calls `/v1` on the same origin with no CORS. `deploy.sh` builds it from the same clean commit and swaps it in at `/srv/maqar/web/admin`. Admins sign in with their account; any other role is signed out at once.
- Migration `0011`: `owner_name` and `owner_phone` on the listing (admins only ever see them), `agent_id` empty until the listing is published, and the review statuses (`pending`, `changes`) are gone: any listing in them becomes a draft. Statuses are now draft, approved (live), unpublished, sold and rented.
- `POST /uploads` (admins, one photo in `photo`): turned upright, at most 2000 px, JPEG, under `uploads/listings`. Photos are made smaller on the phone or in the browser first. nginx takes 12 MB on that route; the API refuses over 10 MB.
- `/admin/listings`: the list (every status, a count per status, words in the title, compound, owner or phone), create (a draft; an empty title becomes "<type>, <beds> beds | <area>"), get, edit (a new price goes through the price history, so a drop alerts followers), publish (the advisor picked, the one it had, or the active one with the fewest live listings), unpublish, and close (sold for sale and projects, rented for rent and stays). `GET /admin/agents` lists the advisors to pick from. A listing's photos are only ones uploaded to this server.
- The listing form's rules (steps, checks, the request body) live in `packages/shared`, so the app and the web check alike.
- App: the admin's Listings tab (status chips with counts, search), the listing page (owner with a call button, advisor, publish with an advisor sheet, unpublish, sold or rented, see it as a client) and the 5-step form for new and edited listings. Web: the same list, page and form, with drag-and-drop photos.
- Not in this phase: map pins and 360° tour rooms (the contract's panoramas) are set outside the form for now; the form keeps what a listing already has.
- Tests: API e2e (`admin-listings.e2e-spec.ts`, 16), shared unit tests for the status moves, the default title and the form rules, mobile UI tests for the three admin screens, and the web API client (sign-in for admins only, one shared token renewal).

---

## Phase 18: Admin tools

Contract §11.

**API**
- Agents CRUD.
- Agents' weekly working hours, for one agent or several at once, and their holidays and days off (the data arrives in Phase 13).
- Reassign a lead.
- Areas CRUD.
- Featured listings.

**Admin UI:** the same pages on the web dashboard and in the app.

**Tests:** admin-only access, setting hours for several agents at once, a holiday closing that agent's viewing slots and switching on the chat auto-reply, and reassigning a lead.

**Done when** an admin changes an agent's hours or adds a holiday, and the booking slots and the chat follow at once.

**Status (2026-11-11): in progress.** Code and tests are green, CodeRabbit fixes in `0fce9f6`. Deployed 2026-11-11 (`964efb7`, with Phase 17). The phone check (rule 6) is left. Notes:
- No migration: the tables were already there (`agents.active`, `agent_hours`, `agent_days_off`, `leads.agent_id`, `properties.featured`). Slots and the away reply read the hours and days off whenever they are needed, so a change applies at once; the e2e tests check both.
- Agents (`/admin/agents`): an admin creates an agent with a starting password to pass on (no email is sent), edits the profile, sets a new password (which signs them out everywhere), and turns them off or on. A turned-off agent is signed out and cannot sign in, and every request with an old token is refused at once. An agent who is still the advisor of a live listing cannot be turned off: the listing moves first (`PATCH /admin/listings/:id` takes `agentId`). There is no delete, so history keeps its links. `GET /admin/agents?active=true` is the advisor picker.
- Hours (`PUT /admin/agents/hours`): the same week for one agent or several, replacing what they had; a weekday left out is a day off, and at least one day is worked. A new agent has the default week until one is set.
- Days off (`POST /admin/agents/days-off`): one day or a stretch of up to 60, for one agent or several, with an optional reason; adding a day that is already off keeps it. Viewings already booked on them are not cancelled: the answer says how many, so the admin can agree other times. `DELETE /admin/agents/:id/days-off/:date` takes one back.
- Leads (`/admin/leads`): every agent's leads with full phones, by agent or stage; `PATCH /admin/leads/:id/assign` moves one to another active agent, who gets a notification and sees it as new. A client cannot have two leads with one agent (409). The client's chats and viewings stay with the home's advisor.
- Areas (`/admin/areas`): add (the id is made from the English name), edit, and delete one no listing uses.
- Featured: `PATCH /admin/listings/:id` takes `featured`; cards carry `featured`, `GET /properties?featured=true` lists them, and Home shows "Featured by Maqar" first when there are some.
- Found and fixed: on a query of one table Drizzle writes column names bare, so a count subquery that names the outer table's column compared the inner table with itself. The area counts were wrong (and Phase 17's live count per advisor worked only by luck); the outer column is now written with its table.
- App: the admin's tabs are now Listings, Agents, Leads, Areas and Me (Add a listing is the + on Listings). Agents can be picked several at a time for hours or a day off. Web: the same pages.
- Tests: API e2e (`admin-tools.e2e-spec.ts`, 16), shared unit tests (area ids, day ranges, a valid week), mobile UI tests for the agents, agent page, new agent, leads and new area screens and Home's featured row.

---

## Phase 19: Listing insights (for admins)

Contract §11 (moved there from §9.1).

**Status (2026-11-11): built and deployed.** The insights shipped with commit `8acbae7` and are live with the pre-release fixes. Notes:
- `listing_stats` (migration `0012`): views and saves per listing per Cairo day, counted as they happen. A save counts on the day it is made, even if undone later; saving again counts nothing.
- Interested clients are not stored again: they come from saves, price alerts, chats and viewings, one entry per client, leaving out deleted accounts. A day's "new interested" counts clients whose first action was that day.
- The all-time views are the listing's existing counter, so they include views from before this phase; the daily chart starts at the deploy.
- The section shows on every listing except drafts (clients never saw those). The web copies a summary for the owner, the app shares it.

**Database:** `listing_stats` (or events).

**API**
- Daily counts of views, saves and interested people.
- `GET /admin/listings/:id/stats`.
- `GET /admin/listings/:id/interested`: the clients who saved, followed, chatted or booked.

**Admin UI:** per listing, the views chart, the totals and the interested clients, on the web dashboard and in the app, so the admin can pass the numbers to the owner.

**Tests:** the counters, the date buckets, and admin-only access.

**Done when** what clients do in phases 7, 12, 13 and 16 shows up in the listing's numbers.

---

## Phase 20: Release

**Status (2026-11-11): in progress.** Done so far:
- Security: every route's access (public, signed-in or roles) is pinned by `route-access.e2e-spec.ts`, so a new or changed guard fails until reviewed. The write rate limit now counts per account, as §15 says (it counted per address, so clients behind one carrier NAT or office Wi-Fi shared 60 writes a minute). Reminder claims take the lease only when nobody holds it, so two servers running together send a reminder once.
- Store readiness (`store-readiness.md` §5 items 1–3): the unused calendar package and the camera, microphone, storage and overlay permissions are gone; the motion and photo permission texts say what they are for, in Arabic and English; iOS export compliance is answered in the build.
- Tests: e2e files reset every table from the schema (the interest history table was left over between files); the insights test sends a chat message, since opening an empty conversation is not interest (INS-04).

- Public pages (`store-readiness.md` §5 items 4, 6, 7): privacy policy, terms, support and account deletion in Arabic and English at `/privacy`, `/terms`, `/support`, `/delete-account`, deployed with `deploy.sh`; the Me screen links them for everyone.

- Deployed (`5fd13b6`): the pages, the nginx change and the per-account limits are live; minikoshk checked unaffected.
- Phone check (POCO F3, Android 13, release APK; final build `c800a8f`, APK/AAB/IPA in `apk-out/c800a8f/`). Found and fixed: the 360° tour crashed (R8 removed the `(Context, AppContext)` constructor of expo-gl's view, then renamed `GLContext.flush()` that expo-gl's C++ calls by name) and, once open, drew a grey grid (the panorama was uploaded as RGB while expo-gl decodes photos to RGBA); the keyboard covered the chat box and form fields (edge to edge, so `KeyboardAvoidingView` pads on Android too); "Add to calendar" offered no calendar app (Android now opens the file with a view intent); scrolled content showed under the status bar (a backdrop strip); the insights chart opened on its oldest days (it fits the width now); phone numbers lost their leading `+` in Arabic text (left-to-right marks); unused overlay, activity, biometric permissions blocked. Verified on the phone afterwards: all of these, plus sign-in, booking and cancelling, chat, About Maqar links, the requested permissions (internet, notifications, vibrate, wake lock, boot, foreground service).

Still to do: the store consoles (`store-readiness.md` §2.3–2.5, §3.3–3.4); the deferred items (contract §17.2); the full regression on phones.

**Decided already:** analytics and crash reporting are out of scope for now (#14, 2026-11-09); nothing to build there.

Contract §15.

- **Accessibility:** screen-reader labels, contrast, text scaling, reduce motion.
- **Performance:** paging everywhere, image sizes, app start time.
- **Security:** rate limits, upload checks, secrets, and a review of every role guard.
- **Production:** deploys are still manual (Phase 2's automatic deploy on push, daily backups and the restore test are not done yet); whatever ships must state its version and the backups/restore have to be checked before release.
- **Mobile:** signed store builds for Android (the `store-build` GitHub Action) and iOS, store listings, app icons and splash in Maqar branding.
- **Full regression:** every phase's "done when" is run again.

**Done when** production builds are installed from the stores, or as internal builds, and work against the production API.

---

## Phase 21: Admin: 360° tours

Contract §8.6, §11.

**API**
- `POST /uploads/panoramas`: one panorama in `pano`, checked (JPEG, 2:1 within 1%, at least 4096×2048, at most 30 MB), stored at 4096×2048 under `/uploads/tours/`.
- `POST /admin/listings` and `PATCH /admin/listings/:id` take `tour`: the rooms in order (up to 12), each with both names and a panorama uploaded here. It replaces the tour in the same write as the rest of the edit; an empty list removes it. Panoramas no room uses any more are deleted from the disk.
- `GET /admin/listings/:id` returns the rooms.

**Admin UI:** a "360° tour" step on the listing form, in the app and on the web: add a room (pick the panorama, name it), rename, reorder, remove, and a preview.

**Tests:** the panorama checks, the tour replaced in order with the edit, panoramas from elsewhere refused, removed files deleted, admin-only access; the form's main flow on both.

**Done when** an admin adds a tour to a listing and a client opens it on a phone.

**Status (2026-11-12): built, not deployed.** Code and tests are green. Left: the deploy and the phone check (rule 6). Notes:
- Panoramas are stored at exactly 4096×2048, not sharper: that is the size the seed tours prove on phones, and a bigger texture can be more than an older phone's GPU loads. The app and the web check the size before uploading and scale the photo themselves, so a large camera file uploads quickly; the server checks again and re-encodes, which drops the camera's metadata (such as where it was taken).
- The tour step sits between Photos and Review, so the form now has six steps. Rooms can be renamed, reordered and removed; an edit sends the whole tour, so removing every room removes it.
- nginx: `/v1/uploads/panoramas` takes 32 MB (`deploy/nginx-maqar.conf`); `deploy.sh` checks it with `nginx -t` before reloading.
- Checked by hand on the web dashboard against the local API: a normal photo is refused with the 2:1 message, a 4096×2048 panorama uploads, and the saved room shows in the public listing.
- Tests: API e2e `admin-tours.e2e-spec.ts` (8), shared unit tests (the tour step, the body, `panoramaProblem`), mobile UI test for the tour step; the route-access table has the new route.

---

## Phase 22: Admin: clients and admins

Contract §11, §12, §13.

**Database:** `users.suspended_at`.

**API**
- `GET /admin/clients` (search by name, email or phone; active or suspended; paged), `GET /admin/clients/:id` (profile, preferences, counts, latest viewings, conversations and leads), `PATCH /admin/clients/:id` (`password`, `suspended`), `DELETE /admin/clients/:id`.
- `GET/POST /admin/admins`, `PATCH /admin/admins/:id` (name, email, phone, `password`, `suspended`).
- A suspended account is treated like a turned-off agent: refused on every request at once, cannot sign in or refresh, socket dropped. Suspending a client cancels their upcoming viewings and tells the advisors.

**Admin UI:** the app's admin tabs become Listings, Agents, Leads, More (Clients, Areas, Admins, account settings); the web menu gains Clients and Admins.

**Tests:** suspension (tokens refused, sign-in refused, viewings cancelled), password reset signing out, delete matching the client's own, the rule that an admin cannot suspend themselves, admin-only access; the screens' main flows.

**Done when** an admin suspends a client and that client's phone is signed out at once.

**Status (2026-11-12): built, not deployed.** Code and tests are green. Left: the deploy and the phone check (rule 6). Notes:
- Migrations `0017` (`users.suspended_at`) and `0018` (`credentials_changed_at` in milliseconds, below).
- Suspension: the account check every request and the chat socket use (`findActive`) skips suspended accounts, so access ends at once; the sessions are ended too, so restoring needs a fresh sign-in. Suspending a client first cancels their upcoming viewings and tells only the advisors (the client is being signed out). Sign-up now checks the email against every account, so a suspended client's address is not offered again.
- Deleting a client runs exactly the client's own delete (`UsersService.removeClient`) and ends the sessions.
- An admin cannot suspend themselves. The planned "not the last active admin" rule turned out to follow from that (whoever suspends is an active admin), so it is not a separate check.
- "Last seen" is the last sign-in or session refresh.
- Found and fixed (SEC-02 edge): an access token issued in the same second as a password change outlived it, because `iat` has whole seconds. Tokens now carry `iatMs`, and the change time is stored in milliseconds from the API's clock. Older tokens without `iatMs` count from their second.
- App: the admin's tabs are Listings, Agents, Leads, More; More holds Client accounts, Areas and Admin accounts above the settings. Web: Clients and Admins in the menu (labels show on wide screens; icons with tooltips otherwise).
- Checked by hand on the web dashboard against the local API: the client list, a client's page, the admins page.
- Tests: API e2e `admin-people.e2e-spec.ts` (9), token unit tests for the same-second cases, mobile UI tests `people.test.tsx` (6); the route-access table has the new routes.

---

## Phase 23: Admin: viewings

Contract §8.7, §11.

**API**
- `GET /admin/viewings` (`when` upcoming or past, status, advisor, Cairo day range, words in the client or the home; paged; upcoming soonest first, past latest first).
- `PATCH /admin/viewings/:id`: reschedule to a free time of the same advisor (the booking rules apply) or cancel, with an optional reason. Client and advisor are notified; the client's reminders follow the new time.
- The free hours come from the existing `GET /properties/:id/slots?reschedule=:viewingId` (the viewing's own advisor, its own hour counted as free); no new route was needed.

**Admin UI:** a Viewings page (app: under More; web: the menu), and the viewing on a client's page.

**Tests:** filters, reschedule onto a taken or closed time refused, cancel freeing the hour, notifications, admin-only access; the page's main flow.

**Done when** an admin moves a client's viewing and both the client and the advisor see the new time.

**Status (2026-11-12): built, not deployed.** Code and tests are green. Left: the deploy and the phone check (rule 6). Notes:
- The admin's move and cancel run through the same step as the client's (`ViewingsService.change`): only active, future viewings; the booking rules for the new hour; the write carries the expected state, so it races safely with the client. Reminders the client chose follow the new time.
- The reason, when given, is added under the usual notice to both the client and the advisor ("From Maqar: …").
- App: Viewings under More (Upcoming and Past, search; an upcoming one opens a sheet to move it with a day and time picker, or cancel it). Web: Viewings in the menu, with the same actions in the row.
- Checked by hand on the web dashboard against the local API: a demo client's viewing moved to another day and hour, and shows as rescheduled.
- Tests: API e2e `admin-viewings.e2e-spec.ts` (5), mobile UI tests `viewings.test.tsx` (2); the route-access table has the new routes.

---

## Phase 24: Admin: chats, report and block

Contract §8.12, §11, §13.

**Database:** `chat_threads.blocked_at`, `blocked_by`; `chat_reports`.

**API**
- `POST /chats/:id/report`, `POST /chats/:id/block` (client or agent, own conversations). Sending in a blocked conversation is refused (409); the socket tells both sides.
- `GET /admin/chats`, `GET /admin/chats/:id`, `GET /admin/chats/:id/messages`: read-only, marks nothing read. `POST /admin/chats/:id/unblock`.
- `GET /admin/reports`, `PATCH /admin/reports/:id` (`dismissed`, `blocked`, `suspended`; the last uses Phase 22's suspension). A new report notifies the admins.

**App:** report and block in the conversation's menu, for clients and agents; a closed banner instead of the composer. **Admin UI:** Chats with a reports filter and badge, a read-only conversation, and the report actions.

**Tests:** report and block rules (own conversations only, sending refused once blocked, unblock by admins only), the read-only admin view leaving read marks alone, report outcomes, admin-only access; the screens' main flows.

**Done when** an agent blocks an abusive client, the client sees the conversation closed, and an admin handles the report.

**Status (2026-11-12): built, not deployed.** Code and tests are green. Left: the deploy and the phone check (rule 6). Notes:
- Migration `0019`: `chat_threads.blocked_at` and `blocked_by` (`client`, `agent` or `admin`: an admin closes one when handling a report), and `chat_reports`.
- Closing: either side, from the conversation's menu, after a confirmation. Sending text or photos, and booking from a times card, are refused (409) in a closed conversation; it stays readable. The socket's new `blocked` event updates both sides at once. Only an admin opens it again.
- Reporting: a reason (spam, abuse, scam, other) and an optional note; the other side is not told. Every active admin gets a notification that opens the conversation.
- Admin: Chats (the reported ones first) under More in the app and in the web menu; the More tab shows how many reports are open. A conversation opens read-only (each message as its text or the card's one-line summary; reading marks nothing read), with its reports: dismiss, close the conversation, or suspend the client (Phase 22's suspension). A report is closed once.
- Web menu: with nine pages, the labels show on very wide screens only; icons with tooltips otherwise.
- Checked by hand on the web dashboard against the local API: a reported conversation listed, opened read-only, and the report dismissed.
- Tests: API e2e `chat-safety.e2e-spec.ts` (7), mobile UI tests `report-block.test.tsx` (3) and `chats.test.tsx` (2); the route-access table has the new routes.

---

## Phase 25: Admin: overview

Contract §11, §12.

**API:** `GET /admin/overview?days=7|30|90`: the counts and the per-advisor table in §11, and a daily series of new clients, leads and viewings (Cairo days).

**Admin UI:** the overview is the admin's first page, in the app (a new first tab) and on the web (the dashboard's home; Listings moves to `/listings/`).

**Tests:** each count and its date range on seeded data, Cairo day buckets, won leads this month against the target, admin-only access; the page's main flow.

**Done when** the overview's numbers match what happened in the app over the chosen range.

**Status (2026-11-12): built, not deployed.** Code and tests are green. Left: the deploy and the phone check (rule 6). Notes:
- Migration `0020`: `properties.closed_at`, set when a listing closes as sold or rented and cleared when it is published again, so "closed in the range" can be counted. Listings closed before this phase have none.
- The range is the last 7, 30 or 90 Cairo days, today included, as UTC instants (summer time handled); the daily chart buckets by Cairo day. Unit tests cover the window and the buckets.
- What each number means: listings by status now, published (first publish) and closed in the range; clients now and new in the range; leads made in the range by their current stage, and leads won in the range; viewings booked in the range, completed (by their time), cancelled (when cancelled), and confirmed in the next 7 days; conversations started in the range, messages sent, and open reports. Per advisor: live listings and open leads now, viewings booked in the range and not cancelled, and leads won this Cairo month against the monthly target.
- App: Overview is the admin's first tab and Listings the second (the tabs are Overview, Listings, Agents, Leads, More); open reports link to Chats. Web: the dashboard's home is the overview and Listings moved to `/listings/` (a link there already existed and now works).
- Checked by hand on the web dashboard against the local API, at 1280, 1536, 1600 and 1920 px wide: no sideways scroll.
- Tests: API e2e `admin-overview.e2e-spec.ts` (2, counting each number's change after real actions), unit tests `overview/window.spec.ts` (4), mobile UI test `overview.test.tsx` (2).

## Phase 26: Admin: listing videos

Contract §8.6, §9.2, §14.

**API:** `POST /uploads/videos` (admins): one MP4 or MOV, at most 150 MB and 3 minutes. The server keeps an H.264 (8-bit 4:2:0) video up to 1920 px as it is and converts anything else (HEVC, 4K, other codecs) to H.264 at most 1280 px, with AAC sound; either way the metadata (where it was filmed) is dropped and the index is moved to the front so playback starts at once. A JPEG poster frame of the same name is made from the stored video. The listing's `videos` (paths, in order, at most 5) is saved on create and edit like the tour: left out keeps them, an empty list removes them, and removed videos and their posters are deleted unless another listing uses them. `AdminListing.videos` and `PropertyDetail.videos` carry each video's poster, length and size.

**Admin UI:** a Videos step after Photos in the listing form, in the app and on the web (optional; add, reorder, remove, retry). The app picks videos from the phone and streams them from disk with progress; on iPhones the picker hands over H.264, which the server keeps. The web checks type, size and length in the browser first and shows upload progress. Both admin listing pages show the videos.

**Client UI:** the property gallery shows the videos after the photos, as their posters with a play button and the length; a chip on the gallery plays the first. A video plays full screen with the platform's controls (`expo-video`, a native module: it reaches phones with the next app build).

**Tests:** upload rules (admins only; refusals; copy versus convert; upright phone videos; no location metadata; range requests), saving and replacing on a listing, the form step in the app and on the web client, the gallery and player.

**Done when** an admin adds a phone video to a listing in the app and on the web, and a client plays it on the listing.

**Status (2026-11-12): built, not deployed.** Code and tests are green. Left: the deploy (ffmpeg in the API image, migration `0021`, nginx) and the phone check (rule 6), which needs a new app build for `expo-video`. Notes:
- Migration `0021`: `property_videos` (url, poster, duration in seconds, width, height, sort).
- Conversion runs one video at a time at the lowest CPU priority with one thread (the server is shared), and is stopped after 10 minutes. The API's memory cap rose from 384 MB to 640 MB for ffmpeg.
- nginx: `/v1/uploads/videos` takes 160 MB and waits up to 10 minutes for the answer; the file reaches the API only once nginx has all of it, so a slow connection does not hold the API.
- The upload goes to a temp file, never into memory; the app sends from disk natively (`File.upload`), the web with `XMLHttpRequest` for progress.
- Local development and tests use ffmpeg from dev packages (`@ffmpeg-installer/ffmpeg`, `@ffprobe-installer/ffprobe`); `FFMPEG_PATH` and `FFPROBE_PATH` override.
- Videos uploaded but never saved on a listing stay on disk, as photos and panoramas do.

## Phase 27: Admin: reports

Contract §11, §13, §14.

**Shared:** the catalogue of reports (id, group, titles, which filters apply, whether it has a range), the range rules (presets, Cairo days, at most 366 days, never in the future, the previous period of the same length), and one response shape every report uses: totals with the previous period, charts (per day, bars, week-by-hour), and tables of typed cells with links. Cell formatting and the CSV file (UTF-8 with a byte-order mark so spreadsheets read Arabic; raw numbers, ISO dates) live here too, so the app and the web show and export the same thing.

**API:** `GET /admin/analytics/:id?from&to&agentId&areaId&category` (`/admin/reports` is already chat reports) for the eleven reports in §11. Migration `0022`: `viewings.cancelled_by` (client, agent or admin, set on every cancel; a suspension's cancels count as admin) and `leads.lost_at` (set when a lead moves to lost, cleared when it leaves it).

**Admin UI:** Reports in the web menu (`/reports/` and `/report/?id=`) and under More in the app: the reports by group, then one report with its range, filters, totals with the change from the previous period, charts, tables (sortable on the web; cards on the phone) with links to the listing, advisor, client or chat, CSV export (download on the web, share from the app), and print on the web.

**Tests:** the range rules, cells and CSV (shared unit tests); each report's numbers after real actions, filters, the previous period, validation and admin-only access (API e2e); the reports hub, one report's range and filters, and the export (app and web).

**Done when** an admin can answer, from Reports alone, what sold and who sold it, how each advisor is doing, where leads come from and what they turn into, what the listings lack and which nobody wants, where demand is, and how quickly clients get answers.


**Status (2026-11-12): built, not deployed.** Code and tests are green. Left: the deploy (migration `0022`) and the phone check (rule 6). Notes:
- The API path is `/admin/analytics/:id`, because `/admin/reports` already holds chat reports (Phase 24); the screens say "Reports".
- Each report is built from focused row sets added up in code (`modules/reports`), so every number can be traced to rows; the reports read what they need since the start of the previous period.
- A range defaults to the last 30 Cairo days; the previous period has the same length and ends the day before. Snapshot reports (inventory, listing quality) have neither. A filter a report does not take is refused (400).
- Definitions shown under each report: deal prices are asking prices at closing; conversion is leads won in the range ÷ new leads in the range; the target for a range is the monthly target × days ÷ 30.4; first reply time counts every hour, from the client's first message to the advisor's first answer, in conversations started in the range; "idle" leads are open and untouched for 7 days; "waiting" chats are open, end with the client's message, an hour or more ago; viewings "done" and the cancellation rate are by when the viewing was due.
- Who cancelled a viewing and when a lead was lost are recorded from this phase on (migration `0022`); older ones show as "not recorded".
- Web: the range and filters are in the address (`/report/?id=deals&preset=90d&agentId=3`), so a view can be bookmarked or shared; tables sort by any column; print hides the menu and controls. The menu (now eleven pages) scrolls inside itself on narrow screens, so no dashboard page scrolls sideways any more (it did on phones before this phase).
- App: More → Reports; presets instead of free dates; tables as cards, 25 at a time; CSV through the share sheet.
- Checked by hand on the web dashboard against the local API: the hub, advisors, viewings (with the heat map), at 360, 390, 768, 1024, 1280 and 1536 px; no sideways scroll.
- Tests: API e2e `admin-analytics.e2e-spec.ts` (4: access and validation, the shape of all eleven, every report's numbers after real actions, filters and the previous period), unit `reports/chat-times.spec.ts` (3), shared `reports.test.ts` (7), mobile `reports.test.tsx` (3).

## Phase 28: Owner's client-app changes (2026-11-12)

Contract §8.1, §8.2, §8.5, §8.7, §8.9, §15.

The owner's list after using the app in the browser, checked against the store rules first.

- **Phone at sign-up:** an optional field on the sign-up form (`SignUpBody.phone`, the same 8–15 digits as `PATCH /me`; Arabic digits and separators are read with `readMobile`). It is optional because App Store guideline 5.1.1 lets an app require only what its core use needs, and browsing homes does not. It can be added or changed later in the profile. Store forms: "Phone number, optional, app functionality" (already in `store-readiness.md` §2.4).
- **Calculator:** the payment period is typed (1 to 10 years), not picked from chips. A listing's own plan may run longer, and then that is the limit. A wrong number keeps the last good one and is put back when typing ends.
- **Map:** the web preview embeds an OpenStreetMap map with the pin, as the demo does (`osmEmbedUrl`). Phones keep the native map (Apple Maps on iOS; Google Maps on Android only with `GOOGLE_MAPS_API_KEY`, still not set). OSM's free tiles are for light use, so they are not used in the store apps.
- **Compare:** the "Demand" (views) group is removed.
- **My account:** the "Contact support" row is removed; the support address moves to the footer, because Apple 1.2 (apps with chat) and 1.5 want a contact inside the app. The footer adds "Powered by Bit Tech" and 01501053600 (tap to call).
- **Filters:** the size range takes typed "from" and "to" numbers like the price; the slider follows them; the range stays in order and a maximum past 500 m² means no maximum.
- **Home:** "What you're looking for" shows a client's answers from after sign-up (purpose, budget, areas, types, bedrooms, must-haves) with Edit; a client who skipped them is asked to answer; guests and staff see nothing.

**Tests:** API e2e (sign-up keeps a valid phone, refuses a bad one); shared unit (`readMobile`); mobile unit (`parseYears`, `osmEmbedUrl`); mobile UI (sign-up phone, typed years, compare without views, the footer, the typed size range, the Home preferences section).

**Status (2026-11-12): deployed and checked on the phone, with Phases 21–27.** Deployed `7f1a03e` (the server was at `5fd13b6`, before Phase 21: migrations up to `0022`, ffmpeg in the image, the API at 640 MB, the video route in nginx). APK `7f1a03e` checked on an Android 13 phone (Poco F3) as admin, client and advisor: the overview, every admin list (clients, admins, viewings, chats), the reports, the 7-step listing form (tour and videos), the sign-up phone, Home preferences, the typed years and size range, compare without views, the account footer, and a real chat (client on the PC, advisor on the phone) closed by the client and seen closed by the admin. Android shows no map until `GOOGLE_MAPS_API_KEY` is set (Directions works).

Fixed after the phone check:
- The calculator: typing "15" passed through "1" and showed a 1-year plan; a number above the limit now counts as the limit.
- The compare bar hid the end of tab pages (the account footer): `Screen` keeps room under the page while it shows.
- Reports: the automatic out-of-hours chat reply counted as the advisor answering (first-reply times looked instant, and the chat left "waiting for a reply"). It is skipped now. Two e2e tests failed after 21:00 Cairo for the same reason.

## Phase 29: Owner's admin changes (2026-11-13)

Contract §8.1, §8.11, §11, §13.

- **App settings** (`app_settings`, migration `0023`; `GET /settings` for everyone, `PUT /admin/settings` for admins; web `/settings/`, app More → App settings):
  - *Opening screen:* the logo only, a picture (2 s), or a video of at most 3 s (`POST /uploads/videos?splash=true`), with a line of text in each language, skippable. The app shows what the last start saved and fetches the latest for the next, so nothing changes mid-start.
  - *Calculator:* the least down payment (0–50%, steps of 5) and the fewest/most years (1–30). A listing's own plan is always allowed, even outside them.
  - *Home order:* the nine sections after the headline and search box. A section with nothing to show still renders nothing.
- **Agent form:** a picker of listings to give the agent (`listingIds`; `GET /admin/agents/listing-options`); a listing always has an advisor, so one is taken away by giving it to someone else. The leads page and the listing form's advisor stay as they were.
- **Areas:** the picture is optional (`areas.image` is nullable). **Listings:** the developer is optional (it already was in the API; only the labels changed).
- **Web menu:** a side column (a drawer on phones) instead of the row of icons. "Add a listing" is now `/listing/new/`, reached from the Listings page.
- **Reports:** every table has a search box, a filter for each text column whose values repeat, and sorting (shared `viewRows`, `tableFilters`). The advisors report's rows open that advisor's own report (`/admin/analytics/advisor?agentId=`, `/report/?id=advisor&agentId=`), which is not in the list of reports.
- **Guest option:** "Continue as a guest" is a small link, not a button. It stays: App Store 5.1.1 lets people browse without an account.
- **Client accounts page kept (owner agreed):** the owner asked to remove it, but it is where an admin suspends or deletes an abusive client, which Apple 1.2 expects from an app with chat. Only the menu wording changed ("Client accounts").

**CodeRabbit fixes (2026-11-14):**
- *Agents:* creating an agent and giving it listings is one transaction. Editing is one transaction too: the fields, the listings, ending the sessions and invalidating old tokens. The agent's row is locked, so turning an agent off and giving them listings cannot interleave (`AgentStateError` → 409 or 400).
- *Settings:* a save reads, merges and writes under a row lock, so two parts saved at once both stay. A video is deleted only when neither a listing nor the opening screen still plays it, in both directions.
- *One advisor's report:* a viewing cancelled in the range is listed, matching its number.
- *App:* a saved store that cannot be read no longer holds the app at the splash (`core/storage`). The settings screen restarts a part from what the server holds, and takes only the parts it sent from a save's answer. The calculator brings remembered years inside limits that change while it is open.
- *Report tables:* filters have no 12-value cap, and a filter the table no longer offers is dropped. The search stays while it applies. A header click goes through both orders, then back.
- *Web drawer:* focus moves into it, the page behind is inert, and focus goes back to the menu button.
- Not changed: creating an agent who is off cannot happen (the create body has no `active`).

**Deploy script (2026-11-14):** `deploy/server-deploy.sh` dumps the database to `/root/maqar-backups/pre-deploy-<commit>.sql.gz` before the migrations, and checks the dump. `deploy/deploy.sh` checks the live site through nginx at the end and deletes that backup only when every step is green. Everything it prints also goes to `.dev-logs/deploy.log`, and a failure ends with the step, what is still running, the kept backup and how to restore it.

**Status (2026-11-14): built, not deployed.** Code and tests are green locally. Left: the deploy (migration `0023`) and a phone check with a new build.
