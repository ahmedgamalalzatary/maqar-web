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
| 2 | Production server and deploys | ⬜ | ~~7~~ decided; waits for the server to be bought |
| 3 | Browse listings | 🟨 | ~~2~~ decided |
| 4 | Property page | 🟨 | ~~4~~ decided |
| 5 | Search, filters and sort | 🟨 | |
| 6 | Preferences and smart picks | 🟨 | |
| 7 | Saved homes | ⬜ | |
| 8 | Installment calculator | 🟨 | |
| 9 | Compare two homes | ⬜ | |
| 10 | 360° virtual tour | ⬜ | ~~2~~ decided |
| 11 | Notifications and push | ⬜ | 3, 13 |
| 12 | Price drop alerts | ⬜ | |
| 13 | Viewing booking | ⬜ | 5, 8 |
| 14 | Viewing reminders | ⬜ | 13 |
| 15 | Sales agent app | ⬜ | |
| 16 | Live chat | ⬜ | 12 |
| 17 | Owner listings | ⬜ | 10, 11 |
| 18 | Admin review | ⬜ | 6 |
| 19 | Owner insights | ⬜ | |
| 20 | Release | ⬜ | 14 |

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
- `apps/api/Dockerfile`: a multi-stage build that ships only the built API and its production packages.
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

**Status (2026-11-09): in progress.** Built early for the store-approval app, on the `store-release` branch only: the formula (`packages/shared/src/installment.ts`) with its unit tests, and the standalone calculator screen (0% interest, monthly). Still to do: bring both to `main`, the API plan fields, the property-page calculator, the plan line, interest and quarterly options on the screen, and the check against the demo.

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

**Tests:** API tests for the room order. On a real device, check the frame rate and the gyroscope.

**Done when** the tour runs smoothly on a mid-range Android phone and on an iPhone.

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

---

## Phase 13: Viewing booking

**Decide first:** video viewings (§16.1 #5) and agent availability (#8).

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

**Done when** two phones racing for the same slot can't both get it, and booking, rescheduling and cancelling all work end to end.

---

## Phase 14: Viewing reminders

**Decide first:** background jobs and queue (§16.1 #13).

Contract §8.7 (reminders) and §8.8.

**Database:** `viewing_reminders`.

**API**
- A scheduled job sends `reminder` notifications at 1 day, 2 hours and 30 minutes before, as the client chose.
- Reminders are moved on reschedule and dropped on cancel.
- Each reminder is sent only once.

**Mobile:** the reminder choices from phase 13 are saved. Reminder pushes open My viewings.

**Tests:** each reminder fires once at the right time, moves on reschedule, and is skipped after cancel.

**Done when** a viewing booked about 35 minutes ahead gets its 30-minute reminder on the phone.

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

---

## Phase 17: Owner listings

**Decide first:** owner verification and listing limits (#10), and which edits need review (#11).

Contract §9.2.

**API**
- `POST /uploads` for photos: type and size checks, resizing.
- `POST /owner/listings` (draft).
- `PATCH /owner/listings/:id`.
- `POST /owner/listings/:id/submit` (sets `pending`).
- `GET /owner/listings`.
- Mark as sold or rented, and unpublish.

**Mobile**
- The 5-step wizard: type, location, details, photos (resized on the phone; the first one is the cover), review and submit.
- The owner's listings with status badges.

**Tests:** wizard validation (at least one photo), the status changes, upload limits, and that an owner can only reach their own listings.

**Done when** an owner can list a property with real photos and it shows as "in review".

---

## Phase 18: Admin review

**Decide first:** what form the admin UI takes (§16.1 #6).

Contract §11.

**API**
- `GET /admin/listings?status=pending`.
- Approve, which assigns an advisor and publishes the listing.
- Request changes, with a reason.
- Agents CRUD.
- Reassign a lead.
- Areas CRUD.
- Featured listings.
- `approval` notifications go to owners.

**Admin UI:** in whatever form #6 decides.

**Mobile (owner):** the listing status updates, the change request is shown with its reason, and the owner can edit and resubmit.

**Tests:** admin-only access, approve and request changes, assignment, and that an approved listing appears in public search.

**Done when** a listing submitted by an owner can be approved by an admin, the owner gets notified, and the listing appears in Explore as a "Verified owner listing".

---

## Phase 19: Owner insights

Contract §9.1.

**Database:** `listing_stats` (or events).

**API**
- Daily counts of views, saves and interested people.
- `GET /owner/listings/:id/stats`.
- `GET /owner/listings/:id/interested`, showing the clients who saved, followed, chatted or booked, with privacy rules applied.

**Mobile:** the owner portal overview, with the views chart, the totals, and the interested clients for each listing.

**Tests:** the counters, the date buckets, and the privacy of interested clients.

**Done when** what clients do in phases 7, 12, 13 and 16 shows up in the owner's numbers.

---

## Phase 20: Release

**Decide first:** analytics and crash reporting (#14).

Contract §15.

- **Accessibility:** screen-reader labels, contrast, text scaling, reduce motion.
- **Performance:** paging everywhere, image sizes, app start time.
- **Security:** rate limits, upload checks, secrets, and a review of every role guard.
- **Production:** the server and automatic deploys already run from Phase 2; check the backups and the restore again.
- **Mobile:** signed store builds for Android (the `store-build` GitHub Action) and iOS, store listings, app icons and splash in Maqar branding.
- **Full regression:** every phase's "done when" is run again.

**Done when** production builds are installed from the stores, or as internal builds, and work against the production API.
