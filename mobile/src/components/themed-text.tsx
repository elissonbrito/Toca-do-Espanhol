import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, type ColorToken, Fonts } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'pageTitle' | 'title' | 'subtitle' | 'small' | 'smallBold' | 'label' | 'link';
  color?: ColorToken;
};

export function ThemedText({ style, type = 'default', color, ...rest }: ThemedTextProps) {
  return (
    <Text
      style={[
        { color: Colors[color ?? 'white'] },
        type === 'default' && styles.default,
        type === 'pageTitle' && styles.pageTitle,
        type === 'title' && styles.title,
        type === 'subtitle' && styles.subtitle,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'label' && styles.label,
        type === 'link' && styles.link,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
  },
  // Equivalente ao ".page-title" (font-display text-2xl font-bold) do CSS original.
  pageTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 24,
    lineHeight: 30,
  },
  title: {
    fontFamily: Fonts.displayBold,
    fontSize: 30,
    lineHeight: 36,
  },
  subtitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 20,
    lineHeight: 26,
  },
  small: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 16,
  },
  smallBold: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  // Equivalente ao ".label" (text-sm font-medium text-brand-muted).
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  link: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.gold,
  },
});
