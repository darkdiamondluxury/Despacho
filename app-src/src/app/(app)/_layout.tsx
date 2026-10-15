import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { C } from '@/ui/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) =>
  <Ionicons name={name} color={color as string} size={size} />;

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.green },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: C.grey,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: C.line },
        sceneStyle: { backgroundColor: C.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="servicos" options={{ title: 'Serviços', tabBarIcon: icon('list-outline') }} />
      <Tabs.Screen name="frota" options={{ title: 'Frota', tabBarIcon: icon('car-sport-outline') }} />
    </Tabs>
  );
}
