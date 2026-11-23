// A stand-in for expo-router in screen tests. Use with:
//   jest.mock('expo-router', () => require('<path>/utils/router').expoRouterMock);
// and assert on `mockRouter.replace` / `mockRouter.push`.

export const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };

export const expoRouterMock = {
  router: mockRouter,
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children: unknown }) => children,
  Redirect: () => null,
  Stack: { Screen: () => null },
  // Screens in tests are always focused.
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
};
