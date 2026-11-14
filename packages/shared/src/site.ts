// Phase 20: the public pages the stores require (contract §15 privacy), served by nginx on the
// API's host from deploy/site. The app opens them from the Me screen; the store listings link them.

/** Where users reach Maqar's support. */
export const SUPPORT_EMAIL = 'maqarcompany@gmail.com';

/** The developer's credit, under My account and on the opening screen's pictures and videos (owner, 2026-11-14). */
export const DEVELOPER = { credit: 'Powered by Bit Technologies', phone: '01501053600' } as const;

/** Paths on the API's host (without `/v1`). */
export const SITE_PAGES = {
  privacy: '/privacy',
  terms: '/terms',
  support: '/support',
  deleteAccount: '/delete-account',
} as const;
