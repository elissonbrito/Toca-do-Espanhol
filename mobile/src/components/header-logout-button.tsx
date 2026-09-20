import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

export function HeaderLogoutButton() {
  const { signOut } = useAuth();

  return (
    <Pressable onPress={() => signOut()} hitSlop={12} style={{ paddingHorizontal: 8 }}>
      <Ionicons name="log-out-outline" size={22} color={Colors.muted} />
    </Pressable>
  );
}
