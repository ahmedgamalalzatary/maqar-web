import { type Lang, type ReportId, type ReportQuery, type ReportResult, reportCsv, reportFileName, type ReportTable } from "@maqar/shared";
import { useQuery } from "@tanstack/react-query";
import { useKey } from "./admin";
import { api } from "./client";

/** One report (phase 27) for a range and filters; the previous answer stays up while the next loads. */
export function useReport(id: ReportId, q: ReportQuery, enabled = true) {
  const key = useKey();
  const params = new URLSearchParams(Object.entries(q).flatMap(([k, v]) => (v === undefined || v === "" ? [] : [[k, String(v)]])));
  return useQuery({
    queryKey: [...key, "report", id, params.toString()],
    queryFn: ({ signal }) => api.request<ReportResult>(`/admin/analytics/${id}?${params}`, { signal, timeoutMs: 60_000 }),
    placeholderData: (prev) => (prev?.id === id ? prev : undefined),
    enabled,
  });
}

/** Saves a table as a CSV file the browser downloads. */
export function downloadCsv(r: ReportResult, table: ReportTable, lang: Lang): void {
  const blob = new Blob([reportCsv(table, lang)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = reportFileName(r, table.key);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
