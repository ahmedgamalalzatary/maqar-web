import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Marks a route that needs no sign-in. Every other route needs a valid access token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
