import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/context/auth-context';

export default function AuthLayout() {
  const { user, isLoading } = useAuth();

  if (!isLoading && user) {
    return <Redirect href="/(tabs)/mesas" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
