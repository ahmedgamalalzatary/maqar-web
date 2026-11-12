import { RoleTabs } from '@/core/navigation/role-tabs';
import { useOpenReports } from '@/features/admin/hooks/use-people';

/** The admin's tabs (contract §12). The role check is in the admin layout above. More shows how many chat reports are open (phase 24). */
export default function AdminTabs() {
  const reports = useOpenReports().data?.length ?? 0;
  return <RoleTabs role="admin" badges={{ more: reports }} />;
}
