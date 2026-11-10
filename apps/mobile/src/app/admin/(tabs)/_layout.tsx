import { RoleTabs } from '@/core/navigation/role-tabs';

/** The admin's tabs (contract §12). The role check is in the admin layout above. */
export default function AdminTabs() {
  return <RoleTabs role="admin" />;
}
