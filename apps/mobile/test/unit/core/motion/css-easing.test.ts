import fs from 'fs';
import path from 'path';
import { CSS_EASE_OUT } from '@/core/motion/motion';

// Reanimated's CSS transitions accept only the keyword curves as strings ("ease-out", "linear"…).
// A "cubic-bezier(…)" string throws on the device the moment the style is applied, which took the
// whole app down on launch; jest mocks Reanimated, so only these checks catch it.
describe('CSS transition curves', () => {
  it('builds the ease-out curve with cubicBezier(), not a CSS string', () => {
    expect(typeof CSS_EASE_OUT).not.toBe('string');
  });

  it('has no "cubic-bezier(…)" string anywhere in the app', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name) && /['"`]cubic-bezier\(/.test(fs.readFileSync(p, 'utf8'))) hits.push(p);
      }
    };
    walk(path.join(__dirname, '../../../../src'));
    expect(hits).toEqual([]);
  });
});
