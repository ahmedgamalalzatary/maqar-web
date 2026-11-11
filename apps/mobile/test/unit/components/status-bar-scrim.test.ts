import { statusBarScrimShown } from '@/components/status-bar-scrim';

// The app draws edge to edge, so scrolled content showed through the status bar (seen on a phone
// on the Me screen). A backdrop covers it everywhere except where a photo or a colored header is
// meant to run under the status bar.
describe('statusBarScrimShown', () => {
  it('covers the status bar on scrolling screens', () => {
    for (const path of ['/', '/me', '/explore', '/saved', '/viewings', '/notifications', '/chat', '/property/4/book', '/admin', '/admin/listing/7', '/agent/lead/3', '/onboarding']) {
      expect(statusBarScrimShown(path)).toBe(true);
    }
  });

  it('leaves full-bleed photos and chat headers alone', () => {
    for (const path of ['/property/4', '/property/4/tour', '/chat/12', '/agent/chat/12']) {
      expect(statusBarScrimShown(path)).toBe(false);
    }
  });
});
