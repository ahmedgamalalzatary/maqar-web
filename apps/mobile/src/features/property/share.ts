import { fmtMoney, type Lang, pickField, type PropertyCard } from '@maqar/shared';
import { Share } from 'react-native';
import { m, type useT } from '@/core/i18n';

/**
 * Shares a listing: its title, price and place, and a link that opens this exact listing in an
 * installed app. Without the app the text still carries what was shared. Used by the property page
 * and the card's long-press preview.
 */
export function shareListing(card: PropertyCard, lang: Lang, t: ReturnType<typeof useT>) {
  const title = pickField(card, 'title', lang);
  const place = lang === 'ar' ? `${card.compoundAr} | ${card.area.nameAr}` : `${card.compoundEn} | ${card.area.nameEn}`;
  const suffix = card.category === 'rent' ? t(m.common.mo) : card.category === 'stay' ? t(m.common.night) : '';
  return Share.share({
    title,
    message: `${title}\n${fmtMoney(card.price, lang, false)} ${suffix}\n${place}\n${t(m.property.onMaqar)}\nmaqar://property/${card.id}`.replace(/ \n/g, '\n'),
  });
}
