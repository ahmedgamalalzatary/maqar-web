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

/**
 * An avatar's letters, from the name as shown: the first letter in Arabic (Arabic has no
 * capitals, and two letters run together), up to two initials in English.
 */
export function initialsOf(name: string, lang: Lang, max = 1): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (lang === 'ar') return words[0]?.slice(0, 1) ?? '';
  return words
    .slice(0, max)
    .map((w) => w.slice(0, 1).toUpperCase())
    .join('');
}
