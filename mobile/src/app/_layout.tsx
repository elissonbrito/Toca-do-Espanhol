import { DMSans_300Light, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { useFonts } from 'expo-font';
import { Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AuthProvider } from '@/context/auth-context';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

const NavigationTheme: Theme = {
  dark: true,
  colors: {
    primary: Colors.gold,
    background: Colors.black,
    card: Colors.black,
    text: Colors.white,
    border: Colors.border,
    notification: Colors.red,
  },
  fonts: {
    regular: { fontFamily: 'DMSans_400Regular', fontWeight: '400' },
    medium: { fontFamily: 'DMSans_500Medium', fontWeight: '500' },
    bold: { fontFamily: 'DMSans_600SemiBold', fontWeight: '600' },
    heavy: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '700' },
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_400Regular,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={NavigationTheme}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </ThemeProvider>
  );
}
