import { SetMetadata } from '@nestjs/common';
import type { Role } from '@maqar/shared';

export const ROLES_KEY = 'roles';

/** Only these roles may call the route. Used with the global RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
