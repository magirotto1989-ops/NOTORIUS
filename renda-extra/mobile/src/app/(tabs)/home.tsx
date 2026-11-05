import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { useEarningsSummary, useMeta, useRecommended, useTracks } from '@/lib/queries';
import { firstName, greeting, money, monthLong, thisMonth } from '@/lib/format';
import { Button, Card, ErrorBox, Icon, IconBubble, Pill, ProgressBar, SectionHeader, T } from '@/components/ui';
import { ProgressRing } from '@/components/charts';
import { OpportunityCard } from '@/components/OpportunityCard';
import { PremiumBanner } from '@/components/PremiumBanner';
import { colors, font, gradients, radius, space } from '@/theme';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const month = thisMonth();
  const summary = useEarningsSummary(month);
  const rec = useRecommended(true, 5);
  const tracks = useTracks();
  const meta = useMeta();

  const active = tracks.data?.items.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'EARNING') ?? [];
  const s = summary.data;
  const refreshing = summary.isRefetching || rec.isRefetching;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: space(16) }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            summary.refetch();
            rec.refetch();
            tracks.refetch();
          }}
        />
      }
    >
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + space(5) }]}>
        <View style={styles.inner}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <T v="small" color="rgba(255,255,255,0.7)">
                {greeting()},
              </T>
              <T v="h2" color={colors.white}>
                {user ? firstName(user.name) : ''} 👋
              </T>
            </View>
            {user?.plan === 'PREMIUM' ? (
              <Pill label="Premium" icon="diamond" bg="rgba(253,230,138,0.18)" fg="#FDE68A" />
            ) : (
              <Pressable onPress={() => router.push('/paywall')}>
                <Pill label="Seja Premium" icon="diamond-outline" bg="rgba(255,255,255,0.12)" fg={colors.white} />
              </Pressable>
            )}
          </View>

          <View style={styles.monthCard}>
            <ProgressRing pct={s?.goalPct ?? 0} size={112} stroke={11}>
              <T v="h3" color={colors.white}>
                {s ? `${Math.min(s.goalPct, 999)}%` : '–'}
              </T>
              <T v="caption" color="rgba(255,255,255,0.7)">
                da meta
              </T>
            </ProgressRing>
            <View style={{ flex: 1, gap: 4 }}>
              <T v="label" color="rgba(255,255,255,0.65)">
                {monthLong(month)}
              </T>
              <T v="number" color={colors.white} style={{ fontSize: 30 }}>
                {money(s?.total ?? 0)}
              </T>
              <T v="small" color="rgba(255,255,255,0.75)">
                Meta: {money(s?.goal ?? user?.monthlyGoal ?? 0)}
              </T>
              {s?.projection ? (
                <T v="caption" color="#FDE68A">
                  No ritmo atual: ~{money(s.projection)} no mês
                </T>
              ) : null}
            </View>
          </View>
          <Button title="Registrar ganho" icon="add-circle" variant="gold" size="md" onPress={() => router.push('/earning-form')} />
        </View>
      </LinearGradient>

      <View style={[styles.inner, { padding: space(5), gap: space(4) }]}>
        {active.length > 0 && (
          <>
            <SectionHeader title="Continue de onde parou" action="Ver trilhas" onAction={() => router.push('/tracks')} />
            {active.slice(0, 2).map((t) => (
              <Card key={t.slug} onPress={() => router.push({ pathname: '/track/[slug]', params: { slug: t.slug } })} style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <IconBubble name={t.icon} color={t.color} size={42} />
                  <View style={{ flex: 1 }}>
                    <T v="title" numberOfLines={1}>
                      {t.title}
                    </T>
                    <T v="caption" color={colors.textMuted}>
                      {t.status === 'EARNING' ? 'Já faturando 💰' : `${t.progress.completed} de ${t.progress.total} etapas`}
                    </T>
                  </View>
                  <Icon name="chevron-forward" color={colors.textSoft} />
                </View>
                <ProgressBar pct={t.progress.pct} color={t.color} track={t.color + '22'} />
              </Card>
            ))}
          </>
        )}

        <SectionHeader title="Feitas para você" action="Ver todas" onAction={() => router.push('/explore')} />
        {rec.error ? <ErrorBox message={(rec.error as Error).message} onRetry={() => rec.refetch()} /> : null}
        {rec.data?.items.length === 0 && (
          <Card style={{ gap: 8 }}>
            <T v="title">Nenhuma oportunidade 100% compatível ainda</T>
            <T v="small" color={colors.textMuted}>
              Tente ajustar suas respostas (ex.: aceitar trabalho presencial ou um pequeno investimento).
            </T>
            <Button title="Refazer quiz" variant="secondary" size="md" onPress={() => router.push('/quiz')} />
          </Card>
        )}
        {rec.data?.items.map((o) => <OpportunityCard key={o.id} o={o} compact />)}

        <SectionHeader title="Explore por categoria" />
        <View style={styles.cats}>
          {meta.data &&
            Object.entries(meta.data.categories).map(([k, c]) => (
              <Pressable key={k} style={styles.cat} onPress={() => router.push({ pathname: '/explore', params: { category: k } })}>
                <Icon name={c.icon} size={22} color={colors.brand} />
                <T v="caption" style={{ fontFamily: font.semibold, textAlign: 'center' }} numberOfLines={2}>
                  {c.label}
                </T>
              </Pressable>
            ))}
        </View>

        {user?.plan !== 'PREMIUM' && <PremiumBanner />}

        <T v="caption" color={colors.textSoft} style={{ textAlign: 'center', marginTop: space(2) }}>
          {meta.data?.disclaimer}
        </T>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: space(5), paddingBottom: space(6), borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  inner: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: space(5) },
  monthCard: { flexDirection: 'row', alignItems: 'center', gap: space(5), padding: space(4), borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.08)' },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  cat: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    alignItems: 'center',
    gap: 6,
    paddingVertical: space(4),
    paddingHorizontal: space(2),
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
