import { act, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';
import { ErrorText } from '@/components/error-text';
import { Skeleton } from '@/components/skeleton';
import { SuccessCheck } from '@/components/success-check';
import { CardSkeleton } from '@/features/listings/components/list-states';
import { renderWithProviders } from '../../utils/render';

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

// 2026-11-16 motion pass: loading shimmers, a wrong answer shakes, a success draws its tick.
describe('Loading blocks', () => {
  it('shimmer while content loads', async () => {
    await renderWithProviders(<CardSkeleton />);
    expect(screen.getAllByTestId('shimmer', { includeHiddenElements: true }).length).toBeGreaterThan(0);
  });

  it('stay still when the phone asks for less motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderWithProviders(<Skeleton style={{ height: 10 }} />);
    await act(async () => {});
    expect(screen.queryByTestId('shimmer', { includeHiddenElements: true })).toBeNull();
  });
});

describe('ErrorText', () => {
  it('buzzes once for each new message, not on every render', async () => {
    const { rerender } = await renderWithProviders(<ErrorText message="The code is wrong" />);
    expect(screen.getByText('The code is wrong')).toBeOnTheScreen();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);

    await rerender(<ErrorText message="The code is wrong" />);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);

    await rerender(<ErrorText message="Too many tries" />);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(2);
  });

  it('shows nothing without a message', async () => {
    await renderWithProviders(<ErrorText message={undefined} />);
    expect(screen.queryByTestId('error-text')).toBeNull();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('is announced to screen readers', async () => {
    await renderWithProviders(<ErrorText message="Wrong" />);
    expect(screen.getByTestId('error-text').props.accessibilityLiveRegion).toBe('polite');
  });
});

describe('SuccessCheck', () => {
  it('draws a tick and buzzes success once', async () => {
    await renderWithProviders(<SuccessCheck />);
    expect(screen.getByTestId('success-check', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorText on a second try', () => {
  it('buzzes again when the same error comes back from a new attempt', async () => {
    const { rerender } = await renderWithProviders(<ErrorText message="Wrong password" trigger={1} />);
    await rerender(<ErrorText message="Wrong password" trigger={2} />);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(2);
  });
});
