/**
 * The API base URL. In development `.env` says `localhost`, which on a phone or
 * an Android emulator is the device itself, so swap in the dev machine's address
 * that the Expo dev server reports (`hostUri`, e.g. "192.168.1.5:8081").
 */
export function resolveApiUrl(url: string | undefined, hostUri: string | undefined): string {
  if (!url) throw new Error('EXPO_PUBLIC_API_URL is not set. Add it to the root .env.');
  const clean = url.replace(/\/+$/, '');
  const devHost = hostUri?.split(':')[0];
  if (!devHost) return clean;
  return clean.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/, `$1${devHost}`);
}

/**
 * Photos come back as paths on the API host (`/uploads/...`). Put them on the host of
 * the API base URL, without its `/v1`. A full URL is kept as it is.
 */
export function mediaUrlFrom(apiBase: string, path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return new URL(apiBase).origin + path;
}
