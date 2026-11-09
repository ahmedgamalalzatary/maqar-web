import { safeHref } from '@/features/notifications/push';

describe('safeHref', () => {
  it('keeps the app’s own screens', () => {
    expect(safeHref('/property/4')).toBe('/property/4');
    expect(safeHref('/explore?tour=true')).toBe('/explore?tour=true');
    expect(safeHref('/notifications')).toBe('/notifications');
  });

  it('drops anything else', () => {
    expect(safeHref('https://evil.example')).toBeNull();
    expect(safeHref('//evil.example/x')).toBeNull();
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('property/4')).toBeNull();
    expect(safeHref(null)).toBeNull();
    expect(safeHref(42)).toBeNull();
  });
});
