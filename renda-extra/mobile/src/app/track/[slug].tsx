import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useSetTrackStatus, useToggleStep, useTrack } from '@/lib/queries';
import { api, ApiError } from '@/lib/api';
import type { TrackStatus } from '@/lib/types';
import { Button, Card, Chip, ErrorBox, Icon, IconBubble, Loading, T } from '@/components/ui';
import { ProgressRing } from '@/components/charts';
import { STATUS } from '@/lib/status';
import { colors, font, radius, space } from '@/theme';

export default function TrackScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useTrack(slug);
  const toggle = useToggleStep(slug);
  const setStatus = useSetTrackStatus();
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorBox message={(q.error as Error)?.message ?? 'Erro ao carregar'} onRetry={() => q.refetch()} />;
  const t = q.data;
  const firstOpen = open ?? t.steps.find((s) => !s.done && !s.locked)?.id ?? null;

  async function changeStatus(status: TrackStatus) {
    setError(null);
    try {
      await setStatus.mutateAsync({ slug, status });
    } catch (e) {
      if (e instanceof ApiError && e.isPremium) router.push({ pathname: '/paywall', params: { reason: e.message } });
      else setError((e as Error).message);
    }
  }

  async function check(stepId: string, done: boolean) {
    Haptics.notificationAsync(done ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    try {
      await toggle.mutateAsync({ stepId, done });
      if (done) {
        const next = t.steps.find((s) => s.id !== stepId && !s.done && !s.locked);
        setOpen(next?.id ?? null);
      }
    } catch (e) {
      if (e instanceof ApiError && e.isPremium) router.push('/paywall');
      else setError((e as Error).message);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.topbar}>
        <Pressable hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/tracks'))} style={styles.roundBtn}>
          <Icon name="arrow-back" size={22} />
        </Pressable>
        <Pressable hitSlop={12} onPress={() => router.push({ pathname: '/opportunity/[slug]', params: { slug } })}>
          <T v="small" color={colors.brand} style={{ fontFamily: font.semibold }}>
            Ver detalhes
          </T>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space(4), backgroundColor: colors.brandDeep, borderColor: colors.brandDeep }}>
          <ProgressRing pct={t.progress.pct} size={88} stroke={9}>
            <T v="title" color={colors.white}>
              {t.progress.pct}%
            </T>
          </ProgressRing>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconBubble name={t.icon} color="#FDE68A" size={30} />
              <T v="caption" color="rgba(255,255,255,0.7)">
                Trilha
              </T>
            </View>
            <T v="h3" color={colors.white}>
              {t.title}
            </T>
            <T v="caption" color="rgba(255,255,255,0.75)">
              {t.progress.completed} de {t.progress.total} etapas concluídas
            </T>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {(['IN_PROGRESS', 'EARNING', 'PAUSED'] as TrackStatus[]).map((s) => (
            <Chip key={s} label={STATUS[s].label} icon={STATUS[s].icon} active={t.track?.status === s} onPress={() => changeStatus(s)} />
          ))}
        </View>
        {error && <ErrorBox message={error} />}

        <View style={{ gap: space(3) }}>
          {t.steps.map((s) => {
            const expanded = firstOpen === s.id;
            return (
              <View key={s.id} style={[styles.step, s.done && { borderColor: colors.brandSoft, backgroundColor: '#FBFEFC' }]}>
                <Pressable style={styles.stepHead} onPress={() => setOpen(expanded ? '' : s.id)}>
                  <Pressable
                    hitSlop={8}
                    disabled={s.locked}
                    onPress={() => check(s.id, !s.done)}
                    style={[styles.check, s.done && { backgroundColor: colors.brand, borderColor: colors.brand }, s.locked && { borderColor: colors.gold, backgroundColor: colors.goldSoft }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: s.done, disabled: s.locked }}
                  >
                    {s.done ? <Icon name="checkmark" size={16} color={colors.white} /> : s.locked ? <Icon name="lock-closed" size={13} color={colors.warning} /> : null}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <T v="caption" color={colors.textSoft}>
                      Etapa {s.order}
                      {s.locked ? ' · Premium' : ''}
                    </T>
                    <T v="title" color={s.done ? colors.textMuted : colors.text} style={s.done ? { textDecorationLine: 'line-through' } : null}>
                      {s.title}
                    </T>
                  </View>
                  <Icon name={expanded ? 'chevron-up' : 'chevron-down'} color={colors.textSoft} />
                </Pressable>
                {expanded && (
                  <View style={{ paddingLeft: 44, gap: space(3) }}>
                    {s.locked ? (
                      <View style={styles.locked}>
                        <T v="small" color={colors.textMuted}>
                          Esta etapa traz o conteúdo avançado: roteiros prontos, modelos e precificação.
                        </T>
                        <Button title="Desbloquear com Premium" icon="diamond" variant="dark" size="md" onPress={() => router.push('/paywall')} />
                      </View>
                    ) : (
                      <>
                        <T v="body" color={colors.text}>
                          {s.content}
                        </T>
                        {!s.done && <Button title="Marcar como feita" icon="checkmark" variant="secondary" size="md" onPress={() => check(s.id, true)} />}
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {t.platforms.length > 0 && (
          <Card style={{ gap: space(3) }}>
            <T v="h3">Atalhos</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
              {t.platforms.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  icon="open-outline"
                  onPress={async () => {
                    const { url } = await api<{ url: string }>(`/opportunities/platforms/${p.id}/click`, { method: 'POST' });
                    Linking.openURL(url);
                  }}
                />
              ))}
            </View>
          </Card>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Registrar ganho desta trilha" icon="add-circle" variant="gold" onPress={() => router.push({ pathname: '/earning-form', params: { slug, source: t.title } })} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space(5), paddingVertical: space(2), width: '100%', maxWidth: 720, alignSelf: 'center' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  content: { padding: space(5), paddingTop: space(2), gap: space(4), paddingBottom: space(10), width: '100%', maxWidth: 720, alignSelf: 'center' },
  step: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space(4), gap: space(3) },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  check: { width: 30, height: 30, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  locked: { gap: space(3), padding: space(4), borderRadius: radius.md, backgroundColor: colors.goldSoft },
  footer: { padding: space(4), paddingHorizontal: space(5), borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
});
