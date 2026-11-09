# Maqar (مقر): project contract

This is the single source of truth for what Maqar is, what it does and how it is built.

**Rules for this file**

1. Anything new (a feature, screen, endpoint, table, rule or tool) is added here **before** it is built, or in the same commit.
2. If the code and this file disagree, this file wins. Either fix the code, or change this file on purpose in the same commit.
3. Removing or changing an agreed item means editing it here and adding a line to the [change log](#17-change-log).
4. The behaviour of the demo (`apps/demo`) is the reference for the user experience. The real apps must match it or improve on it, never do less.
5. Status tags used below:
   - **[Demo]**: built in `apps/demo`, simulated on the device
   - **[Real]**: needed in the real mobile app and API
   - **[Open]**: not decided yet; decide before building it

---

## Contents

1. [Product](#1-product)
2. [Users and roles](#2-users-and-roles)
3. [Platforms and repository](#3-platforms-and-repository)
4. [Tech stack](#4-tech-stack)
5. [Working rules](#5-working-rules)
6. [Brand and design](#6-brand-and-design)
7. [Language, numbers and formats](#7-language-numbers-and-formats)
8. [Features: client](#8-features-client)
9. [Features: owner](#9-features-owner)
10. [Features: sales agent](#10-features-sales-agent)
11. [Features: Maqar admin (review team)](#11-features-maqar-admin-review-team)
12. [Shared features](#12-shared-features)
13. [Data model](#13-data-model)
14. [API](#14-api)
15. [Non-functional requirements](#15-non-functional-requirements)
16. [Open decisions and out of scope](#16-open-decisions-and-out-of-scope)
17. [Change log](#17-change-log)

---

## 1. Product

**Maqar (مقر)** is a real-estate app for Egypt. Clients can find a home, see it, talk to a named sales advisor and book a viewing, all without leaving the app.

- Tagline: **لكل طموح ..مقر**
- Market: Egypt. Currency is EGP. Arabic first, English second.
- Listing categories:
  - **sale**: price is the purchase price
  - **rent**: price is per month
  - **stay**: short stays; price is per night
  - **project**: new developments, usually with a developer payment plan

### 1.1 Why clients pick Maqar over MQR

MQR is the competing app (Expo / React Native, Arabic and English). We analysed its Android build. Every row below is a promise the real product must keep.

| | MQR | Maqar |
|---|---|---|
| Sale, rent, short stays, new projects | ✓ | ✓ |
| Search and filters | ✓ | ✓ plus one-tap quick filters, range sliders and multi-select |
| Contact with the seller | Blocked. Tap "I'm interested" and wait for their admin team to call | Live chat and calls with a named sales advisor (rating, reply time) |
| Book a viewing | Call to book | Pick the day and hour yourself. Reschedule, cancel, get reminders, add to calendar |
| 360° virtual tour | ✗ | ✓ room to room, gyroscope |
| Recommendations | Matching against a posted request | Match % for every home, with the reasons |
| Installment calculator | ✗ | ✓ developer and bank plans |
| Price drop alerts | ✗ | ✓ |
| Compare homes | ✗ | ✓ two homes side by side, with a verdict |
| Owner tools | Owners and brokers list units after ID review, with plan limits | Owner portal: views, interested clients and saves, plus review before publishing |
| Sales agent app | ✗ | ✓ leads pipeline, today's viewings, notes, chat |

---

## 2. Users and roles

| Role | Who | Home screen | Can |
|---|---|---|---|
| **Guest** | Not signed in | Home | Browse, search, view listings, 360° tour, calculator, compare |
| **Client** (`buyer`) | Signed-in home seeker | Home | Everything a guest can, plus: save homes, price alerts, chat, book and manage viewings, notifications, preferences |
| **Owner** | Signed-in property owner | `/owner` | List properties (they go live only after Maqar approves them), see views, saves and interested clients per listing |
| **Sales agent** | Maqar employee | `/agent` | See assigned leads and viewings, move leads through stages, add notes, chat with clients |
| **Admin** [Real] | Maqar review team | Admin tools [Open] | Approve listings or ask for changes, manage agents, assign leads, manage areas |

Rules:

- One account has one role. Someone who is both a client and an owner uses two accounts (decided 2026-11-08).
- In the demo the role is switched from the Me tab. [Real] The role comes from the account: clients and owners sign up themselves, while agents and admins are created by an admin.
- Guests are asked to sign in at the moment they need an account (save, alert, chat, book), not before.

---

## 3. Platforms and repository

- **Mobile only.** Phone layout, portrait. No tablet or desktop layouts.
- One pnpm + Turborepo monorepo: `github.com/ahmedgamalalzatary/maqar-web`.

| Path | Package | Purpose |
|---|---|---|
| `apps/demo` | `@maqar/demo` | Next.js front-end demo. All data is sample data kept in localStorage. Port 3210. This is the UX reference. |
| `apps/mobile` | `@maqar/mobile` | The real app: Expo SDK 58 with Expo Router, for iOS and Android. |
| `apps/api` | `@maqar/api` | The real backend: NestJS 12, MySQL through Drizzle ORM. |
| `packages/tsconfig` | `@maqar/tsconfig` | Shared TypeScript configs. |
| `packages/shared` | `@maqar/shared` | Enums, bilingual labels, API request/response types and the formatters (§7), used by both the API and the app. Built to `dist/` before the apps typecheck, test or build. |
| `docs/` | | This contract and other docs. |

---

## 4. Tech stack

| Area | Choice |
|---|---|
| Package manager | pnpm 12 (version pinned in the root `package.json`) |
| Monorepo tasks | Turborepo 2: `dev`, `build`, `lint`, `typecheck`, `test` |
| Language | TypeScript, strict |
| Node | 22 or newer |
| Mobile | Expo SDK 58, Expo Router (`src/app` holds routes only), React Native 0.88, React 19.3, React Compiler, typed routes |
| Mobile UI | `@expo/ui` first for native controls; `expo-image`; Reanimated and Gesture Handler for motion; `lucide-react-native` icons (the same set as the demo) |
| Mobile packages | Installed with `npx expo install` so versions match the SDK |
| Mobile lint | ESLint 9 with `eslint-config-expo` (ESLint 10 is not compatible yet) |
| API | NestJS 12 (ESM): modules, guards, pipes, WebSocket gateway |
| API libraries | `@nestjs/config`, `@nestjs/swagger`, `class-validator` + `class-transformer`, `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`, `@node-rs/argon2` (hashing), `@nestjs/throttler`, `helmet`, `@nestjs/websockets` + `@nestjs/platform-socket.io` (chat), `@nestjs/schedule` (reminders), `@nestjs/event-emitter`, `sharp` (image resizing), `nestjs-pino` (logs), `date-fns` + `@date-fns/tz` (Africa/Cairo) |
| Mobile libraries | `@tanstack/react-query`, `zustand` + `@react-native-async-storage/async-storage`, `expo-secure-store` (tokens), `expo-localization`, `expo-notifications`, `expo-image-picker` + `expo-image-manipulator`, `expo-haptics`, `expo-calendar`, `expo-file-system` + `expo-sharing`, `expo-sensors` + `expo-gl` + `three` (360° tour), `@expo-google-fonts/readex-pro`, `react-native-svg`, `expo-linear-gradient`, `socket.io-client` |
| Not installed yet (waiting on §16.1) | Push sender (#3), job queue (#13), video (#5) |
| API tests | vitest. **Unit:** `test/unit/**/*.spec.ts`, for business rules, with no database (`pnpm test`). **e2e:** `test/e2e/**/*.e2e-spec.ts`, the real Nest app over HTTP (supertest) against the `maqar_test` database (`pnpm test:e2e`). Helpers in `test/utils`. Both configs load the root `.env.test`. |
| Mobile tests | Jest with the `jest-expo` preset, plus React Native Testing Library 14 (`render` is async). **Unit:** `test/unit/**`; **UI:** `test/ui/**` (screens and flows); helpers in `test/utils`. Setup is in `jest.setup.ts`, and `jest.env.js` loads the root `.env.test` (`pnpm test`). |
| API lint | oxlint |
| Database | MySQL 8, Drizzle ORM, `drizzle-kit` migrations (`src/db/schema.ts` → `drizzle/`) |
| Local database | The MySQL 8.0 already installed on the PC (`localhost:3306`, user `root`, the same password as the other work projects), database `maqar` (utf8mb4). root `.env` → `DATABASE_URL=mysql://root:…@localhost:3306/maqar` |
| Production database | A `mysql` service in the project's Docker Compose, configured by `.env.production` on the server (`MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `DATABASE_URL=mysql://maqar:…@mysql:3306/maqar`; `.env.production.example` in the repo lists them). The Docker files and `.env.production` are added in Phase 2. |
| Production server | Its own Hostinger KVM2 VPS (2 CPUs, 8 GB, about 100 GB disk), used only by Maqar. nginx on the server with a Let's Encrypt certificate for `api.<domain>` (the free domain from the Hostinger plan). Each deploy backs up the database and images, then runs the migrations (Phase 2). |
| File storage | The server's disk (an uploads volume), served by nginx; a local git-ignored `uploads/` folder in development. Images are resized with `sharp`. |
| Demo | Next.js 16, React 19.3, Tailwind v4, motion, three.js, Zustand |
| pnpm build scripts | Allowed: `esbuild`, `@parcel/watcher`. Denied: `@scarf/scarf` (telemetry). Set in `pnpm-workspace.yaml`. |

[Open] Push provider and the admin UI. See [section 16](#16-open-decisions-and-out-of-scope).

---

## 5. Working rules

- Commit and push straight to `main`. No feature branches.
- Commit only when asked.
- Commit messages: a short imperative subject and a body that says what and why.
- `pnpm build lint typecheck test` must pass before pushing.
- **One `.env` at the repo root** is used by every app (API, Drizzle, mobile). **Tests use the root `.env.test` instead** (`NODE_ENV=test`, port 4001, the `maqar_test` database). Both files are git-ignored. The root `.env.example` lists every variable and is kept up to date; `.env.test` holds the same variables with test values (the README lists them). Apps load the root file explicitly; they never have their own `.env`.
- Ports: the dev API runs on **4000** (tests on 4001), the demo on 3210, the Expo dev server on its default 8081.
- **Test first (TDD), only where it matters.** A test is written and seen to fail before the code. Tests cover business rules, formatters, auth and role guards, data rules and each screen's main flow and key states, not plumbing. All tests live in `test/` next to `src/`, sorted by kind.
- **Code layout.** API: `src/modules/<feature>/` (controller, service, repository, DTOs, module), plus `src/core` and `src/common`. Mobile: `src/features/<feature>/` (`api/`, `hooks/`, `components/`, `screens/`), plus `src/core`, `src/components`, and `src/app` for routes only.
- Database changes go only through Drizzle migrations. Never edit a production database by hand.
- Production server rules: Maqar has its own server and never goes on the owner's shared VPS. Run `nginx -t` before any reload. Delete only the backups you made yourself.
- Any text a user sees exists in both Arabic and English.

---

## 6. Brand and design

### 6.1 Identity

- **Logo:** the Kufic مقر lock-up with the square mark and the tagline "لكل طموح ..مقر". Colour layers are in `apps/demo/public/brand/`: full, gold, sage, cream, plus icons at 192, 512 and SVG. The square mark is also drawn as a vector.
- **Font:** Readex Pro, which covers Arabic and Latin.
- **Photos and panoramas:** in the demo they come from Unsplash, and the panoramas are Poly Haven CC0 images at 4096×2048. [Real] Owners and agents upload their own photos.

### 6.2 Colours

| Token | Light | Dark | Use |
|---|---|---|---|
| Navy (brand) | `#041525` | | Brand, text, dark surfaces |
| Gold (brand, accent) | `#b38959` | `#c9a06e` | Primary actions, highlights |
| Gold ink | `#87633a` | `#d8b483` | Gold text |
| Off-white / cream (brand) | `#fbf6e9` | | Light text on navy, logo |
| Sage (brand) | `#61766d` | | Secondary accent, success-like states |
| Sage ink | `#4d6158` | `#9bb3a7` | Sage text |
| Background | `#f6f2e9` | `#030f1b` | App background |
| Surface | `#ffffff` | `#0a1d2f` | Cards, sheets |
| Ink | `#041525` | `#f4eedf` | Main text |
| Danger | `#c2453a` | `#e2766b` | Errors, price drops, cancel |
| Success | `#3f7d5c` | `#6dbb8f` | Confirmations |

Soft variants are the same colour at 12–14% opacity. Lead stages have their own colours: see [section 10.2](#102-leads-and-pipeline).

### 6.3 UX principles

- Light and dark themes. The user switches with one tap from the home header and from Me. The demo starts in light; [Real] the first launch follows the system theme.
- RTL layout for Arabic and LTR for English. Use logical start/end spacing, never left/right. [Real] The app sets the layout `direction` on its root view from the language setting, so switching language is instant and needs no restart (no `I18nManager.forceRTL`).
- Bottom tab bar per role. Back buttons on inner screens. Bottom sheets for filters, sort and confirmations.
- A floating gold chat button sits above the tab bar at the bottom start corner (clients only). It moves up when the compare tray is showing.
- Haptic feedback on key actions, but only after the user has interacted.
- Every list has a designed empty state. Every action gives feedback: a toast, a badge or a notification.
- Tap targets are at least 44 pt. Text has enough contrast in both themes. Focus rings are visible but never doubled.
- Motion is smooth and short, and respects the system's reduce-motion setting.

---

## 7. Language, numbers and formats

- Arabic (Egyptian, friendly tone) is the default; English is optional. The setting is per user and saved.
- In the demo, every string is written with `t("عربي", "English")`, and data uses `Bi = { ar, en }`. [Real] Stored content that users see (titles, descriptions, area names) is kept in both languages. Content that users type (owner titles, chat) is kept as typed.
- Arabic UI shows Arabic-Indic digits (٠١٢٣); English UI shows Latin digits. Prices, counts, dates and times all follow this.
- Percent signs: `٪` in Arabic, `%` in English (`fmtPct`).
- Never put "·" or "•" next to Arabic digits, because they read as zero. Use "|" as the separator.
- Money: EGP, with compact forms for large values (for example ١١٫٢ مليون ج.م / EGP 11.2M).
- Dates and times follow the locale. Viewing times are whole hours, shown in 12-hour form with a period word.
- Relative times are used for activity ("2 hours ago").
- [Real] All of these formatters live in `@maqar/shared` (`fmtNum`, `fmtCompact`, `fmtMoney`, `fmtPct`, `fmtTime`, `fmtDate`, `relTime`). They are written by hand rather than with `Intl`, because Hermes lacks parts of `Intl` and the output must match on the API, both phones and in tests.

---

## 8. Features: client

### 8.1 Onboarding and preferences

- Shown to a new client right after sign-up, and can be reopened from Me → "Edit your preferences". Guests browse without it and are invited to sign up for picks.
- Steps:
  1. Name
  2. Purpose (multi-select: sale, rent, stay, project)
  3. Maximum budget (slider with typed input)
  4. Areas (multi-select)
  5. Unit types
  6. Minimum bedrooms
  7. Must-haves (amenities)
- Stored as `Prefs { purpose[], budgetMax, areas[], types[], beds, interests[] }`.
- [Real] Preferences belong to the account and drive recommendations and "new match" notifications.

### 8.2 Home

- Header: logo, then the dark-mode toggle next to the notifications bell (with an unread badge).
- Headline "لاقي بيتك، واحجز معاينته بنفسك." / "Find your home, book the viewing yourself."
- A search entry ("Area, compound or unit type") that opens Explore with the search box focused.
- Category shortcuts that open Explore on that category.
- **Your next viewing** card, shown when one is booked; it links to My viewings.
- Sections:
  - **Picked for you:** the homes with the highest match %, each with its reasons.
  - **Price drops:** shown only when there are some.
  - **Tour it before you go:** homes with a 360° tour.
  - **Browse by area**.
  - **New launches on installments**.

### 8.3 Smart recommendations (match score)

Every listing gets a score from 32 to 99 with up to two reasons (`matchScore`). The score starts at 40, then:

| Rule | Points |
|---|---|
| Listing category is in the client's purpose | +14 |
| Price within budget | +18, reason "Within budget" |
| Price up to 15% over budget | +6, reason "Near your budget" |
| Price more than 15% over budget | −18 |
| Area is one of the client's areas | +14, reason = area name |
| Client picked no areas | +4 |
| Unit type is one the client picked | +8 |
| Bedrooms ≥ client's minimum | +4 |
| Each amenity that matches a must-have | +4, up to +12 |
| Listing has a payment plan and the client picked must-haves | +2 |
| Listing has a 360° tour | +2 |

The price is compared on the client's terms:

- Rent budget (client's first purpose is rent): a rent listing compares as is; a stay compares as price × 4.
- Purchase budget: a rent listing compares as monthly price × 144 (12 years of rent); a stay compares as nightly price × 300.

[Real] Scoring runs on the server, so lists can be sorted by match and paged.

### 8.4 Explore (search, filters, sort)

- Free-text search across title, compound, area and developer.
- Category tabs: All, Buy (sale), Rent, Stays, New projects.
- **Quick filters** (one tap, can combine): 360° tour, installments (has a payment plan), ready to move in, price dropped.
- Delivery options: ready, 2027, 2028, 2029. [Real] The years come from the data.
- **Filter sheet:**
  - **Price range:** a two-thumb slider over a histogram of current results, plus typed min and max. The scale follows the category:

    | Category | Maximum | Step |
    |---|---|---|
    | Rent (monthly) | EGP 200,000 | EGP 5,000 |
    | Stay (nightly) | EGP 15,000 | EGP 500 |
    | Sale and project | EGP 30,000,000 | EGP 250,000 |

    With "All" selected, the price filter applies to sale and project listings only.
  - **Size range (m²):** the same two-thumb slider with a histogram.
  - **Multi-select:** unit type, bedrooms, bathrooms, area, delivery (ready or a year), finishing, amenities.
- Active filters show as removable chips, plus a "clear all" button.
- **Sort:** best match (default; cards show the match %), lowest price, highest price, newest.
- [Real] Filtering, sorting and paging are done by the API. The histogram counts come from the API too.

### 8.5 Property page

- Photo gallery with the cover first; 360° tour button when the listing has one.
- Title, compound, area, developer; price and price per m²; old price with the drop % when the price has fallen.
- Key facts: type, beds, baths, size, floor, finishing, delivery (ready or year), maintenance fee, days listed, views, number of interested people.
- Description (both languages).
- Amenities with icons.
- **Named sales advisor:** photo or initials, role, rating, number of deals, years, languages, typical reply time. Actions: chat, call.
- **Installment calculator** built in, at the `#installments` anchor, filled with the listing's plan.
- Location section with a map.
- Similar homes.
- Actions: save (heart), follow price (price alert), compare, share, chat, **Book a viewing** (main button).

### 8.6 360° virtual tour

- Full-screen viewer of equirectangular panoramas, one per room.
- Controls: drag with inertia, pinch and wheel zoom, gyroscope (with permission), hotspots inside the scene that move to other rooms, and a cross-fade between rooms. There is also a room list.
- Demo rooms: living room, kitchen and dining, master bedroom, bathroom, study, second bedroom.
- Panoramas are 4096×2048 or sharper.
- [Real] Admins upload panoramas per room (Phase 17; there are no owner accounts). [Open] How panoramas are captured and checked.
- [Real] Rooms are stored per listing (`tour_rooms`) and sent with the listing; cards say whether a home has a tour, and Explore's "360° tour" quick filter uses it.

### 8.7 Viewing booking

- Entry points: the property page, a chat "available times" card, and reschedule from My viewings.
- **Mode:** on-site visit, or live video.
- **Day strip:** the next 14 days. After 19:00 the default day is tomorrow.
- **Hour slots:** 10:00 to 20:00, every hour, grouped Morning (before 13:00), Afternoon and Evening.

  | Slot state | Rule |
  |---|---|
  | Past | Earlier hours of today |
  | Closed | Friday before 14:00 |
  | Taken | Already booked |
  | Free | Anything else |
- The assigned **sales advisor is shown by name**: "Omar will be there to meet you".
- **Reminders** (multi-select; default 1 day and 2 hours before): 1 day, 2 hours, 30 minutes.
- **Confirm:** the viewing is created as `confirmed` and the client gets a confirmation notification.
- **Add to calendar:** an `.ics` file with a 45-minute event and a built-in alarm 2 hours before.
- **Reschedule:** the same screen with the current slot preselected. Status becomes `rescheduled`, and the old date and time are kept (`rescheduledFrom`).
- A booking automatically creates or updates the client's **lead** for that agent, at stage `viewing`.
- [Real] The API checks the slot (one viewing per agent per hour, and the property must be open), so two people can never book the same slot. It also books from the agent's real availability. [Open] How agents set their working hours.

### 8.8 My viewings

- Tabs for upcoming and past.
- Each viewing shows the home, date and time, mode, advisor and status: `confirmed`, `rescheduled`, `cancelled` or `completed`.
- Actions: reschedule, cancel (asks to confirm), directions (opens maps), call or chat with the advisor, add to calendar, join video (for live video).
- Reminders arrive as in-app notifications plus phone notifications at the chosen offsets. [Real] The server schedules the push notifications.

### 8.9 Saved homes and price drop alerts

- Heart a home to save it. The Saved tab lists saved homes.
- **Follow price** (bell on the property page and in Saved) turns on a price alert for that home.
- When the price falls:
  - The listing shows the old price, the new price and the drop %.
  - The client gets an in-app notification ("Price dropped 5%: X is now Y, was Z") and a phone notification.
  - The home appears under "price dropped" filters.
- In the demo a 5% drop is simulated about 8 seconds after following.
- [Real] An alert fires whenever an owner, agent or admin lowers the price of a followed listing. Every price change is stored in price history.

### 8.10 Compare two homes

- A scale icon on every property card and on the property page adds the home to compare.
- At most 2 homes. Adding a third replaces the oldest, and a toast says so.
- A **compare tray** above the tab bar shows the picked homes and a "Compare" button.
- **`/compare`** shows both homes side by side:
  - Rows: price, price per m², monthly installment, maintenance, size, bedrooms and bathrooms, finishing, delivery, location, amenities, and demand (views and interested).
  - The better value in each row is marked.
  - A short verdict sums it up.

### 8.11 Installment calculator

- Opens from the property page (filled from the listing) or as a standalone screen (`/calculator`).
- Inputs:
  - unit price
  - plan: developer plan (0%) or bank finance (annual interest; default 18%)
  - down payment %
  - years
  - frequency: monthly or quarterly
- Outputs:
  - installment per period
  - down payment amount
  - number of installments
  - total paid
- Formula: principal = price − down payment; n = years × (12 or 4); rate per period r = annual rate ÷ periods per year.
  - If r = 0: payment = principal ÷ n.
  - Otherwise: payment = principal × r ÷ (1 − (1 + r)^−n).
- A listing's plan is shown as "مقدم X٪ على Y سنين" / "X% down over Y years".

### 8.12 Live chat with the advisor

- **One conversation per client and home**, with that home's advisor. Started from the property page or from the floating chat button.
- **`/chat`** lists conversations with the latest message preview, time and unread count.
- **Conversation screen:**
  - text, plus photos
  - quick-question chips
  - typing indicator
  - read ticks (sent, read)
  - a header with the advisor's name, the home, and call and view-home actions
- **Message types:**

  | Kind | Content |
  |---|---|
  | `text` | Plain text |
  | `images` | One or more photos |
  | `property` | Home details card |
  | `plan` | Payment plan card for a home |
  | `tour` | 360° tour card that opens the tour |
  | `slots` | Viewing times for a day. Tapping a time books it in one step, and the card shows which time was picked. |
  | `booking` | Confirmation card for a booked viewing |
- Unread counts appear on the chat button, in the chat list and on the agent's Chats tab. A new message from the advisor creates a notification unless that conversation is open.
- In the demo, advisor replies are rule-based (Egyptian Arabic and English keywords, such as price, installments, viewing and location), sent after a read moment and a typing moment.
- [Real] Replies come from real agents over a WebSocket gateway, with push when the app is in the background. Messages are stored. Photos are uploaded to storage. [Open] Auto-replies or AI help when the agent is away.

### 8.13 Notifications

- **`/notifications`** is an in-app inbox, newest first, with unread dots, "mark all read", and a tap that opens the related screen.
- Kinds:

  | Kind | When |
  |---|---|
  | `price` | A followed home's price dropped |
  | `reminder` | A viewing reminder |
  | `booking` | A viewing was confirmed, rescheduled or cancelled |
  | `approval` | An owner's listing was approved, or changes were requested |
  | `match` | New homes match the client's preferences |
  | `lead` | Agent: new lead or new booking |
  | `chat` | New chat message |
- **Phone notifications:** a switch in Me that the user can turn on **and off** at any time.
  - On asks for permission the first time.
  - If permission is blocked, the switch says so and explains how to allow it.
  - Off stops phone notifications, but in-app ones still arrive.
- [Real] Push goes through Expo push notifications [Open: confirm]. Device tokens are stored per user.

### 8.14 Me (profile and settings)

- Name, budget summary, verified badge.
- [Demo] Role switcher (client, owner, sales agent) for trying the app. [Real] Replaced by sign-in and sign-out; the role comes from the account.
- Settings: language (Arabic / English), dark mode, phone notifications, edit preferences, installment calculator.
- [Demo] "Reset demo" clears all stored state and chats, after a confirmation.
- [Real] Edit profile, change phone or email, delete account, privacy policy, terms, contact support, app version.

---

## 9. Features: owner

### 9.1 Owner portal (`/owner`)

- Overview with a views chart, plus totals for views, interested people and saves.
- My listings, each with a status badge: `pending` (in review), `approved` (live) or `changes` (changes requested).
- Each listing shows its views, interested people and saves, and its interested clients.

### 9.2 List a property (`/owner/new`)

A wizard in five steps:

1. **Type:** sell or rent out, then the unit type.
2. **Location:** area, plus a title (optional; if left empty it becomes "<type> <beds> beds | <area>").
3. **Details:**
   - bedrooms, bathrooms, size (m²)
   - asking price, or monthly rent when renting out
   - finishing
   - amenities
4. **Photos:** upload from the phone. The first photo is the cover. At least one photo is required. Photos are resized on the device before upload.
5. **Review:** a summary, a note that the Maqar team reviews every listing before it goes live (usually in under 24 hours), and **Submit for review**.

After submitting:
- The status is `pending` and the owner gets a "Listing submitted" notification.
- **Company approval is required.** A listing is never public before an admin approves it.
- When approved: the status becomes `approved`, the owner gets a notification, the listing appears in Explore as a "Verified owner listing", and it gets an assigned sales advisor.
- If changes are requested: the status becomes `changes`, the owner gets a notification with the reason, and the owner edits and resubmits.
- In the demo, approval is simulated about 12 seconds after submitting.

[Real] Owners can edit a listing; edits to price or key facts go back to review [Open: which edits need review]. Owners can mark a listing sold or rented, or unpublish it. [Open] Owner identity checks and listing limits.

---

## 10. Features: sales agent

### 10.1 Today (`/agent`)

- "Your day, <first name>" with the Sales app badge.
- Stats: today's viewings, new leads, active leads.
- Monthly target: deals won against the target, with a progress bar and a comparison with the team.
- Today's viewings with time, client, home or "Live video", and a "New from app" badge. Coming up: the next viewings.
- Pipeline summary by stage, linking to all leads.
- "Needs a first call": new leads that nobody has contacted yet.

### 10.2 Leads and pipeline

- **`/agent/leads`** lists all of the agent's leads, filtered by stage, with hot leads marked.
- **Lead fields:** client name, phone (masked in lists), home of interest, budget, source, stage, last activity, viewing (date, time, mode), hot flag, from-app flag.
- **Sources:** booked in app, 360° tour, price alert, smart pick, calculator, owner listing, chat.
- **Stages, in order:**

  | Stage | Colour |
  |---|---|
  | New | `#b38959` |
  | Contacted | `#3d5a80` |
  | Viewing | `#61766d` |
  | Negotiation | `#8c5e58` |
  | Won | `#3f7d5c` |
  | Lost | `#8a929a` |
- **Lead page (`/agent/lead/[id]`):**
  - client and home details
  - viewing
  - change the stage
  - add notes (newest first)
  - call, WhatsApp [Open], chat
- A viewing booked in the client app shows up straight away as a lead at stage `viewing`, marked "New from app".

### 10.3 Agent chats

- **`/agent/chats`** lists all conversations for the agent's homes, with unread counts. The Chats tab has an unread badge.
- The agent can reply with text and photos, and can send cards: home details, payment plan, 360° tour, and available viewing times.

---

## 11. Features: Maqar admin (review team)

[Real] This is not in the demo. The demo simulates its results: approvals and assigned advisors.

- **Listing review queue:** see pending listings, approve, or request changes with a reason.
- Manage agents: create and deactivate accounts, set areas and categories, set monthly targets.
- Assign each listing to an advisor. Reassign leads.
- Manage areas: names in both languages, city, image.
- Featured listings.
- [Open] Admin UI: a web dashboard, admin screens inside the mobile app, or API only at first.

---

## 12. Shared features

- **Tab bars:**
  - Client: Home, Explore, Viewings (badge: upcoming count), Saved, Me.
  - Owner: Portal, Add (listing wizard), Alerts (unread badge), Me.
  - Agent: Today, Leads, Chats (unread badge), Alerts (unread badge), Me.
  The tab bar is hidden on property, tour, booking, chat, listing wizard and lead screens.
- **Toasts** for quick feedback (gold, sage or danger), optionally tappable.
- **Splash screen** while state loads.
- **Deep links:** every notification and card opens its target screen. App scheme: `maqar`.
- **Share** a listing (system share sheet, with a link to the listing).
- **Calendar export** (`.ics`) for viewings.
- **Directions** to a property, opened in the phone's maps app.

---

## 13. Data model

This is the target MySQL model behind the real API. Names are given for the Drizzle schema in `apps/api/src/db/schema.ts`.

Conventions:
- Fields that hold text in two languages are stored as `*_ar` and `*_en` columns.
- Money is stored in whole EGP (bigint).
- Times are stored in UTC and shown in Africa/Cairo time.

| Entity | Main fields |
|---|---|
| **users** | id, role (`client` / `owner` / `agent` / `admin`), name, phone, email (unique; cleared on deletion), password_hash (argon2id; empty for Google-only accounts later), lang (`ar` / `en`), theme (`system` / `light` / `dark`), push_enabled, created_at, updated_at, deleted_at |
| **refresh_tokens** | id, user_id, token_hash (SHA-256 of the token), expires_at, revoked_at, created_at. A token is used once: refresh revokes it and issues a new one; replaying a revoked token revokes all of that user's tokens. |
| **client_prefs** | user_id, purposes[], budget_max, area_ids[], types[], min_beds, interests[] |
| **agents** (profile) | user_id, name_ar / name_en, role_title_ar / role_title_en, rating, deals_count, years, languages, avg_reply_mins, phone, colour, monthly_target, active |
| **areas** | id (slug), name_ar / name_en, city_ar / city_en, image |
| **properties** | id, category (`sale` / `rent` / `stay` / `project`), type, title_ar / title_en, area_id, compound_ar / compound_en, developer_ar / developer_en, price, old_price, beds, baths, size_m2, floor, finishing (`full` / `semi` / `core` / `furnished`), delivery (`ready` or year), agent_id, owner_id (nullable), status (`draft` / `pending` / `approved` / `changes` / `sold` / `rented` / `unpublished`), review_note, featured, maintenance_fee, plan_down_pct, plan_years, desc_ar / desc_en, lat, lng, views, published_at, created_at |
| **property_features** | property_id, feature (`pool`, `garden`, `sea`, `parking`, `elevator`, `security`, `gym`, `clubhouse`, `smart`, `roof`) |
| **property_images** | id, property_id, url, sort (0 = cover) |
| **tour_rooms** | id, property_id, name_ar / name_en, pano_url, sort, hotspots (JSON) |
| **price_history** | id, property_id, old_price, new_price, changed_by, at |
| **favorites** | user_id, property_id, created_at |
| **price_alerts** | user_id, property_id, created_at |
| **viewings** | id, property_id, client_id, agent_id, date, time, mode (`visit` / `video`), status (`confirmed` / `rescheduled` / `cancelled` / `completed`), rescheduled_from, video_url, created_at. Unique (agent_id, date, time) for active statuses. |
| **viewing_reminders** | viewing_id, offset (`1d` / `2h` / `30m`), sent_at |
| **leads** | id, client_id or name and phone, property_id, agent_id, budget, source, stage (`new` / `contacted` / `viewing` / `negotiation` / `won` / `lost`), hot, from_app, last_activity_at |
| **lead_notes** | id, lead_id, agent_id, text, created_at |
| **chat_threads** | id, client_id, property_id, agent_id, lead_id, created_at. Unique (client_id, property_id). |
| **chat_messages** | id, thread_id, sender (`client` / `agent`), kind (`text` / `images` / `property` / `plan` / `tour` / `slots` / `booking`), body (JSON), read_at, created_at |
| **notifications** | id, user_id, kind (`price` / `reminder` / `booking` / `approval` / `match` / `lead` / `chat`), title_ar / title_en, body_ar / body_en, href, read_at, created_at |
| **push_tokens** | id, user_id, token, platform, created_at |
| **listing_stats** (or events) | property_id, date, views, saves, interested, used for the owner chart |

Supporting rules:

- `interested` means the number of clients who chatted about, booked or followed the home.
- Every price change writes a `price_history` row, then fires `price` notifications to everyone with a `price_alerts` row for that home, but only when the price went down.

---

## 14. API

[Real] REST + JSON under `/v1`, plus a WebSocket gateway for chat. Errors use the standard NestJS shape. Input is checked by validation pipes. API docs are OpenAPI (Swagger), generated by the API.

| Module | Endpoints (planned) | Who |
|---|---|---|
| auth | `POST /auth/sign-up` (client or owner only), `POST /auth/sign-in`, `POST /auth/refresh`, `POST /auth/sign-out`. Sign-up and sign-in are rate limited per IP (`AUTH_RATE_LIMIT` a minute). | public |
| me | `GET/PATCH /me`, `PUT /me/prefs`, `POST /me/push-tokens`, `DELETE /me` (needs the password; clients and owners only, staff are removed by an admin) | signed in |
| areas | `GET /areas` | public |
| properties | `GET /properties` (search, filters, sort incl. match, paging), `GET /properties/facets` (match count, price and size histograms, delivery years), `GET /properties/:id`, `GET /properties/:id/similar`, `GET /properties/compare?ids=` (one or two homes for the compare screen; counts no view), `GET /properties/recommended`, `GET /properties/match-count` (homes that fit given preferences 70% or more, for onboarding) | public; `sort=match` and `recommended` need a signed-in client |
| favorites | `GET /favorites`, `PUT/DELETE /favorites/:propertyId` | client |
| price alerts | `GET /alerts`, `PUT/DELETE /alerts/:propertyId` | client |
| viewings | `GET /properties/:id/slots?from&to`, `POST /viewings`, `GET /viewings`, `PATCH /viewings/:id` (reschedule, cancel), `GET /viewings/:id/ics` | client; agent sees own |
| chat | `GET /chats`, `POST /chats` (property), `GET /chats/:id/messages`, `POST /chats/:id/messages`, `POST /chats/:id/read`, WebSocket: message, typing, read | client, agent |
| notifications | `GET /notifications`, `POST /notifications/read-all`, `POST /notifications/:id/read` | signed in |
| owner | `GET /owner/listings`, `POST /owner/listings`, `PATCH /owner/listings/:id`, `POST /owner/listings/:id/submit`, `GET /owner/listings/:id/stats`, `GET /owner/listings/:id/interested` | owner |
| uploads | `POST /uploads` (photos, panoramas), stored on the server disk and served at `/uploads/...` | owner, agent, client (chat) |
| agent | `GET /agent/today`, `GET /agent/leads`, `GET/PATCH /agent/leads/:id`, `POST /agent/leads/:id/notes` | agent |
| admin | `GET /admin/listings?status=pending`, `POST /admin/listings/:id/approve`, `POST /admin/listings/:id/request-changes`, agents CRUD, `PATCH /admin/leads/:id/assign`, areas CRUD | admin |

Access is checked by role guards on every route. Owners and agents can only reach their own data.

---

## 15. Non-functional requirements

- **Security:**
  - Hashed secrets, short-lived access tokens, role guards.
  - Rate limits on auth and on writes that can be abused (chat, bookings).
  - Phone numbers are masked in agent lists.
  - Uploads are checked for file type and size.
- **Privacy:** a client's contact details are visible only to their assigned agent and to admins. Account deletion is supported.
- **Performance:**
  - Lists are paged.
  - Images are served resized; panoramas are loaded room by room.
  - The app opens fast, with the splash shown only while loading.
- **Reliability:** booking a slot is atomic, so the same slot can't be booked twice. Reminders and pushes run from a server job queue [Open].
- **Accessibility:** screen-reader labels on icon buttons, contrast in both themes, text that scales with system settings, reduce-motion support.
- **Quality:**
  - Strict TypeScript.
  - Lint, typecheck and tests pass in Turbo.
  - The API has unit tests for rules (match score, installments, slots, price alerts) and e2e tests for key flows.

---

## 16. Open decisions and out of scope

### 16.1 Open decisions

| # | Question |
|---|---|
| 1 | ~~Auth method~~ **Decided:** email + password now; Google sign-in (OAuth) is added later. Access tokens (JWT, 15 min) plus rotating refresh tokens (30 days). |
| 2 | ~~File storage~~ **Decided:** photos and panoramas on the production server's disk, served by nginx. A CDN can be added later if needed. |
| 3 | ~~Push~~ **Decided:** Expo push service. |
| 4 | ~~Maps provider~~ **Decided:** `react-native-maps` (free; Apple Maps on iOS, Google Maps on Android; included in Expo Go). Directions open the phone's maps app on the listing's location, so no paid directions API. Android store builds need a free, restricted Google Maps key (`GOOGLE_MAPS_API_KEY`, passed to the config plugin in `app.config.ts`). |
| 5 | ~~Video viewings~~ **Decided:** none for now; in-person visits only. ⚑ May be added later, so keep the `mode` column (`visit` only for now). |
| 6 | ~~Admin UI form~~ **Decided:** both a web dashboard and admin screens inside the app. |
| 7 | ~~Hosting~~ **Decided:** a new Hostinger KVM2 VPS only for Maqar, Docker Compose (API + MySQL) configured by `.env.production`, and the free domain from the Hostinger plan with Let's Encrypt HTTPS. |
| 8 | ~~Agent working hours~~ **Decided:** each agent has weekly working hours per day, plus holidays and days off. An admin sets them for one agent or several at once. Viewing slots and the chat auto-reply follow them. |
| 9 | ~~Client and owner on one account?~~ **Decided:** no, one role per account. |
| 10 | ~~Owner verification and limits~~ **Removed:** there are no owner accounts (see the 2026-11-09 change log). |
| 11 | ~~Owner edits~~ **Removed:** only admins edit listings. |
| 12 | ~~Agent away~~ **Decided:** outside working hours, an automatic reply says to contact Maqar during working hours, until an agent picks up the chat. |
| 13 | ~~Background jobs~~ **Decided (for now):** a simple scheduler inside the API, no Redis or queue. |
| 14 | ~~Analytics and crash reporting~~ **Decided:** out of scope for now. |

### 16.2 Out of scope (until this file says otherwise)

- Tablet and desktop layouts.
- Online payments, deposits and contracts.
- Broker or agency accounts outside Maqar.
- Mortgage applications with banks (the calculator only estimates).
- A public web version of the app. `apps/demo` is a sales demo, not a product.

---

## 17. Change log

| Date | Change |
|---|---|
| 2026-11-04 | First version: all demo features, monorepo layout, stack, target data model and API. |
| 2026-11-04 | Database setup decided: the local MySQL 8.0 for development, Docker Compose MySQL with `.env.docker` for production. |
| 2026-11-04 | One `.env` at the repo root for all apps. |
| 2026-11-04 | Tests read the root `.env.test`. |
| 2026-11-04 | API and mobile libraries installed; test setup for both apps (vitest unit + e2e on `maqar_test`; Jest + Testing Library on mobile). |
| 2026-11-08 | Phase 0 built (the phone check is still pending): `packages/shared`, API foundation (env check, Drizzle MySQL, `/v1`, validation, helmet, CORS, Swagger at `/docs`, `GET /v1/health`), mobile foundation (fonts, splash, theme, Arabic-first i18n with RTL, API client, React Query, toasts, role tab layouts). TDD made a working rule. `.env.test.example` and `.env.docker.example` removed. |
| 2026-11-08 | Phase 1 built (the phone check is still pending). Decided: email + password sign-in (Google OAuth later) and one role per account. Added `refresh_tokens`, `users.password_hash`, `agents.name_ar/name_en`. Ports back to 4000 (API) and 4001 (tests). Prettier removed. |
| 2026-11-09 | Decided: hosting on a new Hostinger KVM2 VPS with the plan's free domain (#7), and file storage on its disk (#2). Production config is `.env.production` (not `.env.docker`). Deployment became Phase 2 (deploys back up the database and images, then run migrations); the later phases moved up by one, so there are now 21 (0 to 20). The installment formula and calculator screen were built early for the store app (Phase 8, in progress). |
| 2026-11-09 | Phase 3 built (the phone check is still pending): `areas`, `properties`, `property_features`, `property_images`; `GET /areas` and `GET /properties` (category and area filters, paging); Home and Explore in the app. `UPLOADS_DIR` added to the env. The installment formula is in `packages/shared` on `main`. |
| 2026-11-09 | Decided: maps with `react-native-maps`, directions through the phone's maps app (#4). Phase 4 built (the phone check is still pending): `GET /properties/:id` (counts views), `GET /properties/:id/similar`, `properties.lat/lng`, and the property page. `GOOGLE_MAPS_API_KEY` added for Android builds. |
| 2026-11-09 | Phase 5 built (the phone check is still pending): search, every filter and the sorts on `GET /properties`, and the new `GET /properties/facets` for the filter sheet's counts and histograms. Search also matches unit type names. The 360° tour quick filter moved to Phase 10, which brings the tour data. |
| 2026-11-09 | Phase 6 built (the phone check is still pending): `client_prefs`, `PUT /me/prefs`, `prefs` on `/me`, the match score on the server, `sort=match`, `GET /properties/recommended`, and the new `GET /properties/match-count` for onboarding's live count. Onboarding now follows sign-up rather than first launch, because preferences belong to the account; guests get an invitation instead. The tour's +2 waits for Phase 10. |
| 2026-11-09 | Phase 9 built (the phone check is still pending): compare two homes. The new `GET /properties/compare?ids=` returns both homes' details in one call without counting views, unlike `GET /properties/:id`. The better-value rule and the verdict live in `packages/shared`. The "interested" demand row and the 360° tour amenity row wait for the phases that bring that data (12, 13, 16 and 10). |
| 2026-11-09 | Decided: admin tools are a web dashboard plus screens inside the app (#6); analytics and crash reporting are out of scope for now (#14). |
| 2026-11-09 | Decided: Expo push (#3); a scheduler inside the API for timed jobs (#13); in-person viewings only, video may come later (#5); admins set agents' weekly hours (#8); an out-of-hours auto-reply in chat (#12). **Scope change:** the owner role is removed. Owners deal with Maqar directly, and admins create and manage every listing, so owner screens and accounts go and their work moves to the admin tools; #10 and #11 no longer apply. Phases 17–19 are to be re-planned. |
| 2026-11-09 | Decided: chats stay with each home's advisor; agents' hours can be set one by one or for several at once, plus holidays; owner insights move to the admin tools. Phases re-planned: owner clean-up in 10, hours and holidays data in 13, 17 Admin listings, 18 Admin tools, 19 Listing insights. The owner sections of §2, §9 and §11 are to be rewritten when those phases start. |
| 2026-11-09 | Phase 10 built (the phone check is still pending): `tour_rooms`, `tourRooms` on the property detail, `tour` on cards and as a filter, the +2 match points for a tour, and the 360° viewer. The owner role is removed from the code and the database (migration `0005` deletes owner accounts and drops `properties.owner_id`); sign-up is for clients only and its `role` field is optional. |
| 2026-11-09 | The backend runs on a temporary server (`187.55.224.15`, shared with another project) at `https://187-55-224-15.sslip.io`, with no domain and no backups, until the dedicated server in #7 exists. `TRUST_PROXY_HOPS` added to the env. See Phase 2's status. |
