import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '@/core/settings/store';

describe('settings store', () => {
  it('starts in Arabic, and keeps the chosen language and theme after a restart', async () => {
    await AsyncStorage.clear();
    useSettings.setState(useSettings.getInitialState());
    expect(useSettings.getState().lang).toBe('ar');

    useSettings.getState().setLang('en');
    useSettings.getState().setTheme('dark');
    const saved = await AsyncStorage.getItem('maqar.settings');

    // Restart: memory is back to the defaults, and only what was saved on the phone remains.
    useSettings.setState(useSettings.getInitialState());
    await AsyncStorage.setItem('maqar.settings', saved!);
    await useSettings.persist.rehydrate();

    expect(useSettings.getState()).toMatchObject({ lang: 'en', theme: 'dark' });
  });
});
