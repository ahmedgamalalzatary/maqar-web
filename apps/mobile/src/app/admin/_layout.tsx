import { Stack } from 'expo-router';
import { RoleGate } from '@/features/auth/components/role-gate';

/** Admin tools are an open decision (contract §16.1 #6); for now an admin sees their account. */
export default function AdminLayout() {
  return (
    <RoleGate role="admin">
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
