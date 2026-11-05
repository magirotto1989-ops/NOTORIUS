import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Loading } from '@/components/ui';

export default function Gate() {
  const { ready, user } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/welcome" />;
  if (!user.hasProfile) return <Redirect href="/quiz" />;
  return <Redirect href="/home" />;
}
