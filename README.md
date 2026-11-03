# مقر MAQAR — mobile front-end demo

A phone-only Next.js demo of the Maqar real-estate app. It is front-end only: all data is sample data, and state (favorites, viewings, listings, leads) is kept in the browser's localStorage.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
# or
npm run build && npm start
```

Open it on a phone, or use the browser's device toolbar. On a wide screen the app stays a 440 px phone column on the brand navy.

## What's in it

| Area | Where | Notes |
|---|---|---|
| Onboarding + smart picks | first launch, `/` | Purpose, budget, areas, must-haves. Each home gets an explainable match % (`src/lib/logic.ts → matchScore`). |
| Explore | `/explore` | Search, Buy / Rent / Stays / New projects, quick filters (360°, installments, ready, price dropped). The filter sheet has price and size ranges (two-thumb sliders over a histogram, plus typed min/max) and multi-select for type, bedrooms, bathrooms, area, delivery year, finishing and amenities. Active filters show as removable chips. |
| Property | `/property/[id]` | Gallery, price per m², price-drop alert, named sales advisor, installment calculator, amenities, map, similar homes. |
| 360° virtual tour | `/property/[id]/tour` | three.js viewer: drag with inertia, pinch/wheel zoom, gyroscope, in-scene hotspots, cross-fade between rooms. |
| Book a viewing | `/property/[id]/book` | On site or live video, day strip, hour slots, assigned advisor, reminders (1 day / 2 h / 30 min), confirm, `.ics` calendar file. |
| My viewings | `/viewings` | Upcoming and past, reschedule, cancel, directions, contact the advisor. Reminders fire as in-app and phone notifications. |
| Live chat (simulated) | `/chat`, `/chat/[id]`, `/agent/chats` | Chat with each home's advisor: typing indicator, read ticks, photos, quick questions. The advisor's replies are rule-based (Egyptian Arabic and English) and can send cards: home details, payment plan, 360° tour, and viewing times that book in one tap. The same conversations appear in the sales agent app, where the agent can reply and send those cards. |
| Saved + price alerts | `/saved` | Turning on an alert simulates a 5% price drop after ~8 s (demo). |
| Compare two homes | `/compare` | Tap the scale icon on any home (cards or listing page). A tray collects two; the compare page puts them side by side (price, price per m², installment, maintenance, size, rooms, finishing, delivery, location, amenities, demand), marks the better value in each row, and sums it up in a short verdict. |
| Installment calculator | `/calculator` | Developer 0% plan or bank finance, monthly or quarterly. |
| Owner portal | `/owner`, `/owner/new` | Views chart, interested clients, listing wizard. A submitted listing is "approved" after ~12 s (demo) and then shows in Explore. |
| Sales agent app | `/agent`, `/agent/leads` | Today's viewings, monthly target, pipeline, lead details with status and notes. Viewings booked in the client app show up here. |

Switch roles (client / owner / sales agent), language (Arabic / English) and phone notifications from **حسابي / Me**; dark mode is also one tap away on the home header. "Reset demo" clears the stored state.

## How it compares with MQR (the competing demo app)

From MQR's Android build (Expo / React Native, Arabic and English):

| | MQR | Maqar |
|---|---|---|
| Sale, rent, short stays, new projects | ✓ | ✓ |
| Search and filters | ✓ | ✓ plus one-tap quick filters |
| Contact with the seller | Blocked. Tap "I'm interested" and wait for their admin team to call | Live chat and calls with a named sales advisor (rating, reply time) |
| Book a viewing | Call to book | Pick the day and hour yourself, reschedule, cancel, get reminders, add to calendar |
| 360° virtual tour | — | ✓ room to room, gyroscope |
| Recommendations | Matching against a posted request | Match % for every home, with the reasons |
| Installment calculator | — | ✓ developer and bank plans |
| Price drop alerts | — | ✓ |
| Owner tools | Owners and brokers list units after ID review, with plan limits | Owner portal with views, interested clients and saves, plus review-before-publish |
| Sales agent app | — | ✓ leads pipeline, today's viewings, notes |

## Project layout

```
src/
  app/                 routes (all client-rendered behind a splash while state loads)
  components/          AppShell, TabBar, PanoViewer, InstallmentCalculator, PropertyCard, ui
  lib/
    data.ts            sample listings, areas, sales agents, tour rooms
    store.ts           persisted Zustand store (favorites, viewings, notifications, listings, leads)
    logic.ts           match score, installments, booking slots, .ics export
    agent.ts           sales agent leads
    demo.ts            simulated price drops, listing approval, notification permission
    i18n.ts            t("عربي", "English") helper and number/date formatting
```

## Assets

- Logo: the chosen Kufic lock-up, split into colour layers in `public/brand/` so it adapts to light and dark themes; the square mark is a vector (`components/Logo.tsx`).
- Photos: Unsplash. Panoramas: Poly Haven (CC0), resized to 4096×2048.
- Font: Readex Pro (Arabic + Latin).
