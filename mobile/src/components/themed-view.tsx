import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, type ColorToken, Radius } from '@/constants/theme';

export type ThemedViewProps = ViewProps & {
  background?: ColorToken;
  /** Aplica o estilo ".card" do frontend original: fundo, borda e cantos arredondados. */
  card?: boolean;
};

export function ThemedView({ style, background, card, ...otherProps }: ThemedViewProps) {
  return (
    <View
      style={[
        { backgroundColor: Colors[background ?? 'black'] },
        card && styles.card,
        style,
      ]}
      {...otherProps}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
  },
});
