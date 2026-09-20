import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

export function BrandLogo({ size = 64 }: { size?: number }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Ionicons name="flame" size={size * 0.5} color={Colors.gold} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.xl,
    shadowColor: Colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
