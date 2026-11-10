import { Suspense } from "react";
import { AgentPage } from "@/components/agents-page";

/** `/agent/?id=3`: a query, not a path, because the dashboard is a static export. */
export default function Page() {
  return (
    <Suspense>
      <AgentPage />
    </Suspense>
  );
}
