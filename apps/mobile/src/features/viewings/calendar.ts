import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { getIcs } from './api/viewings.api';

/** Lets the calendar app read the file it is handed (Intent.FLAG_GRANT_READ_URI_PERMISSION). */
const GRANT_READ = 1;

/**
 * "Add to calendar" (contract §8.7): the API's `.ics` file. Android opens it in a calendar app
 * (calendar apps take a viewed .ics, but are not offered when it is shared), falling back to the
 * share sheet when none is installed; an iPhone's share sheet offers the calendar; the web downloads it.
 */
export async function addToCalendar(viewingId: number): Promise<void> {
  const ics = await getIcs(viewingId);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'maqar-viewing.ics';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, `maqar-viewing-${viewingId}.ics`);
  if (file.exists) file.delete();
  file.create();
  file.write(ics);
  if (Platform.OS === 'android') {
    try {
      const data = await getContentUriAsync(file.uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data, type: 'text/calendar', flags: GRANT_READ });
      return;
    } catch {
      // No app opens calendar files: the share sheet still lets the user save or send it.
    }
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'public.calendar-event', dialogTitle: 'Maqar' });
}
