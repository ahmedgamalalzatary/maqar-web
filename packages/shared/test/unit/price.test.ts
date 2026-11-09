import { applyPriceChange, priceDropText } from '../../src/price.js';

describe('applyPriceChange', () => {
  it('a drop keeps the price before it as the old price, and says by how much', () => {
    expect(applyPriceChange({ price: 10_000_000, oldPrice: null }, 9_500_000)).toEqual({
      price: 9_500_000,
      oldPrice: 10_000_000,
      dropped: true,
      dropPct: 5,
    });
  });

  it('a second drop keeps the highest old price, but the % is for this drop', () => {
    expect(applyPriceChange({ price: 9_500_000, oldPrice: 10_000_000 }, 9_000_000)).toEqual({
      price: 9_000_000,
      oldPrice: 10_000_000,
      dropped: true,
      dropPct: 5,
    });
  });

  it('a drop below a lower old price moves the old price up to the price before it', () => {
    // An old price under the current one is stale; the price before the drop is what it was.
    expect(applyPriceChange({ price: 12_000_000, oldPrice: 11_000_000 }, 11_400_000).oldPrice).toBe(12_000_000);
  });

  it('a rise is not a drop; it clears the old price once the price is back up to it', () => {
    expect(applyPriceChange({ price: 9_000_000, oldPrice: 10_000_000 }, 9_600_000)).toEqual({
      price: 9_600_000,
      oldPrice: 10_000_000,
      dropped: false,
      dropPct: 0,
    });
    expect(applyPriceChange({ price: 9_000_000, oldPrice: 10_000_000 }, 10_000_000).oldPrice).toBeNull();
    expect(applyPriceChange({ price: 9_000_000, oldPrice: null }, 9_500_000).oldPrice).toBeNull();
  });

  it('the same price changes nothing', () => {
    expect(applyPriceChange({ price: 9_000_000, oldPrice: 10_000_000 }, 9_000_000)).toEqual({
      price: 9_000_000,
      oldPrice: 10_000_000,
      dropped: false,
      dropPct: 0,
    });
  });

  it('a tiny drop still counts as at least 1%', () => {
    expect(applyPriceChange({ price: 10_000_000, oldPrice: null }, 9_990_000).dropPct).toBe(1);
  });
});

describe('priceDropText', () => {
  it('writes the notification in both languages', () => {
    const text = priceDropText({ titleAr: 'شاليه صف أول', titleEn: 'First-row chalet' }, 12_000_000, 11_400_000, 5);
    expect(text.titleEn).toBe('Price dropped 5%');
    expect(text.titleAr).toBe('السعر نزل ٥٪');
    expect(text.bodyEn).toBe('First-row chalet is now EGP 11.4M (was EGP 12M)');
    expect(text.bodyAr).toContain('شاليه صف أول');
    expect(text.bodyAr).toContain('بدل');
  });
});
