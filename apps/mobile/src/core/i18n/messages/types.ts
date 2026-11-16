import type { Bi } from '@maqar/shared';

/** A catalog entry: fixed text in both languages, or a function that builds it from values. */
export type Message = Bi | ((...args: never[]) => Bi);
