import { toggled, useCompare } from '@/features/compare/store/compare.store';

const h = (id: number) => ({ id, cover: `/uploads/seed/p${id}.jpg` });

describe('toggled', () => {
  it('adds a home, then a second one', () => {
    expect(toggled([], h(1))).toEqual({ homes: [h(1)], result: 'added' });
    expect(toggled([h(1)], h(2))).toEqual({ homes: [h(1), h(2)], result: 'added' });
  });

  it('replaces the oldest when two are picked', () => {
    expect(toggled([h(1), h(2)], h(3))).toEqual({ homes: [h(2), h(3)], result: 'replaced' });
  });

  it('removes a home that is already picked', () => {
    expect(toggled([h(1), h(2)], h(1))).toEqual({ homes: [h(2)], result: 'removed' });
  });
});

describe('the compare list', () => {
  beforeEach(() => useCompare.setState({ homes: [] }));

  it('puts a home in a slot, and keeps the other slot', () => {
    useCompare.getState().setSlot(1, h(5));
    expect(useCompare.getState().homes).toEqual([h(5)]);
    useCompare.getState().setSlot(1, h(6));
    expect(useCompare.getState().homes).toEqual([h(5), h(6)]);
    useCompare.getState().setSlot(0, h(7));
    expect(useCompare.getState().homes).toEqual([h(7), h(6)]);
  });

  it('keeps only the homes still listed', () => {
    useCompare.setState({ homes: [h(1), h(2)] });
    useCompare.getState().keepOnly([2]);
    expect(useCompare.getState().homes).toEqual([h(2)]);
  });

  it('is kept on the device', () => {
    expect(useCompare.persist.getOptions().name).toBe('maqar.compare');
  });
});
