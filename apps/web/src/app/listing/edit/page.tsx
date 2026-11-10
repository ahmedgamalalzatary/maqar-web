import { Suspense } from "react";
import { EditListing } from "@/components/listing-form";

export default function Page() {
  return (
    <Suspense>
      <EditListing />
    </Suspense>
  );
}
