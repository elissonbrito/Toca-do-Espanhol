import { Stack } from 'expo-router';

import { HeaderLogoutButton } from '@/components/header-logout-button';
import { Colors, Fonts } from '@/constants/theme';

export default function PedidosLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.black },
        headerTitleStyle: { fontFamily: Fonts.displaySemiBold },
        headerTintColor: Colors.white,
        headerShadowVisible: false,
        headerRight: () => <HeaderLogoutButton />,
      }}>
      <Stack.Screen name="index" options={{ title: 'Pedidos' }} />
      <Stack.Screen name="[id]" options={{ title: 'Comanda', headerRight: () => null }} />
    </Stack>
  );
}
