import { mediaUrlFrom } from '@/core/api/api-url';

// Photos come back as paths on the API host; the app must turn them into full URLs.
describe('mediaUrlFrom', () => {
  it('puts an uploads path on the API host, not under /v1', () => {
    expect(mediaUrlFrom('http://192.168.1.5:4000/v1', '/uploads/seed/p1.jpg')).toBe('http://192.168.1.5:4000/uploads/seed/p1.jpg');
    expect(mediaUrlFrom('https://api.maqar.app/v1', '/uploads/a.jpg')).toBe('https://api.maqar.app/uploads/a.jpg');
  });

  it('keeps a full URL as it is', () => {
    expect(mediaUrlFrom('https://api.maqar.app/v1', 'https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
  });

  it('gives nothing for a listing without photos', () => {
    expect(mediaUrlFrom('https://api.maqar.app/v1', null)).toBeNull();
  });
});
