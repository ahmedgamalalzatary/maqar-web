import { projected, rubberband, shouldDismiss } from '@/core/motion/drag';

// Letting go of a sheet or a full-screen photo: a flick is enough, a slow small drag snaps back.
describe('shouldDismiss', () => {
  const HEIGHT = 600;
  it('closes after a long drag', () => {
    expect(shouldDismiss(400, 0, HEIGHT)).toBe(true);
  });
  it('closes after a short, fast flick down', () => {
    expect(shouldDismiss(30, 1500, HEIGHT)).toBe(true);
  });
  it('snaps back after a short, slow drag', () => {
    expect(shouldDismiss(60, 50, HEIGHT)).toBe(false);
  });
  it('snaps back when the flick goes up again', () => {
    expect(shouldDismiss(250, -2000, HEIGHT)).toBe(false);
  });
});

describe('the helpers', () => {
  it('projects where a flick would come to rest', () => {
    expect(projected(0)).toBe(0);
    expect(projected(1000)).toBeGreaterThan(projected(500));
  });
  it('resists more the further it is pulled past an edge', () => {
    expect(rubberband(0, 600)).toBe(0);
    expect(rubberband(100, 600)).toBeLessThan(100);
    expect(rubberband(-100, 600)).toBeGreaterThan(-100);
    expect(rubberband(400, 600) - rubberband(300, 600)).toBeLessThan(rubberband(100, 600) - rubberband(0, 600));
  });
});
