import { Platform, type ViewStyle } from 'react-native';

/**
 * How a slider's thumb shares touches with the scrolling page around it. A gesture is the thumb's
 * only if it starts there. On a phone the thumb then keeps it. The web cannot stop a scroll that has
 * begun, so there the browser is told not to pan from the thumb, and any other scroll is let through.
 * The platform is a parameter so tests can be explicit (jest cannot fake Platform.OS reliably).
 */
export const thumbResponder = (os: string = Platform.OS) => ({
  onStartShouldSetResponder: () => true,
  onResponderTerminationRequest: () => os === 'web',
});

/** `touchAction` exists only on the web, and React Native's types do not list it. */
export const thumbStyle = (os: string = Platform.OS): ViewStyle => (os === 'web' ? ({ touchAction: 'none' } as ViewStyle) : {});
