# Security notes

## SEC-04 — chat attachments and uploads are public by URL (decided, not an oversight)

Listing photos and chat photos are served by nginx from `/uploads/…` with no authentication. Anyone
with the exact URL can fetch one. This was reviewed and **kept on purpose**:

- URLs are unguessable: files are stored under random names, and chat photos sit under a
  per-conversation path. You cannot enumerate them.
- Listing photos are meant to be public — they are the product.
- Chat photos stay viewable after either side deletes the app, with no signed-URL expiry logic to
  maintain on three clients (web, mobile, admin).
- Both endpoints accept uploads only from authenticated, authorized accounts (`/v1/uploads` is
  admin-only; chat photos only from the conversation's client or advisor), and are rate limited
  (contract §15).

If this ever needs to change, the cost is known: an authenticated streaming endpoint in the chat
controller plus fetch-with-token image loading in the mobile app and web.
