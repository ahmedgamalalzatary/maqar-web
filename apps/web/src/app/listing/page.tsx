import { Suspense } from "react";
import { ListingPage } from "@/components/listing-page";

/** `/listing/?id=7`. A query, not a path, because the dashboard is a static export. */
export default function Page() {
  return (
    <Suspense>
      <ListingPage />
    </Suspense>
  );
}
