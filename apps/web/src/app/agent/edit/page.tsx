import { Suspense } from "react";
import { EditAgent } from "@/components/agent-form";

export default function Page() {
  return (
    <Suspense>
      <EditAgent />
    </Suspense>
  );
}
