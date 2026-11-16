import { ENTRANCE_MAX, ENTRANCE_WINDOW_MS, entranceClock, entersNow } from '@/core/motion/entrance';

// The first rows of a list rise in when it first shows; rows that mount later (scrolled to, or
// remounted by the list) are simply there, so scrolling never replays the animation.
describe('Which rows rise in', () => {
  it('lets the first rows in, one after another, when the list first shows', () => {
    const clock = entranceClock();
    expect(entersNow(clock, 0, false, 1000)).toBe(true);
    expect(entersNow(clock, ENTRANCE_MAX - 1, false, 1100)).toBe(true);
  });

  it('keeps rows past the first few still', () => {
    const clock = entranceClock();
    expect(entersNow(clock, ENTRANCE_MAX, false, 1000)).toBe(false);
  });

  it('keeps rows still once the list has been on screen a moment', () => {
    const clock = entranceClock();
    entersNow(clock, 0, false, 1000);
    expect(entersNow(clock, 1, false, 1000 + ENTRANCE_WINDOW_MS)).toBe(false);
  });

  it('keeps every row still when the phone asks for less motion', () => {
    expect(entersNow(entranceClock(), 0, true, 1000)).toBe(false);
  });
});
