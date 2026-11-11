import { KeyboardAvoidingView, type KeyboardAvoidingViewProps, StyleSheet } from 'react-native';

/**
 * Keeps the focused field above the keyboard, on both platforms. The app draws edge to edge on
 * Android, where the window no longer shrinks for the keyboard, so Android needs the padding too
 * (without it the chat box and the note fields stayed hidden behind the keyboard on a phone).
 * The padding is only the part of this view the keyboard covers, so it never doubles up.
 */
export function KeyboardAvoiding({ style, ...props }: KeyboardAvoidingViewProps) {
  return <KeyboardAvoidingView behavior="padding" style={[styles.fill, style]} {...props} />;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
