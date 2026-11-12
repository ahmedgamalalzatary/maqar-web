import { LISTING_STEPS, emptyListingForm, readMobile, readPhone, type ListingForm, listingBodyOf, listingFormOf, listingStepErrors, readWholeNumber } from '../../src/listing-form.js';
import { type AdminListing, fmtDuration, panoramaProblem, videoProblem } from '../../src/listings.js';

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

describe('readMobile (a client account’s number)', () => {
  it('is a readable phone of 8 to 15 digits, the range the API takes', () => {
    expect(readMobile('٠١٠ ١٢٣٤ ٥٦٧٨')).toBe('01012345678');
    expect(readMobile('+20 100 123 4567')).toBe('+201001234567');
    expect(readMobile('1234567')).toBeUndefined();
    expect(readMobile('1'.repeat(16))).toBeUndefined();
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

  it('the 360° tour may be empty, but each room needs both names and an uploaded panorama', () => {
    const room = { key: 'r', nameAr: 'الصالة', nameEn: 'Living room', url: '/uploads/tours/r.jpg' };
    expect(LISTING_STEPS).toEqual(['type', 'location', 'details', 'photos', 'videos', 'tour', 'review']);
    expect(listingStepErrors('tour', filled())).toEqual([]);
    expect(listingStepErrors('tour', filled({ tour: [room] }))).toEqual([]);
    expect(listingStepErrors('tour', filled({ tour: [{ ...room, nameEn: ' ' }] }))).toEqual(['tour']);
    expect(listingStepErrors('tour', filled({ tour: [{ ...room, url: undefined, local: 'file:///r.jpg' }] }))).toEqual(['tour']);
  });

  it('videos may be none, but each must be uploaded before the form goes on', () => {
    const video = { key: 'v', url: '/uploads/videos/v.mp4', poster: '/uploads/videos/v.jpg', durationS: 42 };
    expect(listingStepErrors('videos', filled())).toEqual([]);
    expect(listingStepErrors('videos', filled({ videos: [video] }))).toEqual([]);
    expect(listingStepErrors('videos', filled({ videos: [{ key: 'w', local: 'file:///w.mov' }] }))).toEqual(['videos']);
    expect(listingStepErrors('videos', filled({ videos: [{ key: 'w', local: 'file:///w.mov', failed: true }] }))).toEqual(['videos']);
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
      developerAr: null,
      developerEn: null,
      floor: null,
      maintenanceFee: null,
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
      videos: [],
      tour: [],
    });
  });

  it('sends the uploaded videos in order', () => {
    const body = listingBodyOf(
      filled({
        videos: [
          { key: 'b', url: '/uploads/videos/b.mp4', poster: '/uploads/videos/b.jpg', durationS: 30 },
          { key: 'a', url: '/uploads/videos/a.mp4', poster: '/uploads/videos/a.jpg', durationS: 12 },
        ],
      }),
    );
    expect(body.videos).toEqual(['/uploads/videos/b.mp4', '/uploads/videos/a.mp4']);
  });

  it('sends the tour in order with trimmed names', () => {
    const body = listingBodyOf(
      filled({
        tour: [
          { key: 'k', nameAr: ' المطبخ ', nameEn: 'Kitchen ', url: '/uploads/tours/k.jpg' },
          { key: 'l', nameAr: 'الصالة', nameEn: 'Living room', url: '/uploads/tours/l.jpg' },
        ],
      }),
    );
    expect(body.tour).toEqual([
      { nameAr: 'المطبخ', nameEn: 'Kitchen', pano: '/uploads/tours/k.jpg' },
      { nameAr: 'الصالة', nameEn: 'Living room', pano: '/uploads/tours/l.jpg' },
    ]);
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
    tourRooms: [{ id: 7, nameAr: 'الصالة', nameEn: 'Living room', pano: '/uploads/seed/pano/a.jpg' }],
    videos: [{ url: '/uploads/videos/v.mp4', poster: '/uploads/videos/v.jpg', durationS: 75, width: 1280, height: 720 }],
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
    tour: [{ nameAr: 'الصالة', nameEn: 'Living room', url: '/uploads/seed/pano/a.jpg' }],
    videos: [{ key: '/uploads/videos/v.mp4', url: '/uploads/videos/v.mp4', poster: '/uploads/videos/v.jpg', durationS: 75 }],
  });
});

it('videoProblem: an MP4 or MOV, at most 150 MB and 3 minutes', () => {
  const mb = 1024 * 1024;
  expect(videoProblem({ type: 'video/mp4', bytes: 40 * mb, durationS: 95 })).toBeNull();
  expect(videoProblem({ type: 'video/quicktime', bytes: 150 * mb, durationS: 180 })).toBeNull();
  // The duration is not always known before the upload; the server checks it then.
  expect(videoProblem({ type: 'video/mp4', bytes: mb })).toBeNull();
  expect(videoProblem({ type: 'video/webm', bytes: mb, durationS: 5 })).toBe('type');
  expect(videoProblem({ type: 'video/mp4', bytes: 150 * mb + 1, durationS: 5 })).toBe('size');
  expect(videoProblem({ type: 'video/mp4', bytes: mb, durationS: 180.6 })).toBe('long');
  expect(fmtDuration(75)).toBe('1:15');
  expect(fmtDuration(9)).toBe('0:09');
  expect(fmtDuration(180, 'ar')).toBe('٣:٠٠');
});

it('panoramaProblem: a tour photo is 2:1 within 1% and at least 4096×2048', () => {
  expect(panoramaProblem(4096, 2048)).toBeNull();
  expect(panoramaProblem(8192, 4096)).toBeNull();
  expect(panoramaProblem(4100, 2049)).toBeNull();
  expect(panoramaProblem(4096, 3072)).toBe('ratio');
  expect(panoramaProblem(4096, 0)).toBe('ratio');
  expect(panoramaProblem(2048, 1024)).toBe('small');
});
