import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useMeta, useTracks } from '@/lib/queries';
import type { TrackListItem } from '@/lib/types';
import { STATUS } from '@/lib/status';
import { Card, EmptyState, ErrorBox, Icon, IconBubble, Loading, Pill, ProgressBar, Screen, SectionHeader, T } from '@/components/ui';
import { colors, space } from '@/theme';


export default function Tracks() {
  const q = useTracks();
  const meta = useMeta();
  const { user } = useAuth();
  if (q.isLoading) return <Loading />;

  const items = q.data?.items ?? [];
  const active = items.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'EARNING');
  const other = items.filter((t) => t.status === 'SAVED' || t.status === 'PAUSED');
  const limit = meta.data?.freeLimits.activeTracks ?? 2;

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />} contentStyle={{ maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <View style={{ gap: 2 }}>
        <T v="h1">Minhas trilhas</T>
        <T v="body" color={colors.textMuted}>
          Do zero ao primeiro pagamento, um passo de cada vez.
        </T>
      </View>
      {q.error ? <ErrorBox message={(q.error as Error).message} onRetry={() => q.refetch()} /> : null}

      {user?.plan !== 'PREMIUM' && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }} onPress={() => router.push('/paywall')}>
          <Icon name="diamond-outline" color={colors.accent} />
          <T v="small" style={{ flex: 1 }}>
            Plano grátis: {active.length}/{limit} trilhas ativas. Premium libera ilimitadas.
          </T>
          <Icon name="chevron-forward" color={colors.textSoft} />
        </Card>
      )}

      {items.length === 0 && (
        <EmptyState
          icon="map-outline"
          title="Nenhuma trilha ainda"
          text="Escolha uma oportunidade e toque em “Começar trilha” para receber o passo a passo."
          action="Ver recomendações"
          onAction={() => router.push('/explore')}
        />
      )}

      {active.length > 0 && <SectionHeader title="Ativas" />}
      {active.map((t) => (
        <TrackCard key={t.slug} t={t} />
      ))}
      {other.length > 0 && <SectionHeader title="Salvas e pausadas" />}
      {other.map((t) => (
        <TrackCard key={t.slug} t={t} />
      ))}
    </Screen>
  );
}

function TrackCard({ t }: { t: TrackListItem }) {
  const s = STATUS[t.status];
  return (
    <Card onPress={() => router.push({ pathname: '/track/[slug]', params: { slug: t.slug } })} style={{ gap: space(3) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <IconBubble name={t.icon} color={t.color} />
        <View style={{ flex: 1, gap: 4 }}>
          <T v="title" numberOfLines={1}>
            {t.title}
          </T>
          <Pill label={s.label} icon={s.icon} bg={s.bg} fg={s.fg} />
        </View>
        <T v="h3" color={t.color}>
          {t.progress.pct}%
        </T>
      </View>
      <ProgressBar pct={t.progress.pct} color={t.color} track={t.color + '22'} />
      <T v="caption" color={colors.textMuted}>
        {t.progress.completed} de {t.progress.total} etapas concluídas
      </T>
    </Card>
  );
}
