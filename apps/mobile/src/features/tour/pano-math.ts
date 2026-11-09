// The 360° viewer's geometry (contract §8.6), the same conventions as the demo's three.js viewer:
// `lon` turns around (degrees; growing lon turns right), `lat` looks up (+) or down (−), and `fov`
// is the vertical field of view. The shader in pano-view.tsx and `project` below must agree.

export type Look = { lon: number; lat: number };
export type View = Look & { fov: number };
export type Size = { width: number; height: number };

export const START_VIEW: View = { lon: 90, lat: 0, fov: 75 };
export const FOV_MIN = 35;
export const FOV_MAX = 95;
export const LAT_MAX = 82;
/** Degrees per pixel of drag at the starting zoom (the demo's 0.18). */
const DRAG_SPEED = 0.18;

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Vec = [number, number, number];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec): Vec => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** The unit direction for a look: x and z across the horizon, y up. */
export function direction({ lon, lat }: Look): Vec {
  return [Math.cos(rad(lat)) * Math.cos(rad(lon)), Math.sin(rad(lat)), Math.cos(rad(lat)) * Math.sin(rad(lon))];
}

/** The camera's forward, right and up vectors. */
export function basis(look: Look): { f: Vec; r: Vec; u: Vec } {
  const f = direction(look);
  const r = norm(cross(f, [0, 1, 0]));
  return { f, r, u: cross(r, f) };
}

/** Where a direction falls in the equirectangular photo: u across (0–1), v down from the top. */
export function panoCoord({ lon, lat }: Look): { u: number; v: number } {
  const u = (((lon % 360) + 360) % 360) / 360;
  return { u, v: 0.5 - lat / 180 };
}

/** A point is hidden when it is this far round from straight ahead (the demo's 0.15). */
const FACING_MIN = 0.15;

/** Where a direction shows on screen, with how squarely it faces the camera; null when out of sight. */
export function project(point: Look, view: View, size: Size): { x: number; y: number; facing: number } | null {
  const p = direction(point);
  const { f, r, u } = basis(view);
  const facing = dot(p, f);
  if (facing < FACING_MIN) return null;
  const tanV = Math.tan(rad(view.fov / 2));
  const tanH = tanV * (size.width / size.height);
  const sx = dot(p, r) / facing / tanH;
  const sy = dot(p, u) / facing / tanV;
  return { x: ((sx + 1) / 2) * size.width, y: ((1 - sy) / 2) * size.height, facing };
}

export function clampView(v: View): View {
  return { lon: ((v.lon % 360) + 360) % 360, lat: clamp(v.lat, -LAT_MAX, LAT_MAX), fov: clamp(v.fov, FOV_MIN, FOV_MAX) };
}

/** A drag of (dx, dy) pixels: moving the finger left turns right, as if pulling the room. */
export function dragBy(v: View, dx: number, dy: number): View {
  const k = (v.fov / START_VIEW.fov) * DRAG_SPEED;
  return clampView({ ...v, lon: v.lon - dx * k, lat: v.lat + dy * k });
}

/** A pinch: `scale` above 1 means the fingers moved apart, which zooms in. */
export function zoomBy(v: View, scale: number): View {
  return clampView({ ...v, fov: v.fov / scale });
}

/** The dots that lead to the other rooms, spread around the room as in the demo. */
export function hotspotLayout<T>(rooms: T[], current: T): { room: T; lon: number; lat: number }[] {
  const others = rooms.filter((r) => r !== current);
  return others.map((room, k) => ({ room, lon: 90 + 28 + k * (300 / others.length), lat: -6 }));
}
