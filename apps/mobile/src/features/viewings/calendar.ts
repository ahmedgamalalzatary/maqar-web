import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { getIcs } from './api/viewings.api';

/**
 * "Add to calendar" (contract §8.7): the API's `.ics` file. A phone saves it and opens the share
 * sheet, where the calendar app takes it; the web downloads it.
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
  await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'public.calendar-event', dialogTitle: 'Maqar' });
}
