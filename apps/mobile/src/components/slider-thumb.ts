import { Platform, type ViewStyle } from 'react-native';

/**
 * How a slider's thumb shares touches with the scrolling page around it. A gesture is the thumb's
 * only if it starts there. On a phone the thumb then keeps it. The web cannot stop a scroll that has
 * begun, so there the browser is told not to pan from the thumb, and any other scroll is let through.
 */
export const thumbResponder = {
  onStartShouldSetResponder: () => true,
  onResponderTerminationRequest: () => Platform.OS === 'web',
};

/** `touchAction` exists only on the web, and React Native's types do not list it. */
export const thumbStyle = (): ViewStyle => (Platform.OS === 'web' ? ({ touchAction: 'none' } as ViewStyle) : {});
