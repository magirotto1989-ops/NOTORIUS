import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function AuthLayout() {
  const { ready, user } = useAuth();
  if (ready && user) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
