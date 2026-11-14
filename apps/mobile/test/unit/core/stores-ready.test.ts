import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { useAppConfig } from '@/core/app-config/store';
import { useSettings } from '@/core/settings/store';
import { useStoresReady } from '@/core/storage/ready';

const getItem = AsyncStorage.getItem as jest.Mock;

// Phase 29 review: a saved store that cannot be read (a storage error, broken JSON) must not hold
// the app at the splash; the store keeps its defaults and the app opens.
describe('useStoresReady (the start-up gate)', () => {
  const realGetItem = getItem.getMockImplementation();
  afterEach(() => {
    getItem.mockImplementation(realGetItem);
  });

  /** Loads `store` again from storage that answers as given, and says whether the gate is open after. */
  async function readyAfter(store: { persist: { rehydrate: () => Promise<void> | void } }, answer: (name: string) => Promise<string | null>) {
    const { result, rerender } = await renderHook(() => useStoresReady());
    getItem.mockImplementation(answer);
    await act(async () => {
      await store.persist.rehydrate();
    });
    // Read the gate afresh: a failed load sends no change to listen for.
    await rerender({});
    return result.current;
  }

  it('opens once both stores have loaded', async () => {
    expect(await readyAfter(useAppConfig, async () => null)).toBe(true);
  });

  it.each([
    ['the app settings', useAppConfig],
    ['the language and theme', useSettings],
  ] as const)('opens when %s cannot be read', async (_what, store) => {
    expect(
      await readyAfter(store, async () => {
        throw new Error('storage is broken');
      }),
    ).toBe(true);
  });

  it('opens when the saved app settings are not valid JSON, keeping the defaults', async () => {
    expect(await readyAfter(useAppConfig, async () => '{not json')).toBe(true);
    expect(useAppConfig.getState().config.calculator.maxYears).toBeGreaterThan(0);
  });
});
