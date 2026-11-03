"use client";

import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import { InstallmentCalculator } from "@/components/InstallmentCalculator";

export default function CalculatorPage() {
  const t = useT();
  return (
    <div>
      <PageHeader title={t("حاسبة التقسيط", "Installment calculator")} subtitle={t("اعرف قسطك قبل ما تتكلم مع حد", "Know your installment before talking to anyone")} />
      <div className="px-4 pb-6">
        <InstallmentCalculator price={8_000_000} defaultDown={10} defaultYears={6} editablePrice />
      </div>
    </div>
  );
}
