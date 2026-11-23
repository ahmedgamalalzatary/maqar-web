import { type AppSettings, DEFAULT_APP_SETTINGS } from '@mqr/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { useAppConfig } from '@/core/app-config/store';
import { ContactScreen } from '@/features/account/screens/contact-screen';
import { jsonResponse, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const empty = { email: '', phone: '', whatsapp: '', facebook: '', instagram: '', tiktok: '' };
const withContact = (contact: AppSettings['contact']): AppSettings => ({ ...DEFAULT_APP_SETTINGS, contact });

/** The server answers these settings. */
const serve = (settings: AppSettings) => mockFetch().mockResolvedValue(jsonResponse(200, settings));

beforeEach(() => {
  jest.clearAllMocks();
  useAppConfig.setState({ config: DEFAULT_APP_SETTINGS });
});

// Contact us (owner, 2026-11-14): what the admin fills in, for clients and guests.
describe('Contact us', () => {
  it('shows only the details the admin filled in, and each one opens', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const settings = withContact({ ...empty, email: 'info@mqr.app', phone: '01012345678', whatsapp: '01012345678', facebook: 'https://facebook.com/mqr' });
    useAppConfig.setState({ config: settings });
    serve(settings);
    await renderWithProviders(<ContactScreen />);

    expect(screen.getByText('info@mqr.app')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'الإيميل: info@mqr.app' }));
    expect(open).toHaveBeenLastCalledWith('mailto:info@mqr.app');
    await fireEvent.press(screen.getByRole('link', { name: 'رقم التليفون: 01012345678' }));
    expect(open).toHaveBeenLastCalledWith('tel:01012345678');
    await fireEvent.press(screen.getByRole('link', { name: 'فيسبوك' }));
    expect(open).toHaveBeenLastCalledWith('https://facebook.com/mqr');
    await fireEvent.press(screen.getByRole('button', { name: 'تواصل بالواتساب' }));
    expect(open).toHaveBeenLastCalledWith('https://wa.me/201012345678');
    expect(screen.queryByRole('link', { name: 'إنستجرام' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'تيك توك' })).toBeNull();
  });

  it('asks the server for the latest details when it opens', async () => {
    serve(withContact({ ...empty, email: 'new@mqr.app' }));
    await renderWithProviders(<ContactScreen />);
    expect(await screen.findByText('new@mqr.app')).toBeOnTheScreen();
    expect(screen.queryByText('maqarcompany1@gmail.com')).toBeNull();
  });

  it('says so when there is nothing to show', async () => {
    useAppConfig.setState({ config: withContact(empty) });
    serve(withContact(empty));
    await renderWithProviders(<ContactScreen />);
    expect(screen.getByText('لسه مفيش بيانات تواصل.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'تواصل بالواتساب' })).toBeNull();
  });
});
