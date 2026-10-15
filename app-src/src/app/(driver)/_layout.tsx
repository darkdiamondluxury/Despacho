import { Stack } from 'expo-router';

import { C } from '@/ui/theme';

export default function DriverLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.green },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: C.bg },
      }}>
      <Stack.Screen name="meus" options={{ title: 'Os meus serviços' }} />
    </Stack>
  );
}
