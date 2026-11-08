import type { Bi, Lang } from '@maqar/shared';
import { useCallback } from 'react';
import { useSettings } from '@/core/settings/store';

export function useLang(): Lang {
  return useSettings((s) => s.lang);
}

/** `t("عربي", "English")` or `t({ ar, en })`, the same pattern as the demo. */
export function useT() {
  const lang = useLang();
  return useCallback((a: string | Bi, b?: string) => (typeof a === 'object' ? a[lang] : lang === 'ar' ? a : (b ?? a)), [lang]);
}

/** Layout direction: Arabic is right-to-left. */
export function useDir(): 'rtl' | 'ltr' {
  return useLang() === 'ar' ? 'rtl' : 'ltr';
}
