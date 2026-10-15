// Raiz da app: decide que ecrãs se podem ver conforme o estado do login.
//  - sem sessão           -> só o login
//  - sessão sem empresa   -> criar empresa
//  - sessão com empresa   -> a app
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth';
import { C } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { ready, session, profile } = useAuth();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.green} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !profile}>
        <Stack.Screen name="empresa" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !!profile && profile.role === 'driver'}>
        <Stack.Screen name="(driver)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !!profile && profile.role !== 'driver'}>
        <Stack.Screen name="(app)" />
        <Stack.Screen
          name="servico/novo"
          options={{ headerShown: true, title: 'Novo serviço', presentation: 'modal', headerTintColor: C.green }}
        />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
