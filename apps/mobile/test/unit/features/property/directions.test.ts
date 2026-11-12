import { directionsUrl, osmEmbedUrl } from '@/features/property/directions';

describe('directionsUrl', () => {
  it('opens Apple Maps on iOS and Google Maps elsewhere', () => {
    expect(directionsUrl({ lat: 30.0277, lng: 31.7791 }, 'ios')).toBe('https://maps.apple.com/?daddr=30.0277,31.7791');
    expect(directionsUrl({ lat: 30.0277, lng: 31.7791 }, 'android')).toBe('https://www.google.com/maps/dir/?api=1&destination=30.0277,31.7791');
  });
});

describe('osmEmbedUrl (the map in the web preview, as in the demo)', () => {
  it('frames the point with a marker on it', () => {
    const url = new URL(osmEmbedUrl({ lat: 30, lng: 31 }));
    expect(url.origin + url.pathname).toBe('https://www.openstreetmap.org/export/embed.html');
    expect(url.searchParams.get('bbox')).toBe('30.97,29.98,31.03,30.02');
    expect(url.searchParams.get('marker')).toBe('30,31');
    expect(url.searchParams.get('layer')).toBe('mapnik');
  });
});
