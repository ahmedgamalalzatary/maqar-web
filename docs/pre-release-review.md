# Pre-release review through Phase 19

Review date: 2026-11-11. Base commit: d7bdf46d453e52dc5561ab5e516d90bf41954213.

This is a review of the working tree, including the uncommitted Phase 19 implementation. Application code was not changed for this review. Other development was happening during inspection; findings describe the implementation inspected, and fixes should be verified against the current tree before closing an item.

## Scope and how to use this report

Covered: the NestJS API, database schemas and repositories, shared rules and types, Expo mobile client/agent/admin flows, Next.js admin tools, upload and notification paths, deployment/build scripts, and the project contract and phase plan. The demo is temporary and is not assessed as a fourth production application. Its remaining production build dependency is covered below.

This is a source and automated-check review, not a completed penetration test, native-device usability audit, load test, database restore rehearsal, or full production regression. No production requests, production migrations, account changes, or deployment actions were performed. API e2e tests were read but not run: their global setup drops/recreates the test schema, and development was active in the same workspace.

Every finding identifies the problem, its files, a concrete trigger or evidence, and a suggested acceptance check. Paths are relative to the repository root; links work from this document.

| Area | Item IDs | Count |
|---|---|---|
| Security, sessions, privacy | SEC-01–SEC-10 | 10 |
| Booking/listing state and durable operations | DATA-01–DATA-11 | 11 |
| Phase 19 insights | INS-01–INS-09 | 9 |
| Mobile/admin UX, forms, completeness | UI-01–UI-27 | 27 |
| Production/release/documentation | OPS-01–OPS-09 | 9 |
| Verification gaps | QA-01–QA-04 | 4 |
| **Total documented items** | | **70** |

Severity:

- **P1:** significant correctness, privacy, availability, data-loss, or core-flow issue; address or explicitly resolve before release.
- **P2:** meaningful reliability, UX, operational, or completeness issue; schedule before the final regression where practical.
- **P3:** lower-impact consistency or documentation issue.

Evidence:

- **Confirmed source defect:** the relevant code path is present; this does not imply a live-device or production reproduction.
- **Reproduced in isolation:** a read-only in-memory check exercised the relevant behavior.
- **Concurrency/failure risk:** the implementation lacks the guard needed for a specified interleaving or failure; a dedicated integration test is still needed.
- **Known deferred gap / decision:** incomplete functionality or deployment work already acknowledged by the plan, or a product decision that needs to be explicit. These are not presented as surprise regressions.

## Deferred by the owner

Marked on 2026-11-11. These items stay out of scope for now **by the owner's decision**. They aren't open defects, and they come back only when the owner says so.

| Item | What is deferred | Why |
|---|---|---|
| OPS-01 | Firebase configuration in Android builds | The owner sets up the Firebase project (Phase 11 ⚑) |
| OPS-02 | Signed iOS distribution build | Needs the Apple Developer Program (Phase 11 ⚑) |
| OPS-03 | Store version and build numbers | Matter only for store publishing |
| OPS-04 | Automatic deploys and builds on push | Deploys run by hand; builds start only when asked |
| OPS-05 | Backups and restore test | Temporary server with demo data only |
| OPS-07 | The API's Docker build no longer needing the demo | The demo is kept for now |
| QA-04 (demo line) | Removing the seeded demo accounts and data | The project is in testing |
| QA-04 (last line) | The pending phone checks | Scheduled after Phase 20, the full review and the builds |

In "First things to resolve" below, item 6 excludes the deferred items above.

## First things to resolve

1. Fix the Phase 19 chart range-switch crash (INS-01), preserve meaningful historical interest counts (INS-02), and define the metrics clearly.
2. Close socket/session revocation and account-cache gaps (SEC-01, SEC-02, SEC-05).
3. Enforce booking invariants in the database and make booking/card/status changes atomic (DATA-01 through DATA-04).
4. Separate durable business operations from notification delivery failures, and make reminders recoverable (DATA-07, DATA-08).
5. Fix the mobile admin listing truncation and other inaccessible older records (UI-14, UI-15).
6. Provide backups, an actual release build/push configuration, and a reliable green check gate (OPS-01 through OPS-05, QA-01).

## Automated checks and evidence

These results are observations of an evolving working tree, not a claim that the current release candidate is green.

| Check | Observed result |
|---|---|
| Shared unit tests | 115 passed, 12 files |
| API unit tests | 26 passed, 5 files; expected push-error fixtures produced warning logs |
| Admin web tests | 6 passed, 1 file; Vite reported a config module-format warning |
| Mobile full suite | 301 passed, 4 failed, 50 suites total at that snapshot; failures were in booking tests; React act warnings and an open-handle warning also appeared |
| Later booking + insights run | 8 passed, 4 failed; booking tests still failed, including a timeout; insights suite passed |
| API typecheck | Passed |
| Web TypeScript check | Passed using tsc --noEmit |
| Mobile typecheck | Initially failed on three Phase 19 test typing errors; a later run passed after concurrent development changed the tree |
| Web/mobile lint | Commands completed successfully in the observed run |
| API lint | Completed with an unused ChatThread type import warning in the insights e2e test |
| API e2e / migrations / native exports / Docker build | Not executed in this review |

Read-only isolated checks also established:

- The admin web API client clears a valid saved session when an access-token 401 is followed by an offline refresh request.
- DTO validation accepted listing price/category null and profile name/pushEnabled null with no validation errors, using the existing compiled DTOs. The matching source decorators were also inspected.
- A 90-day chart selection index of 89 is invalid after a 7-day replacement; dereferencing that selection throws TypeError. This demonstrates the index failure, not a native render capture.
- In a UTC+14 process, the chart's noon-UTC formatting turns the Cairo day 2026-11-11 into 12 Nov, while formatting the date-only value preserves 11 Nov.
- Calculated secondary-text contrast: light ink3 on white 3.15:1, on the light page background 2.82:1; dark ink3 on the dark surface 3.95:1.

## Security, sessions, and privacy

### SEC-01 — Existing sockets survive access-token expiry and agent deactivation

**Priority / evidence:** P1, confirmed source defect.

**Where:** [chat.gateway.ts](../apps/api/src/modules/chat/chat.gateway.ts), [chat.realtime.ts](../apps/api/src/modules/chat/chat.realtime.ts), [token-users.ts](../apps/api/src/modules/auth/token-users.ts), [agents.service.ts](../apps/api/src/modules/agents/agents.service.ts).

**Problem:** Socket authentication runs in handleConnection only. Later open/typing events trust socket.data.user, and the socket remains in the user's room for server-pushed messages. There is no token-expiry timer or deactivation/password-reset disconnect. HTTP rechecks the account, but an already connected inactive agent can continue receiving live conversation events.

**Trigger / impact:** Connect as an agent, deactivate that agent, then send a client message on an existing thread. The server still has the old socket in the agent's room. Revocation therefore does not mean immediate loss of live access.

**Follow-up / acceptance:** Revalidate or terminate sockets on expiry and session/account revocation. Test an already connected socket after deactivation, password reset, and token expiry; assert that both incoming events and outgoing actions stop.

### SEC-02 — Resetting an agent password does not invalidate existing access tokens

**Priority / evidence:** P1, confirmed source defect.

**Where:** [agents.repository.ts](../apps/api/src/modules/agents/agents.repository.ts), [agents.service.ts](../apps/api/src/modules/agents/agents.service.ts), [token-users.ts](../apps/api/src/modules/auth/token-users.ts), [auth.service.ts](../apps/api/src/modules/auth/auth.service.ts).

**Problem:** endSessions revokes refresh tokens. Access tokens contain a user id/role and are accepted while their signature, expiry, and active account are valid. No session version or issued-before/password-change check invalidates an old access token after a password reset.

**Impact:** The promise that a new password signs the agent out everywhere is stronger than the implementation: existing HTTP access can continue until expiry, and SEC-01 extends the socket issue further.

**Acceptance:** Keep an old access token, reset the agent password, and verify that a protected HTTP request using the old token fails immediately. Define whether normal sign-out also revokes access or intentionally waits for expiry.

### SEC-03 — Abuse-prone writes have no effective rate limit

**Priority / evidence:** P1, confirmed implementation/contract mismatch.

**Where:** [auth.module.ts](../apps/api/src/modules/auth/auth.module.ts), [auth.controller.ts](../apps/api/src/modules/auth/auth.controller.ts), [chat.controller.ts](../apps/api/src/modules/chat/chat.controller.ts), [viewings.controller.ts](../apps/api/src/modules/viewings/viewings.controller.ts), [notifications.controller.ts](../apps/api/src/modules/notifications/notifications.controller.ts), [nginx-maqar.conf](../deploy/nginx-maqar.conf), contract §15.

**Problem:** ThrottlerGuard is attached to the auth controller only. Registering ThrottlerModule does not apply it to chat, bookings, uploads, notification test requests, or socket typing events. nginx has body-size limits but no request-rate limits.

**Impact:** A signed-in account can generate large numbers of messages, notifications, uploads, or booking attempts. Public property detail requests also perform analytics writes on every request.

**Acceptance:** Exercise per-user and per-IP bursts against each costly route/event. Assert a bounded rate, appropriate 429/retry behavior, and that one client's abuse does not block every client behind the proxy.

### SEC-04 — Chat attachments are served as public files

**Priority / evidence:** P1 privacy decision, confirmed source behavior.

**Where:** [chat.service.ts](../apps/api/src/modules/chat/chat.service.ts), [app.setup.ts](../apps/api/src/app.setup.ts), [nginx-maqar.conf](../deploy/nginx-maqar.conf).

**Problem:** Conversation JSON is access-controlled, but attachments are returned as /uploads/chat/thread-id/random-name.jpg and the entire uploads tree is served without authentication. Knowing the URL is sufficient to retrieve an image outside the conversation.

**Impact:** Random names reduce discovery but do not provide recipient authorization. A forwarded URL, log entry, or cached link remains usable independently of the intended user's session.

**Acceptance:** Decide explicitly whether attachments are private. If private, an anonymous caller and an unrelated signed-in user must be unable to fetch the attachment; authorized participants must still be able to view it without leaking bearer tokens in URLs.

### SEC-05 — Notifications and recommendations are not consistently scoped to the account

**Priority / evidence:** P1 for inbox privacy, P2 for recommendations; confirmed source risk.

**Where:** [use-notifications.ts](../apps/mobile/src/features/notifications/hooks/use-notifications.ts), [use-prefs.ts](../apps/mobile/src/features/prefs/hooks/use-prefs.ts), [session.store.ts](../apps/mobile/src/features/auth/store/session.store.ts), [use-auth.ts](../apps/mobile/src/features/auth/hooks/use-auth.ts).

**Problem:** Inbox queries use the shared notifications key and recommendations use properties/recommended without a user id. Explicit sign-out clears QueryClient, but automatic auth failure only clears the session store, and subsequent sign-in does not clear those caches.

**Trigger / impact:** Account A expires or is revoked, then account B signs in within the same running app. Cached A inbox content can appear while B's request loads, and A recommendations/match data can be reused. Saved homes, chats, and agent data already use account-specific keys, so this is inconsistent.

**Acceptance:** Test account switching after automatic expiry, not only after pressing Sign out. No account should render another account's cached inbox or recommendations.

### SEC-06 — Admin web logs out users on a temporary refresh failure

**Priority / evidence:** P1, reproduced in isolation.

**Where:** [api.ts](../apps/web/src/lib/api.ts), functions refreshOnce/request.

**Problem:** Network exceptions and all non-OK refresh responses become false; request then calls end and deletes the saved session. A temporary network failure or server 500 is treated like an invalid refresh token.

**Impact:** An admin working with an expired access token loses their session during an outage, potentially interrupting a long listing form. Mobile's refresh code already distinguishes a rejected token from temporary errors.

**Acceptance:** Return 401 for the original request, then make refresh fail with a network error or 503. Preserve the session and allow recovery; only a confirmed invalid/revoked refresh token should end it.

### SEC-07 — Independent web tabs can trigger refresh-token replay protection against each other

**Priority / evidence:** P1 concurrency risk.

**Where:** [client.ts](../apps/web/src/lib/client.ts), [api.ts](../apps/web/src/lib/api.ts), [auth.service.ts](../apps/api/src/modules/auth/auth.service.ts).

**Problem:** The web client caches localStorage in a module variable, does not subscribe to storage events, and deduplicates refreshes only within one tab. Two tabs can submit the same rotating refresh token. The server interprets the second use as replay and revokes every refresh session for that account.

**Acceptance:** With two authenticated tabs and expired access tokens, request data simultaneously. Both tabs should recover without revoking all sessions. Coordinate refreshes across tabs and make stored session changes visible across them.

### SEC-08 — An in-flight mobile refresh can restore a session after local sign-out/account change

**Priority / evidence:** P2 concurrency risk.

**Where:** [session.store.ts](../apps/mobile/src/features/auth/store/session.store.ts), [api.ts](../apps/mobile/src/core/api/api.ts), [use-auth.ts](../apps/mobile/src/features/auth/hooks/use-auth.ts).

**Problem:** refresh captures a token, awaits the server, then unconditionally calls setSession. There is no generation/token-ownership check before applying the response.

**Trigger / impact:** A delayed refresh overlaps sign-out or a second login. Its result can overwrite the newer session state or rewrite secure storage with the old account's token.

**Acceptance:** Delay a refresh, clear/switch the session, then release the old response. Assert that the newer session remains authoritative and the old response cannot sign the user back in.

### SEC-09 — PATCH validation accepts null for non-nullable fields

**Priority / evidence:** P1, reproduced at the validator boundary.

**Where:** [listing.dto.ts](../apps/api/src/modules/listings/dto/listing.dto.ts), [agents.dto.ts](../apps/api/src/modules/agents/dto/agents.dto.ts), [areas.dto.ts](../apps/api/src/modules/areas/dto/areas.dto.ts), [update-me.dto.ts](../apps/api/src/modules/users/dto/update-me.dto.ts), corresponding service/repository updates.

**Problem:** PartialType/IsOptional skip null as well as missing values. Required database fields such as listing price/category and user name/pushEnabled can therefore pass validation as null. The update code does not consistently reject or remove those nulls.

**Impact:** Invalid input reaches database constraints and can return generic 500s instead of a useful 400; optional and explicitly nullable fields are not distinguished.

**Acceptance:** Exercise null on every PATCH field. Preserve intentional clears such as phone/location/plan, and reject null for required fields before reaching the database. The isolated checks returned no validation errors for the invalid examples above.

### SEC-10 — Inactive-agent email conflicts and concurrent sign-ups can become 500s

**Priority / evidence:** P2, confirmed source defect plus concurrency risk.

**Where:** [auth.service.ts](../apps/api/src/modules/auth/auth.service.ts), [users.repository.ts](../apps/api/src/modules/users/users.repository.ts), [users.schema.ts](../apps/api/src/modules/users/users.schema.ts).

**Problem:** Sign-up checks findActiveByEmail, which excludes deactivated agents, then inserts into a table with a unique email constraint. That inactive agent's email is still occupied. Two concurrent sign-ups can also both pass the pre-check. Neither insert path translates the resulting duplicate-key error to Conflict.

**Acceptance:** Sign up with the email of a deactivated agent and submit two sign-ups for the same new email concurrently. Return a stable 409 rather than an internal server error.

## Booking, listing state, and durable operations

### DATA-01 — One active viewing per client/home is not enforced atomically

**Priority / evidence:** P1 concurrency risk.

**Where:** [viewings.service.ts](../apps/api/src/modules/viewings/viewings.service.ts), [viewings.repository.ts](../apps/api/src/modules/viewings/viewings.repository.ts), [viewings.schema.ts](../apps/api/src/modules/viewings/viewings.schema.ts).

**Problem:** book checks activeFor before entering the insert transaction. The unique key protects agent/hour/active, but not client/property/active.

**Trigger / impact:** Two simultaneous requests for the same client and home at different hours can both pass activeFor and both commit. The app's rule of one live viewing per home is violated even though the agent's hours remain individually unique.

**Acceptance:** Race bookings for two different hours on the same home/client. Exactly one should succeed. Enforce the invariant with a database constraint or a correctly locked transaction, not only a pre-check.

### DATA-02 — Past confirmed viewings never reach Completed and can block future bookings

**Priority / evidence:** P1, confirmed lifecycle gap.

**Where:** [viewings.repository.ts](../apps/api/src/modules/viewings/viewings.repository.ts), [viewings.service.ts](../apps/api/src/modules/viewings/viewings.service.ts), [viewings.schema.ts](../apps/api/src/modules/viewings/viewings.schema.ts), [enums.ts](../packages/shared/src/enums.ts), [viewings-screen.tsx](../apps/mobile/src/features/viewings/screens/viewings-screen.tsx).

**Problem:** Completed exists as a status and has UI copy, but no production flow found marks an appointment completed. activeFor looks at the generated active/status value, not whether the viewing ended. Once a confirmed viewing is past, the API refuses rescheduling/cancellation, yet it can still prevent booking the same home again.

**Acceptance:** Complete the lifecycle explicitly. After an old viewing ends, allow a valid follow-up viewing, and show a truthful past status without requiring manual database changes.

### DATA-03 — Cancel/reschedule decisions and writes can race

**Priority / evidence:** P1 concurrency risk.

**Where:** [viewings.service.ts](../apps/api/src/modules/viewings/viewings.service.ts), [viewings.repository.ts](../apps/api/src/modules/viewings/viewings.repository.ts).

**Problem:** Ownership/status/time are checked before the update transaction. cancel updates by id; reschedule also updates by id without an expected status/version predicate.

**Trigger / impact:** Concurrent cancel and reschedule requests can both pass validation. A late reschedule can turn a just-cancelled appointment back into rescheduled, with mismatched notifications and reminders.

**Acceptance:** Race cancellation, rescheduling, and account deletion against each other. Only one valid state transition should commit, and notifications/reminders should reflect that final state.

### DATA-04 — Booking a chat times card is not one atomic operation

**Priority / evidence:** P1 concurrency/failure risk.

**Where:** [chat.service.ts](../apps/api/src/modules/chat/chat.service.ts), [chat.repository.ts](../apps/api/src/modules/chat/chat.repository.ts), [viewings.repository.ts](../apps/api/src/modules/viewings/viewings.repository.ts).

**Problem:** The viewing commits before choose marks the card; the boolean returned by choose is ignored. The confirmation message is a third write. These steps have no common transaction or idempotency boundary.

**Impact:** A crash/failure can leave a booking with an unchosen card or no confirmation. Together with DATA-01, simultaneous taps for different hours can create multiple bookings while the card displays only one chosen time.

**Acceptance:** Race different time choices and inject failure after each persistence step. There must be exactly one booking/card outcome, and retrying the request must return the existing result rather than create another operation.

### DATA-05 — Reassigning a listing can make an old chat promise the wrong advisor

**Priority / evidence:** P1, confirmed source mismatch.

**Where:** [chat.schema.ts](../apps/api/src/modules/chat/chat.schema.ts), [chat.repository.ts](../apps/api/src/modules/chat/chat.repository.ts), [chat.service.ts](../apps/api/src/modules/chat/chat.service.ts), [viewings.service.ts](../apps/api/src/modules/viewings/viewings.service.ts), [admin-listing-screen.tsx](../apps/mobile/src/features/admin/screens/admin-listing-screen.tsx).

**Problem:** Old threads intentionally retain their original agent, and uniqueness is client/home. However, cardFor asks for slots using the property's current advisor, and booking from that thread also books the property's current advisor.

**Trigger / impact:** Start a conversation with advisor A, assign the property to B, then send/book a times card in the old thread. The chat header and confirmation sender can say A while the appointment is actually with B. Reopening Chat can also return the old thread rather than a new conversation with B.

The reschedule flow has the same identity mismatch: its property/slots query uses the current property advisor, while the server reschedules against the original viewing.agentId. After reassignment, the hours displayed and the hours validated can belong to different agents.

**Acceptance:** Define the handover behavior. Thread identity, available hours, named advisor, notifications, and actual viewing.agentId must agree after a listing reassignment.

### DATA-06 — Agent deactivation ignores existing appointments and conversations

**Priority / evidence:** P1 workflow gap.

**Where:** [agents.service.ts](../apps/api/src/modules/agents/agents.service.ts), [agents.repository.ts](../apps/api/src/modules/agents/agents.repository.ts), [viewings.service.ts](../apps/api/src/modules/viewings/viewings.service.ts), [chat.service.ts](../apps/api/src/modules/chat/chat.service.ts).

**Problem:** Deactivation is blocked only by live listings. Moving those listings first allows deactivation even while future appointments, open chats, and leads still belong to that agent.

**Impact:** Clients can retain confirmed appointments with an employee who cannot sign in, and continue writing to a thread whose advisor cannot respond. NotificationsService suppresses notifications for inactive users, making the operational gap harder to notice.

**Acceptance:** Deactivate an agent with future appointments and an existing chat. Require a handover or show explicit impacted work, and ensure clients know who will meet/respond to them.

### DATA-07 — A committed action can be reported as failed because a later notification fails

**Priority / evidence:** P1 failure risk.

**Where:** [chat.service.ts](../apps/api/src/modules/chat/chat.service.ts), [viewings.service.ts](../apps/api/src/modules/viewings/viewings.service.ts), [prices.service.ts](../apps/api/src/modules/prices/prices.service.ts), [leads.service.ts](../apps/api/src/modules/leads/leads.service.ts), [notifications.service.ts](../apps/api/src/modules/notifications/notifications.service.ts).

**Problem:** Messages/bookings/price changes/lead assignments are persisted, then notification work is awaited. Push failures are caught, but failure creating the inbox entry or running subsequent schedule/lookups can still reject the overall request after the business write committed.

**Impact:** The UI says the action failed even though it happened. Retrying may duplicate messages or produce confusing booking conflicts. Chat also emits the message before these later failures, so the recipient can see a message that the sender thinks failed.

**Acceptance:** Inject failure in notification persistence and post-write work. Persist an outbox/job transactionally, or otherwise return the committed operation reliably and retry secondary work separately.

### DATA-08 — Reminder claiming can permanently lose a reminder

**Priority / evidence:** P1 failure risk.

**Where:** [viewings.repository.ts](../apps/api/src/modules/viewings/viewings.repository.ts), [viewings.service.ts](../apps/api/src/modules/viewings/viewings.service.ts), [reminders.job.ts](../apps/api/src/modules/viewings/reminders.job.ts).

**Problem:** claimReminders stamps sentAt before the notification is persisted. A process crash, a missing intermediate record, or a notification database error after that stamp leaves nothing to retry. The job logs errors, but the reminder no longer qualifies as unsent.

**Acceptance:** Fail between claim and notification creation, restart the job, and prove eventual delivery without duplicates. A recoverable claim/lease or transactional outbox should distinguish claimed from successfully delivered.

### DATA-09 — Editing a listing and changing its price can partially succeed

**Priority / evidence:** P2 failure risk.

**Where:** [listings.service.ts](../apps/api/src/modules/listings/listings.service.ts), [listings.repository.ts](../apps/api/src/modules/listings/listings.repository.ts), [prices.repository.ts](../apps/api/src/modules/prices/prices.repository.ts).

**Problem:** ListingsService.update commits fields/photos/features first, then invokes a separate price transaction. A price failure leaves the other edits saved while the form reports failure.

**Acceptance:** Inject a failure during the price step of a multi-field edit. Either commit the complete edit atomically, or return a precise partial-success result that does not encourage blind retry.

### DATA-10 — Changing listing category compares incompatible price units

**Priority / evidence:** P1, confirmed source defect.

**Where:** [listings.service.ts](../apps/api/src/modules/listings/listings.service.ts), [prices.service.ts](../apps/api/src/modules/prices/prices.service.ts), [listing-form.ts](../packages/shared/src/listing-form.ts), [listing.dto.ts](../apps/api/src/modules/listings/dto/listing.dto.ts).

**Problem:** A live listing can change category and price in the same edit. The category changes first, then the old purchase price and new monthly/nightly amount are treated as an ordinary price drop. Existing followers and oldPrice/history retain incompatible semantics. The raw API also permits installment plans on rent/stay listings even though the form suppresses them.

**Trigger / impact:** Convert a sale priced in millions into a monthly rental priced in thousands. Followers can receive an enormous fake price-drop alert, and old/new values no longer have comparable units.

**Acceptance:** Decide whether category changes are allowed after publication/engagement. If allowed, explicitly reset or migrate price history, alerts, plans, and status semantics; validate the category/plan relationship on the server.

### DATA-11 — Listing/agent state checks are not protected against concurrent changes

**Priority / evidence:** P2 concurrency risk.

**Where:** [listings.service.ts](../apps/api/src/modules/listings/listings.service.ts), [listings.repository.ts](../apps/api/src/modules/listings/listings.repository.ts), [agents.service.ts](../apps/api/src/modules/agents/agents.service.ts).

**Problem:** movable checks status, then update writes by id only. Publishing validates agent activity before a later write; deactivation checks a live-listing count before its own later write. Neither invariant is held under a shared lock/version check.

**Impact:** Concurrent close/unpublish/publish actions can overwrite a newer state. A publish racing deactivation can assign an inactive advisor to a live listing, bypassing the intended deactivation rule.

**Acceptance:** Add concurrent transition tests and reject stale operations explicitly. A successful transition should be based on the state that actually exists when it commits.

## Phase 19: listing insights

### INS-01 — Switching from a long range to a short range can crash the mobile chart

**Priority / evidence:** P1, confirmed source defect; index failure reproduced in isolation.

**Where:** [listing-insights.tsx](../apps/mobile/src/features/admin/components/listing-insights.tsx), ViewsChart.

**Problem:** picked stores an array index across changes to days. shown is days[picked ?? days.length - 1] with a non-null assertion, then shown.day/views/saves/interested are read.

**Trigger:** Select 90 days, tap a bar after index 6, then select 7 days. Once the shorter result arrives, the old index is outside the new array. A similar shift can select the wrong calendar day even when it stays within bounds.

**Acceptance:** Track a selected date or reset/clamp selection on data changes. Test 90→7, 30→7, range changes while loading, and empty/error transitions.

### INS-02 — Historical “new interested clients” is reconstructed from mutable current records

**Priority / evidence:** P1 analytics correctness defect.

**Where:** [insights.service.ts](../apps/api/src/modules/insights/insights.service.ts), [insights.repository.ts](../apps/api/src/modules/insights/insights.repository.ts), [insights.schema.ts](../apps/api/src/modules/insights/insights.schema.ts), [users.repository.ts](../apps/api/src/modules/users/users.repository.ts).

**Problem:** Daily interest is derived from the earliest timestamps of current favorites, price alerts, threads, and viewings for surviving client accounts. No durable first-interest event is recorded.

**Trigger / impact:** A client saves on Monday and unsaves on Tuesday: Monday's interested count can disappear. Re-saving later moves their apparent first interest to a later day. Deleting an account or conversation also changes historical totals. “New interested” and “since it went up” do not describe stable history.

**Acceptance:** Separate current interested people from historical anonymous aggregate events. Test unsave, unfollow, re-save, cancelled bookings, and account deletion across several Cairo dates; historical counts should follow a documented policy.

The current insights e2e deletion case comments that daily activity remains, but its final assertion checks saves rather than the new-interested count. It does not protect this historical-interest behavior.

### INS-03 — View/save aggregate writes are not atomic with their source operation

**Priority / evidence:** P2 failure risk.

**Where:** [properties.service.ts](../apps/api/src/modules/properties/properties.service.ts), [favorites.service.ts](../apps/api/src/modules/favorites/favorites.service.ts), [favorites.repository.ts](../apps/api/src/modules/favorites/favorites.repository.ts), [insights.repository.ts](../apps/api/src/modules/insights/insights.repository.ts).

**Problem:** Detail increments properties.views and listing_stats in independent concurrent writes. A save inserts the favorite and only afterwards bumps its daily counter. If the bump fails, the favorite exists; retrying the idempotent save does not bump it because it is no longer new.

**Impact:** The request can fail after state changed, and total views/daily views or current saves/daily saves can permanently disagree for operational reasons.

**Acceptance:** Fail each write independently and retry. Use one transaction or a durable event/outbox so counters can be reconciled without losing events.

### INS-04 — “Last active” can mean the advisor replied, not the client acted

**Priority / evidence:** P2 metric mismatch.

**Where:** [insights.repository.ts](../apps/api/src/modules/insights/insights.repository.ts), [chat.repository.ts](../apps/api/src/modules/chat/chat.repository.ts), both listing-insights components.

**Problem:** Chat interest uses thread.lastMessageAt, which moves for messages from either sender and automatic replies. Starting an empty thread also counts as chatted before a message exists.

**Impact:** An admin can see a client marked recently active because the advisor or automatic away reply posted. A simple tap on Chat counts as a conversation in owner-facing summaries.

**Acceptance:** Define whether the metric is “opened chat,” “client sent a message,” or “conversation updated.” Use the appropriate event and label; test advisor-only and automatic messages.

### INS-05 — “Viewings booked” includes cancelled and past records

**Priority / evidence:** P2 metric/label mismatch.

**Where:** [insights.repository.ts](../apps/api/src/modules/insights/insights.repository.ts), [insights.ts](../packages/shared/src/insights.ts), [mobile listing-insights.tsx](../apps/mobile/src/features/admin/components/listing-insights.tsx), [web listing-insights.tsx](../apps/web/src/components/listing-insights.tsx).

**Problem:** The viewing total counts every viewing row without a status filter, while UI wording includes “viewings booked” / “معاينة متحجزة” and the shared type comment says values “as they are now.”

**Impact:** Several cancelled appointments can look like current demand. Reschedules and repeat bookings need explicit definitions too.

**Acceptance:** Either label this “bookings ever made” and expose current appointments separately, or filter/count according to the intended active definition. Test cancellation and completion.

### INS-06 — There is no tracking-start marker for pre-Phase-19 history

**Priority / evidence:** P2 migration/interpretation gap.

**Where:** [0012 migration](../apps/api/drizzle/0012_complex_wild_child.sql), [insights.service.ts](../apps/api/src/modules/insights/insights.service.ts), [insights.ts](../packages/shared/src/insights.ts), insights UIs.

**Problem:** The migration creates an empty daily stats table, but the UI fills every prior day with zero. Existing all-time property views and old saved/chat/viewing timestamps can predate daily tracking.

**Impact:** A 90-day report can imply zero views before deployment rather than “not recorded.” The chart and all-time figures need not reconcile, with no explanation.

**Acceptance:** Record/display the tracking start date, or mark unobserved historical days as unavailable. Do not invent a daily distribution for legacy totals.

### INS-07 — Insights recomputes every interested client for every range request

**Priority / evidence:** P2 scalability gap.

**Where:** [insights.service.ts](../apps/api/src/modules/insights/insights.service.ts), [insights.repository.ts](../apps/api/src/modules/insights/insights.repository.ts), [insights.controller.ts](../apps/api/src/modules/insights/insights.controller.ts).

**Problem:** stats loads every save/follow/thread/booking association, groups clients in memory, fetches all surviving users, and calculates their history on every 7/30/90-day request. The separate interested endpoint also returns the entire client list.

**Impact:** Selecting ranges repeatedly has cost proportional to the listing's lifetime engagement, rather than the selected range/page. Mobile renders the returned people in a normal map, without virtualization.

**Acceptance:** Use durable aggregate queries and paginated people endpoints. Load-test a popular listing with thousands of people and bookings, and verify bounded response size, memory, and query work.

### INS-08 — Range changes leave old metrics shareable without indicating stale data

**Priority / evidence:** P2 UX/data-presentation defect.

**Where:** [mobile use-admin.ts](../apps/mobile/src/features/admin/hooks/use-admin.ts), [web admin.ts](../apps/web/src/lib/admin.ts), both listing-insights components.

**Problem:** Stats queries retain previous data as a placeholder, but the panels do not indicate isPlaceholderData/isFetching and the copy/share controls are enabled whenever any data exists.

**Trigger / impact:** Select 90 days on a slow connection after viewing 7 days, then copy immediately. The selected control says 90 while the shared report still uses the previous data. On an error, stale data can remain exportable even while the panel says loading failed.

**Acceptance:** Visibly distinguish loading/stale range data and only export data for the currently confirmed listing/range, or make the exported period explicit next to the action.

### INS-09 — Cairo chart dates change with the device/browser timezone

**Priority / evidence:** P2, reproduced in isolation.

**Where:** Both [mobile](../apps/mobile/src/features/admin/components/listing-insights.tsx) and [web](../apps/web/src/components/listing-insights.tsx) ViewsChart date helpers, [format.ts](../packages/shared/src/format.ts).

**Problem:** A Cairo day is converted to a noon-UTC instant before fmtDate formats it in the device's local timezone.

**Evidence / impact:** With TZ=Pacific/Kiritimati, the day 2026-11-11 displays as 12 Nov. The date-only formatter already handles calendar days without this conversion.

**Acceptance:** Feed the formatter the calendar day, or explicitly format in Cairo. Verify the same date labels in Cairo, UTC−12, and UTC+14.

## Mobile and admin UX, forms, and completeness

### UI-01 — Network requests can keep startup and actions waiting without an application deadline

**Priority / evidence:** P1 availability/UX risk.

**Where:** [mobile api.ts](../apps/mobile/src/core/api/api.ts), [web api.ts](../apps/web/src/lib/api.ts), [session.store.ts](../apps/mobile/src/features/auth/store/session.store.ts), [app-providers.tsx](../apps/mobile/src/core/providers/app-providers.tsx).

**Problem:** Clients pass an optional caller signal but establish no request deadline. Startup awaits restore behind the splash, and restore awaits a refresh request. Sign-in, sign-out, and writes also have no defined timeout/recovery budget.

**Impact:** A connection that stalls rather than immediately rejects can leave the splash or loading action pending for a long, uncontrolled period.

**Acceptance:** Test a fetch that never resolves. Bound startup, allow guest/retry recovery, and make write timeouts explicit so users can distinguish “unknown outcome” from “not saved.”

### UI-02 — Authentication does not resume the user's intended action

**Priority / evidence:** P1 conversion-flow gap.

**Where:** [use-require-auth.ts](../apps/mobile/src/features/auth/hooks/use-require-auth.ts), [auth-prompt.tsx](../apps/mobile/src/features/auth/components/auth-prompt.tsx), [use-auth.ts](../apps/mobile/src/features/auth/hooks/use-auth.ts).

**Problem:** Guest gating only opens a boolean prompt; neither the destination nor selected booking/save/chat context is carried through sign-in. Sign-in replaces the route with the role home.

**Impact:** A guest gets almost to booking or saving, signs in, and must navigate back and repeat the action. Sign-up additionally routes through onboarding.

**Acceptance:** Cover guest→sign-in→return and guest→sign-up→onboarding→return as complete flows. Preserve choices and return to the task; revalidate time-sensitive data before final confirmation.

### UI-03 — A failed chat send discards the composed text

**Priority / evidence:** P1 input-loss defect.

**Where:** [conversation-screen.tsx](../apps/mobile/src/features/chat/screens/conversation-screen.tsx), [use-chat.ts](../apps/mobile/src/features/chat/hooks/use-chat.ts).

**Problem:** sendText clears draft immediately. The failed mutation removes the optimistic message and shows a toast, without retaining a failed bubble or restoring its text.

**Acceptance:** Write a long message, fail the POST, and verify the user can retry without retyping. Also cover a response lost after server commit so recovery does not duplicate the message; see DATA-07.

### UI-04 — Explore has no visible recovery for failure loading a later page

**Priority / evidence:** P2, confirmed source defect.

**Where:** [explore-screen.tsx](../apps/mobile/src/features/listings/screens/explore-screen.tsx), [use-listings.ts](../apps/mobile/src/features/listings/hooks/use-listings.ts).

**Problem:** The error component lives in ListEmptyComponent, which is not displayed while existing cards remain. The footer only shows a spinner while fetching, not an error/retry afterwards.

**Impact:** A failed page 2 looks like the list ended. onEndReached can trigger repeated attempts without explaining the failure.

**Acceptance:** Fail page 2 after successful page 1, keep visible cards/filters, show a retry for the failed page, and append it without replacing or duplicating the earlier results.

### UI-05 — Booking still accepts cached availability after an availability-refresh error

**Priority / evidence:** P2; partially improved during the review.

**Where:** [book-screen.tsx](../apps/mobile/src/features/viewings/screens/book-screen.tsx), [use-viewings.ts](../apps/mobile/src/features/viewings/hooks/use-viewings.ts).

**Problem:** Concurrent work added a derived selected-time check against the loaded day. That improves the previously reported taken-slot case. It does not check slots.isError: after a failed refresh, React Query can retain old slots and the selected time can remain confirmable while the times section shows an error.

**Acceptance:** Pick a time, fail the foreground availability refresh, and confirm the screen consistently treats availability as uncertain until retry succeeds. Keep server conflict handling as the final authority.

### UI-06 — Booking entry failures offer only Back; some deep-link back paths have no fallback

**Priority / evidence:** P2, confirmed source defect.

**Where:** [book-screen.tsx](../apps/mobile/src/features/viewings/screens/book-screen.tsx), Failed.

**Problem:** Missing property/existing-viewing data collapses network errors and missing records into one generic failure screen. There is no retry, and Failed calls router.back without the fallback used in the normal booking header.

**Impact:** A transient outage forces navigation away. A cold deep link without navigation history can leave no useful recovery.

**Acceptance:** Distinguish unavailable records from temporary failures, retry on the same screen, and route Back to a useful property/home fallback when history is absent.

### UI-07 — Errors often hide the actionable reason or blame valid input

**Priority / evidence:** P2, confirmed across several surfaces.

**Where:** [web ui.tsx](../apps/web/src/components/ui.tsx), [agent-form.tsx](../apps/web/src/components/agent-form.tsx), [mobile listing-form-screen.tsx](../apps/mobile/src/features/admin/screens/listing-form-screen.tsx), [edit-profile-screen.tsx](../apps/mobile/src/features/account/screens/edit-profile-screen.tsx), [book-screen.tsx](../apps/mobile/src/features/viewings/screens/book-screen.tsx).

**Problem:** useErrorText reduces most server responses to “Something went wrong.” Profile failures tell users to check name/phone even for a 500. Booking maps nearly every 409 other than one message-text match to “time just taken,” including closed/past times. Many web read errors have no retry button.

**Acceptance:** Map stable error codes/statuses to field-specific or action-specific bilingual messages, preserve input, and offer a valid next step. Test validation, conflict, forbidden, missing, offline, rate-limit, and server failures separately.

### UI-08 — Failed photo uploads lose their retry data when the Photos step unmounts

**Priority / evidence:** P2, confirmed source defect.

**Where:** [web listing-form.tsx](../apps/web/src/components/listing-form.tsx), [mobile listing-form-screen.tsx](../apps/mobile/src/features/admin/screens/listing-form-screen.tsx), PhotosStep.

**Problem:** Photo entries live in parent form state, but retry payloads live in the child PhotosStep's blobs/parts state. Moving back to another step unmounts PhotosStep. Returning retains failed entries but loses the payload needed to retry them.

**Impact:** Web can show an indefinite uploading spinner for a failed entry without a blob; mobile can show a failed tile without a retry action. Removing and picking the photo again is the workaround.

**Acceptance:** Fail an upload, visit the previous step, then return. Retry must still work. Handle browser image-preparation failures explicitly rather than leaving a pending entry.

### UI-09 — Long forms have no persisted draft or unsaved-change protection

**Priority / evidence:** P2 workflow gap.

**Where:** [web listing-form.tsx](../apps/web/src/components/listing-form.tsx), [mobile listing-form-screen.tsx](../apps/mobile/src/features/admin/screens/listing-form-screen.tsx), agent/area forms.

**Problem:** Form state is held in component useState. There is no navigation/refresh warning or recoverable local draft, and Save draft is available only after the full validation flow.

**Impact:** Browser refresh, leaving the screen, process termination, or interrupted authentication can discard substantial typed work while already uploaded photos remain on disk.

**Acceptance:** Define a recoverable draft policy and test refresh, accidental navigation, app termination, and session expiry halfway through a listing.

### UI-10 — Uploaded files can become permanent orphans, and listing image validation checks shape only

**Priority / evidence:** P2 data/storage gap.

**Where:** [uploads.service.ts](../apps/api/src/modules/uploads/uploads.service.ts), [listings.repository.ts](../apps/api/src/modules/listings/listings.repository.ts), [listing.dto.ts](../apps/api/src/modules/listings/dto/listing.dto.ts), both listing forms.

**Problem:** Picking uploads immediately. Removing a photo or abandoning a draft never deletes that listing upload, and replacing listing image rows does not garbage-collect files. The API accepts a correctly shaped /uploads/listings/name.jpg path without checking that the file exists or is a completed upload.

**Impact:** Disk use grows with abandoned attempts, and an API caller can publish broken image references. Chat's partially completed multi-photo upload has a similar orphan risk on failure.

**Acceptance:** Track uploads/references, validate existence, and clean unused files after a safe retention period. Never delete a file still used by a listing, area, or conversation.

### UI-11 — Client form validation and API limits disagree

**Priority / evidence:** P2, confirmed validation mismatch.

**Where:** [listing-form.ts](../packages/shared/src/listing-form.ts), [agent-form.tsx](../apps/web/src/components/agent-form.tsx), [agent-form-screen.tsx](../apps/mobile/src/features/admin/screens/agent-form-screen.tsx), [agents.dto.ts](../apps/api/src/modules/agents/dto/agents.dto.ts), [listing.dto.ts](../apps/api/src/modules/listings/dto/listing.dto.ts), [update-me.dto.ts](../apps/api/src/modules/users/dto/update-me.dto.ts).

**Problem:** Agent forms accept any non-negative whole monthly target while the API caps it at 1000. Several text inputs validate only minimum lengths while the API has maximums. Shared readPhone accepts a different range from the profile endpoint; the profile editor sends spaces/Arabic digits unchanged despite its spaced example.

**Impact:** Users can pass local validation and receive a generic server rejection, with no indication of the exact incompatible field.

**Acceptance:** Centralize compatible bounds and phone normalization. Test maximum+1, long names, pasted formatted phones, Arabic digits, and every input accepted by the UI against the API DTO.

### UI-12 — Staff self-profile edits can diverge from their public advisor profile

**Priority / evidence:** P2, confirmed data-model mismatch.

**Where:** [edit-profile-screen.tsx](../apps/mobile/src/features/account/screens/edit-profile-screen.tsx), [users.service.ts](../apps/api/src/modules/users/users.service.ts), [users.repository.ts](../apps/api/src/modules/users/users.repository.ts), [agents.service.ts](../apps/api/src/modules/agents/agents.service.ts), [properties.service.ts](../apps/api/src/modules/properties/properties.service.ts).

**Problem:** Staff can use Edit profile, but PATCH /me changes users.name/phone only. Public listing advisors use agents.nameAr/nameEn/phone. Admin agent edits update both copies in a different path.

**Impact:** An agent can change their phone in Me and see success while clients still call the old number shown on listings/chat.

**Acceptance:** Define which staff fields are self-editable and synchronize the authoritative profile, or direct staff to an admin-managed profile flow.

### UI-13 — Important listing fields and tour/location authoring lack a shipped admin path

**Priority / evidence:** P2, known deferred/product completeness gap.

**Where:** [listing-form.ts](../packages/shared/src/listing-form.ts), [listing.dto.ts](../apps/api/src/modules/listings/dto/listing.dto.ts), [uploads.controller.ts](../apps/api/src/modules/uploads/uploads.controller.ts), [properties.schema.ts](../apps/api/src/modules/properties/properties.schema.ts), Phase 17 notes.

**Problem:** Admin forms cannot edit developer, floor, or maintenance fee although clients display/use them. Location coordinates are accepted by the raw API but absent from the forms. Tour rooms/panoramas have no shipped authoring/upload management flow; the phase notes explicitly defer them.

**Impact:** Real staff cannot maintain the complete public property experience through supported tools. Seed data can make the app appear more complete than new production listings will be.

**Acceptance:** Decide which fields/features ship. Provide a supported authoring path or hide/clearly scope the unsupported features; do not depend on editing production database rows by hand.

### UI-14 — Mobile admin listings stop at the first 100; admin leads stop at 500

**Priority / evidence:** P1 for inaccessible operational records.

**Where:** [mobile admin.api.ts](../apps/mobile/src/features/admin/api/admin.api.ts), [use-admin.ts](../apps/mobile/src/features/admin/hooks/use-admin.ts), [admin-listings-screen.tsx](../apps/mobile/src/features/admin/screens/admin-listings-screen.tsx), [leads.repository.ts](../apps/api/src/modules/leads/leads.repository.ts), both admin leads UIs.

**Problem:** Mobile requests limit=100 with no page parameter/infinite query and no load-more control, while showing counts for all matching listings. Admin leads are silently limited to 500 with no cursor/page or truncation notice.

**Impact:** Older records disappear from normal operational views. Searching may retrieve an individual listing, but it does not make “all listings” complete or support processing all leads.

**Acceptance:** Seed 101 listings and 501 leads. Every matching record must be reachable, and totals/page state must describe what is displayed.

### UI-15 — Several growing lists are unpaged; older notifications are unreachable

**Priority / evidence:** P2 scalability/completeness gap.

**Where:** [favorites.service.ts](../apps/api/src/modules/favorites/favorites.service.ts), [prices.service.ts](../apps/api/src/modules/prices/prices.service.ts), [viewings.repository.ts](../apps/api/src/modules/viewings/viewings.repository.ts), [chat.repository.ts](../apps/api/src/modules/chat/chat.repository.ts), [leads.repository.ts](../apps/api/src/modules/leads/leads.repository.ts), [notifications.dto.ts](../apps/api/src/modules/notifications/dto/notifications.dto.ts), [use-notifications.ts](../apps/mobile/src/features/notifications/hooks/use-notifications.ts), [compare-screen.tsx](../apps/mobile/src/features/compare/screens/compare-screen.tsx).

**Problem:** Favorites, followed homes, viewings, chat lists, and agent leads load their full histories. Notifications use a fixed newest-items limit with no older-page API/UI, although unread counts include older records. The compare picker fetches only the first 50 listings and ranks saved homes only inside that subset.

**Acceptance:** Use bounded pagination end to end, expose older unread notifications, and test old saved homes in the compare picker. Rendering a FlatList does not itself paginate the API.

### UI-16 — Listing sharing omits the listing link promised by the contract

**Priority / evidence:** P2, confirmed implementation/contract mismatch.

**Where:** [property-screen.tsx](../apps/mobile/src/features/property/screens/property-screen.tsx), Share.share, contract §12.

**Problem:** The shared message contains title, price, and location text but no listing URL or deep link.

**Impact:** A recipient cannot open the exact listing from the shared message, weakening the main family/advisor sharing flow.

**Acceptance:** Share from a real listing and open the received link on an installed app and a device without the app. Define the fallback destination explicitly.

### UI-17 — Compare presents an assumed installment plan as if it were a listing plan

**Priority / evidence:** P2 product-copy/data interpretation gap.

**Where:** [compare.ts](../packages/shared/src/compare.ts), [compare-screen.tsx](../apps/mobile/src/features/compare/screens/compare-screen.tsx).

**Problem:** A sale/project with no plan receives a fallback 20% down/5-year calculation. The compare table shows its monthly payment and the verdict can call it the lower installment, without marking that particular plan as hypothetical.

**Impact:** Users can interpret an estimated financing option as available terms from the seller/developer. The standalone calculator has an estimates note; the compare verdict lacks equivalent context.

**Acceptance:** Clearly distinguish an advertised plan from an estimate, and avoid an unqualified “lower installment” recommendation based on invented terms.

### UI-18 — Secondary text fails normal-text contrast in both themes

**Priority / evidence:** P2, calculated from the current tokens.

**Where:** [mobile tokens.ts](../apps/mobile/src/core/theme/tokens.ts), [web globals.css](../apps/web/src/app/globals.css), property card metadata, placeholders, navigation labels, and insights captions.

**Problem:** Light ink3 has contrast 3.15:1 on white and 2.82:1 on the page background; dark ink3 has 3.95:1 on its dark surface. It is used for small meaningful text. The normal-text AA target is 4.5:1; see [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

**Acceptance:** Improve semantic text tokens and inspect real text/background combinations, including tinted panels, disabled states, and chart captions. Keep decorative/disabled exceptions separate from meaningful readable content.

### UI-19 — Daily chart controls are too dense for reliable touch and differ across input methods

**Priority / evidence:** P2 source-based usability/accessibility gap.

**Where:** Both listing-insights components, particularly [mobile barSlot styles](../apps/mobile/src/features/admin/components/listing-insights.tsx) and [web ViewsChart](../apps/web/src/components/listing-insights.tsx).

**Problem:** The mobile chart packs up to 90 individual press targets into the panel width. Each day is only a few pixels wide. Its accessible label exposes views but not saves/new-interest values, and no button role/selected state is assigned. Web details are mouse-hover-only; a screen-reader-only table does not provide a visible keyboard/touch data view.

**Acceptance:** Provide a usable date picker, scroll/zoom, summary table, or another accessible detail control. Validate touch, keyboard, and screen readers on 7/30/90-day ranges.

### UI-20 — Reduced-motion support and some accessible labels are incomplete

**Priority / evidence:** P2 accessibility/contract gap.

**Where:** [sheet.tsx](../apps/mobile/src/components/sheet.tsx), [filter-sheet.tsx](../apps/mobile/src/features/listings/components/filter-sheet.tsx), [gallery.tsx](../apps/mobile/src/features/property/components/gallery.tsx), [pano-view.tsx](../apps/mobile/src/features/tour/components/pano-view.tsx), [app.json](../apps/mobile/app.json), contract §15.

**Problem:** App-level modal slide/photo transitions are not conditioned on a reduce-motion preference. The shared sheet backdrop has the hard-coded English label “close.” The iOS photo permission copy mentions chat only even though admins also pick listing/area photos.

**Acceptance:** Honor system reduced motion where app-authored motion is used, localize accessible controls, and make permission copy accurately describe all photo uses. Verify VoiceOver/TalkBack rather than inferring support from labels alone.

### UI-21 — Admin navigation links lose their accessible names below the small breakpoint

**Priority / evidence:** P2, confirmed source accessibility defect.

**Where:** [shell.tsx](../apps/web/src/components/shell.tsx), Header navigation.

**Problem:** Navigation text is hidden with hidden sm:inline, icons are aria-hidden, and the links have no aria-label. At narrow widths the remaining links have no accessible name.

**Acceptance:** Inspect the accessibility tree below the breakpoint and with zoom. Every navigation destination must retain a distinct localized name, even when the visible layout is icon-only.

### UI-22 — Invalid admin detail/edit ids can produce an endless skeleton

**Priority / evidence:** P2, confirmed source defect.

**Where:** [web admin.ts](../apps/web/src/lib/admin.ts), [listing-page.tsx](../apps/web/src/components/listing-page.tsx), [listing-form.tsx](../apps/web/src/components/listing-form.tsx), [agents-page.tsx](../apps/web/src/components/agents-page.tsx), [agent-form.tsx](../apps/web/src/components/agent-form.tsx).

**Problem:** Query-string ids are converted with Number. Non-numeric ids become NaN and disable the query, while the page interprets pending/no data as loading indefinitely rather than invalid input.

**Acceptance:** Open detail/edit pages with id=abc, a missing id, zero, negative values, and a nonexistent integer. Show a finite not-found/invalid-link state with navigation back to the list.

### UI-23 — Account and support capabilities promised in §8.14 are missing

**Priority / evidence:** P2 known product completeness gap.

**Where:** [me-screen.tsx](../apps/mobile/src/features/account/screens/me-screen.tsx), [edit-profile-screen.tsx](../apps/mobile/src/features/account/screens/edit-profile-screen.tsx), [me.controller.ts](../apps/api/src/modules/users/me.controller.ts), auth routes, contract §8.14.

**Problem:** The contract includes changing email, privacy policy, terms, and contact support; the shipped profile screen edits name/phone only and the settings screen has no policy/terms/support destinations. There is also no password recovery or self-service password-change flow.

**Impact:** A user who loses a password has no supported recovery path, and users cannot find the product's contact/privacy information in-app.

**Acceptance:** Decide explicitly which capabilities ship and either implement them or amend the agreed scope. Do not count deferred Google OAuth as a substitute for email/password account recovery.

### UI-24 — Public property detail cache is not invalidated by mobile admin edits

**Priority / evidence:** P2, confirmed cache-key mismatch.

**Where:** [mobile use-admin.ts](../apps/mobile/src/features/admin/hooks/use-admin.ts), [use-property.ts](../apps/mobile/src/features/property/hooks/use-property.ts).

**Problem:** Admin settlement invalidates properties (plural), while detail/similar queries use property (singular). Detail has a five-minute stale time and opts out of focus/reconnect refresh.

**Trigger / impact:** View a property, edit its price/photos as an admin, then preview it again. The admin cache is current but the public detail can still show old information.

**Acceptance:** After each relevant edit/state change, both admin and public list/detail previews must show coherent values. Keep view counting separate from choosing to serve stale business data.

### UI-25 — Panorama failures are hidden, and a failed room switch can show the wrong room

**Priority / evidence:** P2, confirmed source error-state gap.

**Where:** [pano-view.tsx](../apps/mobile/src/features/tour/components/pano-view.tsx), loadRoom, and [tour-screen.tsx](../apps/mobile/src/features/tour/screens/tour-screen.tsx).

**Problem:** A panorama download/texture failure only calls onLoading(false). There is no error callback, message, or retry. On an initial failure the viewer can stay blank. On a later room switch, Tour already updates roomId, its title, and hotspots, but PanoView retains the previous successful texture.

**Impact:** Users can see the previous room's panorama under the newly selected room's name, with new-room navigation dots, rather than being told that loading failed.

**Acceptance:** Fail initial loading and a switch between two rooms. Keep the visible room/title/navigation coherent and offer retry or return to the previous room. Also catch shader/context initialization errors at the viewer boundary.

### UI-26 — Tour thumbnails use every room's full panorama URL

**Priority / evidence:** P2 source-based performance gap; network cost not measured on a device.

**Where:** [tour-screen.tsx](../apps/mobile/src/features/tour/screens/tour-screen.tsx), room strip, [pano-view.tsx](../apps/mobile/src/features/tour/components/pano-view.tsx), [properties.schema.ts](../apps/api/src/modules/properties/properties.schema.ts).

**Problem:** The room strip maps all rooms to Image components using room.pano, the same high-resolution file used by the GL viewer. No thumbnail asset/path is provided. The main viewer loads one room at a time, but the strip requests images for every room.

**Impact:** The intended room-by-room bandwidth benefit is undermined by downloading large panoramas for small thumbnails; image and Asset caches may also handle the same URL separately.

**Acceptance:** Provide small thumbnails or load them lazily, then measure downloaded bytes, decoded memory, and switching behavior on a slow connection with a multi-room tour. Do not infer transfer size from the small rendered image dimensions.

### UI-27 — Public advisor ratings/reply-time claims are default values without a supporting workflow

**Priority / evidence:** P2 product-truth gap.

**Where:** [agents.schema.ts](../apps/api/src/modules/agents/agents.schema.ts), [agents.dto.ts](../apps/api/src/modules/agents/dto/agents.dto.ts), [advisor-card.tsx](../apps/mobile/src/features/property/components/advisor-card.tsx), agent profile seed/data and chat headers.

**Problem:** New agents default to rating 5 and average reply time 5 minutes. The inspected implementation has no rating collection, reply-time measurement, or admin editing path for those values. Public cards present them as a star rating and “replies in 5m,” without identifying them as defaults or targets. Public dealsCount is also separate from the lead-based monthly Won metric and has no matching maintenance flow.

**Impact:** Seed/demo-style numbers become factual-looking service claims for real staff, and displayed deals can remain zero despite completed sales.

**Acceptance:** Define the source and meaning of each metric. Hide unsupported claims, label an intended response target as a target, or implement measured/admin-maintained values with clear semantics.

## Production operations, release, and documentation

### OPS-01 — The Android release workflows do not supply Firebase configuration

> **Deferred by the owner (2026-11-11).** The Firebase project is the owner's job (Phase 11 ⚑ list). This stays out until the owner sets it up.

**Priority / evidence:** P1 known release gap.

**Where:** [app.config.ts](../apps/mobile/app.config.ts), [android-aab.yml](../.github/workflows/android-aab.yml), [android-apk.yml](../.github/workflows/android-apk.yml), Phase 11 notes.

**Problem:** The config reads GOOGLE_SERVICES_JSON as a path, but the workflows neither materialize a google-services.json file nor set that path. Creating the Expo project id alone does not supply this Android push configuration.

**Acceptance:** Wire the actual configured Firebase file/credentials into a signed build, then verify token registration and a real background/cold-start push on a physical Android device. This remains separate from tests using MemoryPushSender.

### OPS-02 — The iOS artifact workflow produces an unsigned app

> **Deferred by the owner (2026-11-11).** A signed iOS app needs the Apple Developer Program (Phase 11 ⚑ list). Until then the unsigned IPA is only proof that the app compiles.

**Priority / evidence:** P1 known release gap.

**Where:** [ios-ipa.yml](../.github/workflows/ios-ipa.yml), [app.json](../apps/mobile/app.json), Phase 20.

**Problem:** The archive and IPA are built with signing disabled. They are useful build artifacts, but do not establish a signed distributable iOS app or working APNs delivery.

**Acceptance:** Produce and install the intended signed distribution build, configure APNs as needed, and exercise authentication, photos, notifications, and deep links on that build. Do not interpret the simulator launch check as distribution validation.

### OPS-03 — Repeated store builds have no explicit build-number/version-code progression

> **Deferred by the owner (2026-11-11).** Version numbers matter only for store publishing, which waits for the store accounts (Phase 11 ⚑ list).

**Priority / evidence:** P2 release process gap.

**Where:** [app.json](../apps/mobile/app.json), [android-aab.yml](../.github/workflows/android-aab.yml), [ios-ipa.yml](../.github/workflows/ios-ipa.yml).

**Problem:** Version is fixed at 1.0.0, with no android.versionCode or ios.buildNumber configured and no workflow step assigning a monotonically increasing store build identifier. Filenames containing the commit do not change the package's internal version.

**Acceptance:** Build two release candidates and verify distinct, valid package build identifiers as well as traceability to the source commit.

### OPS-04 — There is no automatic repository quality gate or deploy-on-main workflow

> **Deferred by the owner (2026-11-11).** By the owner's decision (2026-11-09), a commit or push never deploys or builds. Deploys are run by hand with `deploy.sh`, and builds start only when asked.

**Priority / evidence:** P1 implementation/plan mismatch.

**Where:** [.github/workflows](../.github/workflows), [deploy.sh](../deploy/deploy.sh), Phase 2 and Phase 20.

**Problem:** The checked-in workflows are manual mobile build/launch workflows. None runs the full lint/typecheck/unit/e2e gate on pushes or pull requests, and none deploys main after that gate. deploy.sh checks clean/pushed source but does not run the quality suite before deploying.

**Acceptance:** Define the actual required check/deployment policy and enforce it mechanically. A source commit reaching main or producing an APK must not be treated as proof that the full project is green.

### OPS-05 — Backups and restore verification are still absent from the supplied deployment

> **Deferred by the owner (2026-11-11).** There are no backups on the temporary server, which holds only demo data (decided 2026-11-09). Backups and a restore test come with the dedicated server, before real data arrives.

**Priority / evidence:** P1 known release blocker.

**Where:** [server-deploy.sh](../deploy/server-deploy.sh), [docker-compose.yml](../docker-compose.yml), [phases.md](phases.md), Phase 2 status.

**Problem:** The deployment explicitly skips backups on the temporary server. Database/uploads persist in a volume/folder, but there is no checked-in daily/pre-migration backup/retention/restore workflow. The plan acknowledges this exception.

**Impact:** A migration error, disk loss, accidental deletion, or server loss can destroy production records/photos without a demonstrated recovery path.

**Acceptance:** Before real data, back up database and uploads, verify retention and access, restore to an isolated environment, and measure that the restored app actually works. Persistence on the same server is not a backup.

### OPS-06 — API and dashboard deployment can leave mixed versions

**Priority / evidence:** P2 failure risk.

**Where:** [deploy.sh](../deploy/deploy.sh), [server-deploy.sh](../deploy/server-deploy.sh), [nginx-maqar.conf](../deploy/nginx-maqar.conf).

**Problem:** The API is migrated/replaced before the web dashboard is built and copied. If the local web build/API-URL check/upload fails, the API stays new while the dashboard stays old. Rollback covers an API image, not the complete application/schema pair. Old static assets are deleted immediately after a swap.

**Acceptance:** Build/validate all artifacts before promoting them, define compatibility and rollback across API/schema/web, and test interrupted deployment plus an already-open dashboard navigating after an asset swap.

### OPS-07 — Deleting the demo currently breaks the API Docker build

> **Deferred by the owner (2026-11-11).** The demo stays for now. Fix the API's Docker build as part of removing the demo, whenever that happens.

**Priority / evidence:** P2, confirmed dependency mismatch with the intended cleanup.

**Where:** [Dockerfile.api](../Dockerfile.api), workspace manifests/lockfile, [README.md](../README.md).

**Problem:** Dockerfile.api explicitly copies apps/demo/package.json during the build. Removing the demo directory without updating this build recipe makes the COPY step fail before dependencies install.

**Acceptance:** Include Docker/workspace/docs cleanup in demo retirement and verify an API image builds from a clean checkout without apps/demo.

### OPS-08 — New-match notifications are declared but no production producer was found

**Priority / evidence:** P2 implementation/contract gap.

**Where:** [enums.ts](../packages/shared/src/enums.ts), [notifications.service.ts](../apps/api/src/modules/notifications/notifications.service.ts), [listings.service.ts](../apps/api/src/modules/listings/listings.service.ts), contract §8.13.

**Problem:** The notification kind match is documented as notifying clients about new homes matching their preferences, but no production path emits that kind when a listing is published or preferences change.

**Acceptance:** Decide whether this is a release feature. Implement a bounded, deduplicated producer with tests, or explicitly defer the promise in the contract/UI.

### OPS-09 — The phase plan and contract contain stale or contradictory instructions

**Priority / evidence:** P3 documentation debt with release-planning impact.

**Where:** [phases.md](phases.md), [project-contract.md](project-contract.md), [README.md](../README.md).

**Problems found:**

- Phase 20 says automatic deployment/backups already run from Phase 2, but Phase 2's current status says deployment is manual with no backups.
- Phase 20 still says to decide analytics/crash reporting first, while §16.1 #14 says it was decided out of scope.
- Contract §12 still lists an Owner tab bar despite removal of owner accounts.
- Contract §8.7 still mentions video mode while the decided scope is in-person only.
- Contract §15 still calls the reminder mechanism a server job queue/Open while §16.1 #13 chooses an in-process scheduler.
- Phase 19 source comments reference contract §11.6, but insights remain documented under §9.1 and there is no matching §11.6 section.
- The phase overview/status text lags the work-in-progress Phase 19 implementation and several later phone checks.
- Some database paths still refer to src/db/schema.ts rather than src/core/db/schema.ts.

**Acceptance:** Reconcile these before the final checklist. Distinguish decisions, implemented code, deployed versions, manual checks, and release blockers so “done” has one meaning.

## Verification gaps to close before calling Phase 20 complete

### QA-01 — The current automated results do not establish a green release candidate

**Priority / evidence:** P1 quality gate gap; observed command failures.

**Where:** [book-screen.test.tsx](../apps/mobile/test/ui/features/viewings/book-screen.test.tsx), [insights.test.tsx](../apps/mobile/test/ui/features/admin/insights.test.tsx), [jest.setup.ts](../apps/mobile/jest.setup.ts), [test render helper](../apps/mobile/test/utils/render.tsx), [insights.e2e-spec.ts](../apps/api/test/e2e/insights.e2e-spec.ts).

**Problem:** The full mobile run and a later targeted run failed booking tests and reported act/open-handle issues. An initial mobile typecheck also failed on Phase 19 test typings, although the later typecheck passed. The workspace was being edited during these runs, so this report does not attribute every observed failure to a stable production defect.

**Acceptance:** Freeze the intended candidate, remove debug-only tests/output, rerun the complete required commands in isolation, and retain the results for that exact commit. Resolve test isolation/timer cleanup instead of masking failures with larger timeouts. Passing insights UI tests do not cover INS-01's range-switch case.

### QA-02 — Important concurrency and failure cases are absent from the current evidence

**Priority / evidence:** P2 test coverage gap.

**Where:** [API e2e tests](../apps/api/test/e2e), [mobile UI tests](../apps/mobile/test/ui), [web tests](../apps/web/test).

**Problem:** Existing tests cover many useful happy paths and permissions, but the cases in SEC-01/02/05/07/08, DATA-01/03/04/07/08, INS-01/02/03, and UI-08/14 need explicit regression coverage. The web suite currently exercises its API client rather than real listing/agent/area workflows.

**Acceptance:** Add targeted behavioral tests for those defects during fixes. Do not substitute a higher test count for testing the actual cross-feature flow or failure boundary.

### QA-03 — Native layout and accessibility claims still need actual device validation

**Priority / evidence:** P2 manual verification gap, not a claim of a reproduced layout defect.

**Where:** [Screen](../apps/mobile/src/components/screen.tsx), [TextField](../apps/mobile/src/components/text-field.tsx), [RoleTabs](../apps/mobile/src/core/navigation/role-tabs.tsx), booking, onboarding, comparison, listing/agent forms, and modal sheets.

**Problem:** Several layouts use fixed-height chips/slots and dense horizontal groups, and shared Screen has no keyboard-avoidance behavior while several forms use it. Source inspection cannot establish that they remain usable with large system fonts, a visible keyboard, narrow phones, RTL, and screen readers. The host browser/native-device connection was unavailable during this review.

**Acceptance:** Check Arabic/English × light/dark on small and large phones, at 100%/large accessibility text sizes, with keyboard open, VoiceOver/TalkBack, reduced motion, and interrupted network requests. Record screenshots and the exact build tested.

### QA-04 — Release-specific operational checks need a separate evidence trail

**Priority / evidence:** P2 verification gap.

**Where:** Release workflows, deployment scripts, [phases.md](phases.md), configuration and seed scripts.

**Acceptance checklist:**

- Migrate an empty database and an upgrade copy of the previous deployed schema.
- Restore database plus uploads and verify referential/file consistency.
- Verify release API URL, HTTPS behavior, proxy-aware throttling, map key, Firebase/APNs configuration, and package signing/version identifiers.
- Remove or disable seeded demo accounts/data before accepting real users. *(Deferred by the owner, 2026-11-11: the project is in testing on a temporary server, so the demo accounts stay.)*
- Exercise push delivery and links in foreground, background, and cold start, including revoked/expired sessions.
- Check account deletion removes/anonymizes the intended data and attachments according to a written retention policy; review free-text lead notes and logs as well as user columns.
- Check image decoding/upload concurrency against the actual API memory cap; byte-size limits alone do not bound decoded image memory or simultaneous requests.
- Re-run every phase's “done when” on the candidate build, including the pending Phase 17/18 phone checks. *(Deferred by the owner, 2026-11-11: the pending phone checks are scheduled after Phase 20, the full review and the new builds.)*

## Suggested order for the next iteration

1. **Stabilize Phase 19:** INS-01 through INS-09 and its migration/metric definitions.
2. **Protect accounts and durable state:** SEC-01 through SEC-09; DATA-01 through DATA-11.
3. **Complete operational workflows:** UI-02/03/08/09/14/15, advisor handover, supported listing authoring, and useful errors.
4. **Finish accessibility and information accuracy:** UI-16 through UI-24 and QA-03.
5. **Make release repeatable and recoverable:** OPS-01 through OPS-09, then run QA-01 through QA-04 against one frozen candidate.

No implementation fix is marked complete by this document. Each item should be closed only with the intended behavior, the changed files, and the relevant verification evidence.

