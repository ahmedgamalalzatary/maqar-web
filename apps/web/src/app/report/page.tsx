import { Suspense } from "react";
import { ReportPage } from "@/components/reports-page";

/** `/report/?id=deals`: a query, not a path, because the dashboard is a static export. */
export default function Page() {
  return (
    <Suspense>
      <ReportPage />
    </Suspense>
  );
}
