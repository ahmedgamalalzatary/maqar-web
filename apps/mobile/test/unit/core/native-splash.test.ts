import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');

// The phone's own launch screen shows before any of the app's code runs, so it cannot know whether
// an admin set a picture or a video. It is plain navy (owner, 2026-11-14): the logo or the admin's
// opening screen is drawn by the app right after.
describe('the native launch screen', () => {
  const app = JSON.parse(readFileSync(path.join(root, 'app.json'), 'utf8')) as { expo: { plugins: unknown[] } };
  const splash = app.expo.plugins.find((p): p is [string, { image: string; backgroundColor: string }] => Array.isArray(p) && p[0] === 'expo-splash-screen');

  it('is navy with a blank image, not the logo', () => {
    expect(splash?.[1].backgroundColor).toBe('#041525');
    expect(splash?.[1].image).toBe('./assets/brand/splash-blank.png');
  });

  it('uses an image that is fully see-through', () => {
    const png = readFileSync(path.join(root, 'assets/brand/splash-blank.png'));
    // PNG colour type 6 (RGBA) in the header; every pixel's alpha is checked by the script that made it.
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png[25]).toBe(6);
  });
});
