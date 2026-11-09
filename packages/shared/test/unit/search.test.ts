import { describe, expect, it } from 'vitest';
import { histogramBin, isFullRange, priceCategories, priceScale, SIZE_SCALE } from '../../src/search.js';

describe('priceScale (contract §8.4)', () => {
  it('follows the category: monthly rent, nightly stays, purchase price', () => {
    expect(priceScale('rent')).toEqual({ min: 0, max: 200_000, step: 5_000 });
    expect(priceScale('stay')).toEqual({ min: 0, max: 15_000, step: 500 });
    expect(priceScale('sale')).toEqual({ min: 0, max: 30_000_000, step: 250_000 });
    expect(priceScale('project')).toEqual(priceScale('sale'));
  });

  it('uses the purchase scale for All', () => {
    expect(priceScale(undefined)).toEqual(priceScale('sale'));
  });
});

describe('priceCategories', () => {
  it('limits a price filter on All to sale and project listings', () => {
    expect(priceCategories(undefined)).toEqual(['sale', 'project']);
  });

  it('keeps a picked category as it is', () => {
    expect(priceCategories('rent')).toEqual(['rent']);
    expect(priceCategories('project')).toEqual(['project']);
  });
});

describe('histogramBin', () => {
  const { min, max } = SIZE_SCALE;

  it('splits the scale into equal bins', () => {
    expect(histogramBin(50, min, max, 28)).toBe(0);
    expect(histogramBin(140, min, max, 28)).toBe(5);
    expect(histogramBin(450, min, max, 28)).toBe(24);
  });

  it('puts values outside the scale in the first and last bins', () => {
    expect(histogramBin(10, min, max, 28)).toBe(0);
    expect(histogramBin(500, min, max, 28)).toBe(27);
    expect(histogramBin(9_000, min, max, 28)).toBe(27);
  });
});

describe('isFullRange', () => {
  it('is true when both thumbs sit at the ends, so no filter applies', () => {
    expect(isFullRange([0, 200_000], priceScale('rent'))).toBe(true);
    expect(isFullRange([0, 195_000], priceScale('rent'))).toBe(false);
    expect(isFullRange([60, 500], SIZE_SCALE)).toBe(false);
  });
});
