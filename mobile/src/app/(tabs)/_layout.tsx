import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { HeaderLogoutButton } from '@/components/header-logout-button';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

export default function TabsLayout() {
  const { user, isLoading } = useAuth();

  if (!isLoading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.black },
        headerTitleStyle: { fontFamily: Fonts.displaySemiBold },
        headerTintColor: Colors.white,
        headerShadowVisible: false,
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.muted,
        tabBarStyle: { backgroundColor: Colors.black, borderTopColor: Colors.border },
        headerRight: () => <HeaderLogoutButton />,
      }}>
      <Tabs.Screen
        name="mesas"
        options={{
          title: 'Mesas',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="pedidos"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="cozinha"
        options={{
          title: 'Cozinha',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="fila"
        options={{
          title: 'Fila',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="caixa"
        options={{
          title: 'Caixa',
          tabBarIcon: ({ color, size }) => <Ionicons name="cash-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
