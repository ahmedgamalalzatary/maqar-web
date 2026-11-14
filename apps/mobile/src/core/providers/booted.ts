import { createContext, useContext } from 'react';

/**
 * Whether the app's start-up work (resuming the session) is done. The screens wait for it; the
 * opening screen shows while it runs (2026-11-14), since the phone's own launch screen is blank.
 */
export const BootedContext = createContext(true);
export const useBooted = () => useContext(BootedContext);
