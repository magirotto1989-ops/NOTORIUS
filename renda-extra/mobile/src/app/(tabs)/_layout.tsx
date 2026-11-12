import { Platform } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Icon, Loading } from '@/components/ui';
import { colors, font } from '@/theme';

const TABS = [
  { name: 'home', title: 'Início', icon: 'home' },
  { name: 'explore', title: 'Explorar', icon: 'compass' },
  { name: 'tracks', title: 'Trilhas', icon: 'map' },
  { name: 'earnings', title: 'Ganhos', icon: 'wallet' },
  { name: 'profile', title: 'Perfil', icon: 'person' },
] as const;

export default function TabsLayout() {
  const { ready, user } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/welcome" />;
  if (!user.hasProfile) return <Redirect href="/quiz" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSoft,
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: Platform.OS === 'web' ? 64 : undefined,
          paddingTop: 6,
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused }) => <Icon name={focused ? t.icon : `${t.icon}-outline`} color={String(color)} size={23} />,
          }}
        />
      ))}
    </Tabs>
  );
}
