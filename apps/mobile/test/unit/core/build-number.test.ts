import type { ExpoConfig } from 'expo/config';
import appConfig from '../../../app.config';

// OPS-03 (2026-11-15): each store build carries a build number that goes up, set by CI from
// the commit count on main, so Play and the App Store accept the next upload.
const base = { name: 'MQR', slug: 'mqr', version: '1.0.0', android: { package: 'com.maqar.app' }, ios: { bundleIdentifier: 'com.maqar.app' } } as ExpoConfig;
const build = () => appConfig({ config: base } as never);

afterEach(() => {
  delete process.env.APP_BUILD_NUMBER;
});

describe('the build number', () => {
  it('goes to Android as versionCode and to iOS as buildNumber', () => {
    process.env.APP_BUILD_NUMBER = '412';
    const c = build();
    expect(c.android).toMatchObject({ package: 'com.maqar.app', versionCode: 412 });
    expect(c.ios).toMatchObject({ bundleIdentifier: 'com.maqar.app', buildNumber: '412' });
    expect(c.version).toBe('1.0.0');
  });

  it('is left to Expo’s default for a local build', () => {
    const c = build();
    expect(c.android?.versionCode).toBeUndefined();
    expect(c.ios?.buildNumber).toBeUndefined();
  });

  it.each(['0', '-3', '1.5', 'abc', '2200000000'])('stops the build when it is %s, which no store accepts', (n) => {
    process.env.APP_BUILD_NUMBER = n;
    expect(build).toThrow(/APP_BUILD_NUMBER/);
  });
});
