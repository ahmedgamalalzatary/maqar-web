import { clampView, dragBy, hotspotLayout, panoCoord, project, START_VIEW, zoomBy } from '@/features/tour/pano-math';

const view = { lon: 90, lat: 0, fov: 75 };
const screen = { width: 400, height: 800 };

describe('the starting view', () => {
  it('looks where the demo does', () => {
    expect(START_VIEW).toEqual({ lon: 90, lat: 0, fov: 75 });
  });
});

describe('project', () => {
  it('puts the point straight ahead in the middle of the screen', () => {
    const p = project({ lon: 90, lat: 0 }, view, screen)!;
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(400);
    expect(p.facing).toBeCloseTo(1);
  });

  it('puts a point further round (bigger lon) on the right, and a higher one above', () => {
    expect(project({ lon: 100, lat: 0 }, view, screen)!.x).toBeGreaterThan(200);
    expect(project({ lon: 80, lat: 0 }, view, screen)!.x).toBeLessThan(200);
    expect(project({ lon: 90, lat: 10 }, view, screen)!.y).toBeLessThan(400);
  });

  it('reaches the screen edge at half the vertical field of view', () => {
    expect(project({ lon: 90, lat: 37.5 }, view, screen)!.y).toBeCloseTo(0, 0);
  });

  it('hides points behind or far to the side', () => {
    expect(project({ lon: 270, lat: 0 }, view, screen)).toBeNull();
    expect(project({ lon: 180, lat: 0 }, view, screen)).toBeNull();
  });
});

describe('panoCoord', () => {
  it('maps a direction to the photo: lon across, the horizon in the middle, up at the top', () => {
    expect(panoCoord({ lon: 90, lat: 0 })).toEqual({ u: 0.25, v: 0.5 });
    expect(panoCoord({ lon: 0, lat: 90 })).toEqual({ u: 0, v: 0 });
    expect(panoCoord({ lon: -90, lat: -90 })).toEqual({ u: 0.75, v: 1 });
  });
});

describe('dragBy', () => {
  it('turns right when the finger moves left, and up when it moves down, slower when zoomed in', () => {
    const turned = dragBy(view, -100, 50);
    expect(turned.lon).toBeGreaterThan(90);
    expect(turned.lat).toBeGreaterThan(0);
    const zoomed = dragBy({ ...view, fov: 37.5 }, -100, 0);
    expect(zoomed.lon - 90).toBeCloseTo((turned.lon - 90) / 2);
  });

  it('never looks past straight up or down', () => {
    expect(dragBy(view, 0, 10_000).lat).toBe(82);
    expect(dragBy(view, 0, -10_000).lat).toBe(-82);
  });
});

describe('zoomBy and clampView', () => {
  it('zooms in when the fingers spread, within 35° and 95°', () => {
    expect(zoomBy(view, 2).fov).toBeCloseTo(37.5);
    expect(zoomBy(view, 10).fov).toBe(35);
    expect(zoomBy(view, 0.1).fov).toBe(95);
  });

  it('keeps lon between 0 and 360', () => {
    expect(clampView({ lon: 370, lat: 0, fov: 75 }).lon).toBeCloseTo(10);
    expect(clampView({ lon: -10, lat: 0, fov: 75 }).lon).toBeCloseTo(350);
  });
});

describe('hotspotLayout', () => {
  it('places the other rooms around the room, as the demo does', () => {
    expect(hotspotLayout(['living', 'open', 'master'], 'living')).toEqual([
      { room: 'open', lon: 118, lat: -6 },
      { room: 'master', lon: 268, lat: -6 },
    ]);
  });

  it('has no dots in a one-room tour', () => {
    expect(hotspotLayout(['living'], 'living')).toEqual([]);
  });
});
