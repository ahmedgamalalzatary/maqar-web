import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { addToCalendar } from '@/features/viewings/calendar';

jest.mock('expo-file-system', () => ({
  Paths: { cache: '/cache' },
  File: jest.fn().mockImplementation(() => ({ exists: false, create: jest.fn(), write: jest.fn(), delete: jest.fn(), uri: 'file:///cache/v.ics' })),
}));
jest.mock('expo-file-system/legacy', () => ({ getContentUriAsync: jest.fn(async () => 'content://com.maqar.app/cache/v.ics') }));
jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn(async () => ({ resultCode: 0 })) }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => undefined) }));
jest.mock('@/features/viewings/api/viewings.api', () => ({ getIcs: jest.fn(async () => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n') }));

const os = Platform.OS;
const setOs = (value: typeof Platform.OS) => Object.defineProperty(Platform, 'OS', { value, configurable: true });

afterEach(() => {
  setOs(os);
  jest.clearAllMocks();
});

// On a phone, calendar apps open an .ics file that is viewed, but are not offered when it is
// shared, so "Add to calendar" listed no calendar app on Android.
describe('addToCalendar', () => {
  it('on Android, opens the file in a calendar app', async () => {
    setOs('android');
    await addToCalendar(2);
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith('android.intent.action.VIEW', {
      data: 'content://com.maqar.app/cache/v.ics',
      type: 'text/calendar',
      flags: 1,
    });
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('on Android with no app for calendar files, falls back to the share sheet', async () => {
    setOs('android');
    jest.mocked(IntentLauncher.startActivityAsync).mockRejectedValueOnce(new Error('No Activity found'));
    await addToCalendar(2);
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/v.ics', expect.objectContaining({ mimeType: 'text/calendar' }));
  });

  it('on iPhone, uses the share sheet, which offers the calendar', async () => {
    setOs('ios');
    await addToCalendar(2);
    expect(IntentLauncher.startActivityAsync).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/v.ics', expect.objectContaining({ UTI: 'public.calendar-event' }));
  });
});
