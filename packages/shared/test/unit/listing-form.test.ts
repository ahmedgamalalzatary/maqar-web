import { emptyListingForm, readPhone, type ListingForm, listingBodyOf, listingFormOf, listingStepErrors, readWholeNumber } from '../../src/listing-form.js';
import type { AdminListing } from '../../src/listings.js';

const filled = (over: Partial<ListingForm> = {}): ListingForm => ({
  ...emptyListingForm(),
  type: 'apartment',
  areaId: 'new-cairo',
  beds: '3',
  baths: '2',
  sizeM2: '165',
  price: '7,250,000',
  finishing: 'full',
  photos: [{ key: 'a', url: '/uploads/listings/a.jpg' }],
  ...over,
});

describe('readWholeNumber', () => {
  it('reads Arabic digits and ignores separators and spaces', () => {
    expect(readWholeNumber('٧٬٢٥٠٬٠٠٠')).toBe(7_250_000);
    expect(readWholeNumber(' 7,250,000 ')).toBe(7_250_000);
    expect(readWholeNumber('١٦٥')).toBe(165);
  });
  it('is undefined for empty or not a whole number', () => {
    expect(readWholeNumber('')).toBeUndefined();
    expect(readWholeNumber('abc')).toBeUndefined();
    expect(readWholeNumber('3.5')).toBeUndefined();
  });
});

describe('readPhone (the owner’s phone)', () => {
  it('reads Arabic digits and drops spaces, dashes and brackets, keeping a leading +', () => {
    expect(readPhone('٠١٠١٢٣٤٥٦٧٨')).toBe('01012345678');
    expect(readPhone('010-1234-5678')).toBe('01012345678');
    expect(readPhone('+20 (100) 123 4567')).toBe('+201001234567');
  });
  it('is undefined for letters, a + in the middle, or too few or too many digits', () => {
    expect(readPhone('010abc5678')).toBeUndefined();
    expect(readPhone('010+1234567')).toBeUndefined();
    expect(readPhone('12345')).toBeUndefined();
    expect(readPhone('1'.repeat(21))).toBeUndefined();
  });
});

describe('Listing form steps (contract §9.2)', () => {
  it('Type needs a unit type', () => {
    expect(listingStepErrors('type', emptyListingForm())).toEqual(['type']);
    expect(listingStepErrors('type', filled())).toEqual([]);
  });

  it('Location needs an area; the title and the owner may stay empty, but a phone must be one', () => {
    expect(listingStepErrors('location', filled({ areaId: null }))).toEqual(['areaId']);
    expect(listingStepErrors('location', filled({ titleAr: '', titleEn: '', ownerPhone: '' }))).toEqual([]);
    expect(listingStepErrors('location', filled({ ownerPhone: '010abc' }))).toEqual(['ownerPhone']);
    expect(listingStepErrors('location', filled({ ownerPhone: '٠١٠-١٢٣٤-٥٦٧٨' }))).toEqual([]);
  });

  it('Details needs the numbers and the finishing', () => {
    expect(listingStepErrors('details', filled({ beds: '', sizeM2: '5', price: '0', finishing: null }))).toEqual(['beds', 'sizeM2', 'price', 'finishing']);
    expect(listingStepErrors('details', filled({ beds: '0' }))).toEqual([]);
  });

  it('a plan needs both its down payment and its years', () => {
    expect(listingStepErrors('details', filled({ downPct: '20', planYears: '' }))).toEqual(['planYears']);
    expect(listingStepErrors('details', filled({ downPct: '150', planYears: '5' }))).toEqual(['downPct']);
    expect(listingStepErrors('details', filled({ downPct: '20', planYears: '5' }))).toEqual([]);
  });

  it('Photos needs at least one, and none still uploading or failed', () => {
    expect(listingStepErrors('photos', filled({ photos: [] }))).toEqual(['photos']);
    expect(listingStepErrors('photos', filled({ photos: [{ key: 'b', local: 'file:///b.jpg' }] }))).toEqual(['photos']);
    expect(listingStepErrors('photos', filled())).toEqual([]);
  });
});

describe('listingBodyOf', () => {
  it('sends the numbers, the uploaded photos in order and leaves empty texts out', () => {
    const body = listingBodyOf(
      filled({
        photos: [
          { key: 'b', url: '/uploads/listings/b.jpg' },
          { key: 'a', url: '/uploads/listings/a.jpg' },
        ],
        features: ['pool'],
        delivery: 2028,
        ownerName: ' Hany ',
        ownerPhone: '',
        downPct: '20',
        planYears: '5',
      }),
    );
    expect(body).toEqual({
      category: 'sale',
      type: 'apartment',
      areaId: 'new-cairo',
      titleAr: '',
      titleEn: '',
      compoundAr: '',
      compoundEn: '',
      descAr: '',
      descEn: '',
      price: 7_250_000,
      beds: 3,
      baths: 2,
      sizeM2: 165,
      finishing: 'full',
      delivery: 2028,
      features: ['pool'],
      plan: { downPct: 20, years: 5 },
      images: ['/uploads/listings/b.jpg', '/uploads/listings/a.jpg'],
      ownerName: 'Hany',
      ownerPhone: null,
    });
  });

  it('sends the owner’s phone in the form the server takes', () => {
    expect(listingBodyOf(filled({ ownerPhone: ' ٠١٠-١٢٣٤-٥٦٧٨ ' })).ownerPhone).toBe('01012345678');
  });

  it('a rent or a stay has no plan', () => {
    expect(listingBodyOf(filled({ category: 'rent', downPct: '20', planYears: '5' })).plan).toBeNull();
  });
});

it('listingFormOf fills the form back from a saved listing', () => {
  const l = {
    id: 5,
    category: 'rent',
    type: 'villa',
    area: { id: 'zayed', nameAr: 'الشيخ زايد', nameEn: 'Sheikh Zayed' },
    titleAr: 'فيلا',
    titleEn: 'Villa',
    compoundAr: '',
    compoundEn: '',
    descAr: 'وصف',
    descEn: '',
    price: 90_000,
    beds: 4,
    baths: 3,
    sizeM2: 300,
    finishing: 'furnished',
    delivery: 'ready',
    plan: null,
    features: ['garden'],
    images: ['/uploads/seed/p1.jpg'],
    ownerName: null,
    ownerPhone: '+20100',
  } as unknown as AdminListing;
  expect(listingFormOf(l)).toMatchObject({
    category: 'rent',
    type: 'villa',
    areaId: 'zayed',
    titleAr: 'فيلا',
    price: '90000',
    beds: '4',
    finishing: 'furnished',
    features: ['garden'],
    photos: [{ url: '/uploads/seed/p1.jpg' }],
    ownerName: '',
    ownerPhone: '+20100',
    downPct: '',
  });
});
