import type { Role } from '@maqar/shared';
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { homeFor, useSession } from '../store/session.store';

/**
 * Keeps each role in its own area. The client area is also open to guests;
 * the owner, agent and admin areas need that role.
 */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const user = useSession((s) => s.user);
  if (role === 'client') {
    if (user && user.role !== 'client') return <Redirect href={homeFor(user.role)} />;
    return children;
  }
  if (!user) return <Redirect href="/sign-in" />;
  if (user.role !== role) return <Redirect href={homeFor(user.role)} />;
  return children;
}
