import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Bubble } from '@/features/chat/components/bubble';
import { renderWithProviders } from '../../../utils/render';
import { msg, thread } from './fixtures';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const colourOf = (text: string) => StyleSheet.flatten(screen.getByText(text, { exact: false }).props.style).color as string;
const noop = () => {};

describe('My own bubble in dark mode (cream, with dark text)', () => {
  // Found on the phone: faded text and buttons on my bubble were white, so they vanished on cream.
  it('shows the booking card’s time and the lead-page button in the bubble’s dark text, never white', async () => {
    const card = msg('agent', { kind: 'booking', viewingId: 5, date: '2026-11-11', time: '11:00' });
    await renderWithProviders(<Bubble m={card} thread={thread({ leadId: 3 })} side="agent" tail={false} onBook={noop} onImage={noop} booking={null} />, { theme: 'dark' });
    const dark = /^rgba\(3, ?15, ?27/;
    expect(colourOf('١١:٠٠')).toMatch(dark);
    expect(colourOf('صفحة العميل')).toBe('#030f1b');
  });
});
