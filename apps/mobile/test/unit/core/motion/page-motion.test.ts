import { peekOrigin, propertyKey, setOrigin, takeOrigin } from '@/core/motion/card-origin';
import { entranceClock, revealRows } from '@/core/motion/entrance';
import { swipeRemoves } from '@/components/swipe-to-remove';
import { coverRadius } from '@/components/theme-switch';
import { peekLayout } from '@/features/listings/components/peek';
import { pageBox, pageScale } from '@/features/property/components/card-grow';
import { withSaved } from '@/features/saved/hooks/use-saved';
import { makeCard } from '../../../utils/api';

const card = { rect: { x: 16, y: 300, width: 358, height: 380 }, radius: 26, cover: '/p1.jpg' };

// 2026-11-16 motion pass, part two: the pure parts of the page and list motion.
describe('The card a page grows from', () => {
  it('is read once, then forgotten', () => {
    setOrigin(propertyKey(7), card, 1000);
    expect(peekOrigin(propertyKey(7), 1100)?.cover).toBe('/p1.jpg');
    expect(takeOrigin(propertyKey(7), 1100)).toEqual(card);
    expect(takeOrigin(propertyKey(7), 1100)).toBeNull();
  });

  it('goes stale when the press never became a tap', () => {
    setOrigin(propertyKey(8), card, 1000);
    expect(takeOrigin(propertyKey(8), 4000)).toBeNull();
  });
});

describe('The page growing out of its card', () => {
  const W = 390;
  const H = 844;

  it('starts exactly on the card, with its corner, and ends on the full screen', () => {
    expect(pageBox(0, 0, card, W, H, 1)).toMatchObject({ left: 16, top: 300, width: 358, height: 380, borderRadius: 26 });
    expect(pageBox(1, 0, card, W, H, 1)).toMatchObject({ left: 0, top: 0, width: W, height: H, borderRadius: 0 });
  });

  it('draws the page at full size, scaled to the box, so nothing reflows', () => {
    expect(pageScale(0, card, W)).toBeCloseTo(358 / W);
    expect(pageScale(1, card, W)).toBe(1);
  });

  it('fades in place when there is no card', () => {
    expect(pageBox(0, 0, null, W, H, 1)).toMatchObject({ opacity: 0, width: W });
    expect(pageBox(1, 0, null, W, H, 1)).toMatchObject({ opacity: 1 });
  });

  it('follows an edge swipe: shrinks, rounds and moves the reading way', () => {
    const ltr = pageBox(1, 0.5, card, W, H, 1);
    const rtl = pageBox(1, 0.5, card, W, H, -1);
    expect(ltr.borderRadius).toBe(14);
    expect(ltr.transform[0]).toEqual({ translateX: 39 });
    expect(rtl.transform[0]).toEqual({ translateX: -39 });
    expect(ltr.transform[1]).toEqual({ scale: 0.94 });
  });
});

describe('The long-press preview', () => {
  it('settles centred, clear of the status bar, with room for its actions', () => {
    const box = peekLayout(390, 844, 47, 3);
    expect(box.x).toBe(24);
    expect(box.width).toBe(342);
    expect(box.y).toBeGreaterThanOrEqual(63);
    expect(box.y + box.height + 12 + 3 * 52).toBeLessThanOrEqual(844);
  });

  it('never grows wider than a phone-sized card on a tablet', () => {
    expect(peekLayout(1024, 1366, 24, 3).width).toBe(380);
  });
});

describe('Swiping a saved home off', () => {
  it('removes past a third of the width, or on a flick, and springs back otherwise', () => {
    expect(swipeRemoves(150, 0, 390)).toBe(true);
    expect(swipeRemoves(-150, 0, 390)).toBe(true);
    expect(swipeRemoves(60, 0, 390)).toBe(false);
    expect(swipeRemoves(60, 1500, 390)).toBe(true);
    // Dragged out, then flung back the other way: it stays.
    expect(swipeRemoves(150, -3000, 390)).toBe(false);
  });

  it('puts an undone home back where it was', () => {
    const a = makeCard({ id: 1 });
    const b = makeCard({ id: 2 });
    const c = makeCard({ id: 3 });
    expect(withSaved([a, c], b, true, 1).map((x) => x.id)).toEqual([1, 2, 3]);
    expect(withSaved([a, c], b, true).map((x) => x.id)).toEqual([2, 1, 3]);
    expect(withSaved([a, b, c], b, false).map((x) => x.id)).toEqual([1, 3]);
  });
});

describe('Rows rising in as they scroll into view', () => {
  it('lets a waiting row rise once, and marks every row seen', () => {
    const clock = entranceClock();
    const rise = jest.fn();
    clock.waiting.set('9', rise);
    revealRows(clock, ['9', '10']);
    revealRows(clock, ['9']);
    expect(rise).toHaveBeenCalledTimes(1);
    expect(clock.seen.has('10')).toBe(true);
  });
});

describe('The theme taking over', () => {
  it('spreads far enough to cover the farthest corner', () => {
    expect(coverRadius({ x: 0, y: 0 }, 300, 400)).toBe(500);
    expect(coverRadius({ x: 300, y: 50 }, 300, 400)).toBe(Math.ceil(Math.hypot(300, 350)));
  });
});
