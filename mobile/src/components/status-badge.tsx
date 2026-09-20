import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, StatusPalette, type StatusKey } from '@/constants/theme';

export function StatusBadge({ status, label }: { status: StatusKey; label: string }) {
  const palette = StatusPalette[status] ?? { bg: '#1f2937', border: '#374151', text: '#9ca3af' };

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <ThemedText type="smallBold" style={{ color: palette.text }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    alignSelf: 'flex-start',
  },
});
