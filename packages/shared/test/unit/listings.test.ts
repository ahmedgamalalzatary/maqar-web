import { canMoveTo, closedStatusFor, defaultTitle } from '../../src/listings.js';

const area = { nameAr: 'التجمع الخامس', nameEn: 'New Cairo' };

describe('defaultTitle (contract §9.2: "<type> <beds> beds | <area>")', () => {
  it('names the type, the bedrooms and the area in both languages', () => {
    expect(defaultTitle({ type: 'apartment', beds: 3 }, area)).toEqual({
      ar: 'شقة ٣ غرف | التجمع الخامس',
      en: 'Apartment, 3 beds | New Cairo',
    });
  });

  it('says one and two bedrooms the Arabic way', () => {
    expect(defaultTitle({ type: 'chalet', beds: 1 }, area)).toEqual({ ar: 'شاليه غرفة واحدة | التجمع الخامس', en: 'Chalet, 1 bed | New Cairo' });
    expect(defaultTitle({ type: 'villa', beds: 2 }, area).ar).toBe('فيلا غرفتين | التجمع الخامس');
    expect(defaultTitle({ type: 'villa', beds: 11 }, area).ar).toBe('فيلا ١١ غرفة | التجمع الخامس');
  });

  it('leaves the bedrooms out when there are none (a studio)', () => {
    expect(defaultTitle({ type: 'studio', beds: 0 }, area)).toEqual({ ar: 'ستوديو | التجمع الخامس', en: 'Studio | New Cairo' });
  });
});

describe('listing status changes (no review step: admins publish)', () => {
  it('publishes a draft or an unpublished listing, and nothing already live', () => {
    expect(canMoveTo('draft', 'approved')).toBe(true);
    expect(canMoveTo('unpublished', 'approved')).toBe(true);
    expect(canMoveTo('sold', 'approved')).toBe(true);
    expect(canMoveTo('approved', 'approved')).toBe(false);
  });

  it('unpublishes only a live listing', () => {
    expect(canMoveTo('approved', 'unpublished')).toBe(true);
    expect(canMoveTo('draft', 'unpublished')).toBe(false);
    expect(canMoveTo('sold', 'unpublished')).toBe(false);
  });

  it('closes a live or unpublished listing as sold or rented, never a draft, never twice', () => {
    expect(canMoveTo('approved', 'sold')).toBe(true);
    expect(canMoveTo('unpublished', 'rented')).toBe(true);
    expect(canMoveTo('draft', 'sold')).toBe(false);
    expect(canMoveTo('sold', 'sold')).toBe(false);
    expect(canMoveTo('sold', 'rented')).toBe(false);
  });

  it('a home for sale or a project is sold; one to rent or a stay is rented', () => {
    expect(closedStatusFor('sale')).toBe('sold');
    expect(closedStatusFor('project')).toBe('sold');
    expect(closedStatusFor('rent')).toBe('rented');
    expect(closedStatusFor('stay')).toBe('rented');
  });
});
