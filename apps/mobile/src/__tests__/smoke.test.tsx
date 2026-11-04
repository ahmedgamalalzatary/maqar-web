import { render, screen } from '@testing-library/react-native';
import Index from '@/app/index';

// Proves the test setup works: Jest, the Expo preset, path aliases and UI rendering.
test('renders the home screen', async () => {
  await render(<Index />);
  expect(screen.getByText(/Edit src\/app\/index.tsx/)).toBeTruthy();
});
