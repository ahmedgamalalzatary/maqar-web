import { Suspense } from "react";
import { ClientPage } from "@/components/clients-page";

/** `/client/?id=21`: a query, not a path, because the dashboard is a static export. */
export default function Page() {
  return (
    <Suspense>
      <ClientPage />
    </Suspense>
  );
}
