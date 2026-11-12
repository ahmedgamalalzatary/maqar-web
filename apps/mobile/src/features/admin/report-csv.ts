import { type Lang, reportCsv, reportFileName, type ReportResult, type ReportTable } from '@maqar/shared';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** A report table as a CSV file in the share sheet (phase 27): save it, mail it or open it in a spreadsheet app. */
export async function shareCsv(r: ReportResult, table: ReportTable, lang: Lang): Promise<void> {
  const file = new File(Paths.cache, reportFileName(r, table.key));
  if (file.exists) file.delete();
  file.create();
  file.write(reportCsv(table, lang));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Maqar' });
}
