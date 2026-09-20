import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </ThemedView>
    );
  }

  return <Redirect href={user ? '/(tabs)/mesas' : '/(auth)/login'} />;
}
