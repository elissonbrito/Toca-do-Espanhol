import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

type Variant = 'primary' | 'gold' | 'ghost' | 'danger';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AppButton({ label, onPress, variant = 'primary', disabled, loading, style }: AppButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.base, variantStyles[variant], isDisabled && styles.disabled, style]}>
      {loading ? (
        <ActivityIndicator color={variant === 'gold' ? Colors.black : Colors.white} size="small" />
      ) : (
        <ThemedText type="smallBold" style={{ color: variant === 'gold' ? Colors.black : textColor[variant] }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const textColor: Record<Variant, string> = {
  primary: Colors.white,
  gold: Colors.black,
  ghost: Colors.muted,
  danger: Colors.white,
};

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.two + 4,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: Colors.red },
  gold: { backgroundColor: Colors.gold },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  danger: { backgroundColor: '#7f1d1d' },
});
