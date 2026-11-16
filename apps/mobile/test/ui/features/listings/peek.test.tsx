import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { propertyKey, takeOrigin } from '@/core/motion/card-origin';
import { closePeek, openPeek, PeekHost } from '@/features/listings/components/peek';
import { useCompare } from '@/features/compare/store/compare.store';
import { makeCard } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const card = makeCard({ id: 7 });
const rect = { x: 16, y: 300, width: 358, height: 380 };

beforeEach(async () => {
  jest.clearAllMocks();
  await act(() => closePeek());
  useCompare.setState({ homes: [] });
});

// 2026-11-16: holding a card lifts it into a preview with quick actions.
describe('The long-press preview', () => {
  it('shows the home with Save, Compare and Share', async () => {
    await renderWithProviders(<PeekHost />, { lang: 'en' });
    expect(screen.queryByTestId('peek')).toBeNull();

    await act(() => openPeek(card, rect));
    expect(screen.getByTestId('peek')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save home' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Compare' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Share' })).toBeOnTheScreen();
  });

  it('shares the listing, and adds it to compare', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await renderWithProviders(<PeekHost />, { lang: 'en' });

    await act(() => openPeek(card, rect));
    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('maqar://property/7') }));

    await act(() => openPeek(card, rect));
    await fireEvent.press(screen.getByRole('button', { name: 'Compare' }));
    expect(useCompare.getState().homes.map((h) => h.id)).toEqual([7]);
  });

  it('opens the listing from the preview, which the page then grows from', async () => {
    await renderWithProviders(<PeekHost />, { lang: 'en' });
    await act(() => openPeek(card, rect));

    await fireEvent.press(screen.getByRole('button', { name: card.titleEn }));
    expect(mockRouter.push).toHaveBeenCalledWith('/property/7');
    expect(screen.queryByTestId('peek')).toBeNull();
    // It grows from where the preview settled, not from the card in the list.
    expect(takeOrigin(propertyKey(7))?.rect).not.toEqual(rect);
  });

  it('is put down with a tap outside it', async () => {
    await renderWithProviders(<PeekHost />, { lang: 'en' });
    await act(() => openPeek(card, rect));

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByTestId('peek')).toBeNull());
  });
});
