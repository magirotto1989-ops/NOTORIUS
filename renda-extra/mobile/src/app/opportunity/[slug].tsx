import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMeta, useOpportunity, useSetTrackStatus } from '@/lib/queries';
import { api, ApiError } from '@/lib/api';
import { moneyIn, money, payDays, range } from '@/lib/format';
import { Button, Card, ErrorBox, Icon, IconBubble, Loading, Pill, T } from '@/components/ui';
import { MatchBadge, modeLabel } from '@/components/OpportunityCard';
import { colors, font, radius, space } from '@/theme';

export default function OpportunityScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useOpportunity(slug);
  const meta = useMeta();
  const setStatus = useSetTrackStatus();
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data)
    return (
      <SafeAreaView style={{ flex: 1, padding: space(5), backgroundColor: colors.bg }}>
        <ErrorBox message={(q.error as Error)?.message ?? 'Não encontrado'} onRetry={() => q.refetch()} />
      </SafeAreaView>
    );

  const o = q.data;
  const saved = Boolean(o.track);
  const started = o.track && o.track.status !== 'SAVED';
  const labelOf = (k: string) =>
    k
      .split('|')
      .map((x) => meta.data?.assets[x]?.label ?? meta.data?.skills[x]?.label ?? x)
      .join(' ou ');

  async function start() {
    setError(null);
    try {
      if (!started) await setStatus.mutateAsync({ slug, status: 'IN_PROGRESS' });
      router.push({ pathname: '/track/[slug]', params: { slug } });
    } catch (e) {
      if (e instanceof ApiError && e.isPremium) router.push({ pathname: '/paywall', params: { reason: e.message } });
      else setError((e as Error).message);
    }
  }

  async function openPlatform(id: string) {
    setOpening(id);
    try {
      const { url } = await api<{ url: string }>(`/opportunities/platforms/${id}/click`, { method: 'POST' });
      await Linking.openURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(null);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.topbar}>
        <Pressable hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} style={styles.roundBtn}>
          <Icon name="arrow-back" size={22} />
        </Pressable>
        <Pressable
          hitSlop={12}
          style={styles.roundBtn}
          accessibilityLabel={saved ? 'Remover dos salvos' : 'Salvar'}
          onPress={() => setStatus.mutate({ slug, status: saved ? null : 'SAVED' })}
        >
          <Icon name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={saved ? colors.brand : colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ gap: space(3) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <IconBubble name={o.icon} color={o.color} size={60} />
            {o.match && <MatchBadge score={o.match.score} eligible={o.match.eligible} size="lg" />}
          </View>
          <T v="h1">{o.title}</T>
          <T v="body" color={colors.textMuted} style={{ fontSize: 17 }}>
            {o.tagline}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Pill label={modeLabel[o.mode]} icon="location" bg="#F1F5F3" fg={colors.textMuted} />
            <Pill label={meta.data?.categories[o.category]?.label ?? o.category} icon="pricetag" bg="#F1F5F3" fg={colors.textMuted} />
            {o.currency === 'USD' && <Pill label="Paga em dólar" icon="logo-usd" bg={colors.dollarSoft} fg={colors.dollar} />}
            {o.region === 'GLOBAL' && <Pill label="Clientes do mundo todo" icon="globe" bg={colors.dollarSoft} fg={colors.dollar} />}
          </View>
        </View>

        {o.match && (
          <Card style={{ gap: 10, backgroundColor: o.match.eligible ? colors.brandTint : colors.warningSoft, borderColor: 'transparent' }}>
            <T v="title">{o.match.eligible ? 'Por que combina com você' : 'O que impede por agora'}</T>
            {(o.match.eligible ? o.match.reasons : o.match.blockers).map((r) => (
              <View key={r} style={{ flexDirection: 'row', gap: 8 }}>
                <Icon name={o.match!.eligible ? 'checkmark-circle' : 'alert-circle'} size={18} color={o.match!.eligible ? colors.brand : colors.warning} />
                <T v="small" style={{ flex: 1 }}>
                  {r}
                </T>
              </View>
            ))}
          </Card>
        )}

        <View style={styles.grid}>
          <Metric icon="cash-outline" label="Ganho por hora" value={range(o.hourly.min, o.hourly.max, (n) => moneyIn(n, o.currency))} sub={o.currency === 'USD' ? `≈ ${range(o.hourlyBRL.min, o.hourlyBRL.max)}` : undefined} />
          <Metric icon="calendar-outline" label="Estimativa mensal" value={range(o.estMonthlyBRL.min, o.estMonthlyBRL.max)} sub={o.match ? 'com as suas horas' : 'com 10h/semana'} />
          <Metric icon="wallet-outline" label="Para começar" value={o.startupCostBRL ? `~${money(o.startupCostBRL)}` : 'R$ 0'} />
          <Metric icon="time-outline" label="1º pagamento" value={payDays(o.daysToFirstPay)} />
          <Metric icon="speedometer-outline" label="Dificuldade" value={<Dots n={o.difficulty} />} />
          <Metric icon="shuffle-outline" label="Flexibilidade" value={<Dots n={o.flexibility} color={colors.accent} />} />
        </View>
        <T v="caption" color={colors.textMuted}>
          {o.earningsNote}
        </T>

        <Section title="Como funciona">
          <T v="body" color={colors.text}>
            {o.description}
          </T>
          {(o.requiredAssets.length > 0 || o.minEnglish > 0) && (
            <View style={{ gap: 6, marginTop: 4 }}>
              <T v="label" color={colors.textMuted}>
                Requisitos
              </T>
              {o.requiredAssets.map((a) => (
                <Bullet key={a} icon="checkmark" text={labelOf(a)} />
              ))}
              {o.minEnglish > 0 && <Bullet icon="language" text={`Inglês ${meta.data?.englishLevels[o.minEnglish]?.toLowerCase() ?? ''} ou melhor`} />}
            </View>
          )}
        </Section>

        <Section title="Onde começar">
          <View style={styles.verified}>
            <Icon name="shield-checkmark" size={16} color={colors.brand} />
            <T v="caption" color={colors.brandDark} style={{ flex: 1 }}>
              Plataformas verificadas em {new Date(o.reviewedAt).toLocaleDateString('pt-BR')}: funcionamento, aceitação de brasileiros e reputação no Reclame Aqui.
            </T>
          </View>
          {o.platforms.map((p) => (
            <View key={p.id} style={styles.platform}>
              <View style={{ flex: 1 }}>
                <T v="title">{p.name}</T>
                <T v="caption" color={colors.textMuted}>
                  {p.description ?? p.host}
                </T>
                {p.caution && (
                  <View style={styles.caution}>
                    <Icon name="warning" size={13} color={colors.warning} style={{ marginTop: 1 }} />
                    <T v="caption" color={colors.warning} style={{ flex: 1 }}>
                      {p.caution}
                    </T>
                  </View>
                )}
              </View>
              <Button title="Acessar" size="sm" variant="secondary" iconRight="open-outline" loading={opening === p.id} onPress={() => openPlatform(p.id)} />
            </View>
          ))}
        </Section>

        <View style={{ flexDirection: 'row', gap: space(3), flexWrap: 'wrap' }}>
          <Card style={{ flex: 1, minWidth: 260, gap: 8 }}>
            <T v="title" color={colors.brandDark}>
              👍 Vantagens
            </T>
            {o.pros.map((p) => (
              <Bullet key={p} icon="add" color={colors.brand} text={p} />
            ))}
          </Card>
          <Card style={{ flex: 1, minWidth: 260, gap: 8 }}>
            <T v="title" color={colors.danger}>
              👎 Desvantagens
            </T>
            {o.cons.map((p) => (
              <Bullet key={p} icon="remove" color={colors.danger} text={p} />
            ))}
          </Card>
        </View>

        {o.warnings.length > 0 && (
          <Card style={{ gap: 8, backgroundColor: colors.warningSoft, borderColor: '#FED7AA' }}>
            <T v="title" color={colors.warning}>
              ⚠️ Fique atento(a)
            </T>
            {o.warnings.map((w) => (
              <Bullet key={w} icon="shield-checkmark" color={colors.warning} text={w} />
            ))}
          </Card>
        )}

        <Section title="Trilha passo a passo">
          {o.steps.map((s) => (
            <View key={s.id} style={styles.stepRow}>
              <View style={[styles.stepNum, s.locked && { backgroundColor: colors.goldSoft }]}>
                {s.locked ? <Icon name="lock-closed" size={13} color={colors.warning} /> : <T v="caption" color={colors.brandDark} style={{ fontFamily: font.bold }}>{s.order}</T>}
              </View>
              <T v="small" style={{ flex: 1 }} color={s.locked ? colors.textMuted : colors.text}>
                {s.title}
              </T>
            </View>
          ))}
        </Section>

        <Section title="Impostos e formalização">
          <T v="small" color={colors.textMuted}>
            {o.taxNote}
          </T>
        </Section>

        {o.sources.length > 0 && (
          <View style={{ gap: 6 }}>
            <T v="label" color={colors.textSoft}>
              Fontes das estimativas
            </T>
            {o.sources.map((s) => (
              <Pressable key={s} onPress={() => Linking.openURL(s)}>
                <T v="caption" color={colors.brand} numberOfLines={1}>
                  {s.replace(/^https?:\/\/(www\.)?/, '')}
                </T>
              </Pressable>
            ))}
          </View>
        )}
        <T v="caption" color={colors.textSoft}>
          Revisado em {new Date(o.reviewedAt).toLocaleDateString('pt-BR')}. Valores são estimativas, não garantia de renda.
        </T>
        {error && <ErrorBox message={error} />}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={started ? 'Continuar trilha' : 'Começar trilha'}
          iconRight="arrow-forward"
          onPress={start}
          loading={setStatus.isPending}
          style={{ flex: 1 }}
        />
      </View>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ gap: space(3) }}>
      <T v="h3">{title}</T>
      {children}
    </Card>
  );
}

function Metric({ icon, label, value, sub }: { icon: string; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <View style={styles.metric}>
      <Icon name={icon} size={18} color={colors.brand} />
      <T v="caption" color={colors.textMuted}>
        {label}
      </T>
      {typeof value === 'string' ? (
        <T v="title" style={{ fontFamily: font.bold }}>
          {value}
        </T>
      ) : (
        value
      )}
      {sub && (
        <T v="caption" color={colors.textSoft}>
          {sub}
        </T>
      )}
    </View>
  );
}

function Dots({ n, color = colors.brand }: { n: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingVertical: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{ width: 16, height: 6, borderRadius: 3, backgroundColor: i <= n ? color : colors.border }} />
      ))}
    </View>
  );
}

function Bullet({ icon, text, color = colors.brand }: { icon: string; text: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <Icon name={icon} size={16} color={color} style={{ marginTop: 2 }} />
      <T v="small" style={{ flex: 1 }}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space(5), paddingVertical: space(2), width: '100%', maxWidth: 720, alignSelf: 'center' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  content: { padding: space(5), paddingTop: space(2), gap: space(4), paddingBottom: space(10), width: '100%', maxWidth: 720, alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  metric: { flexGrow: 1, flexBasis: '45%', minWidth: 140, gap: 4, padding: space(4), borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  platform: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2), borderBottomWidth: 1, borderColor: colors.border },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  caution: { flexDirection: 'row', gap: 6, marginTop: 6, padding: 8, borderRadius: radius.sm, backgroundColor: colors.warningSoft },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.brandTint },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', padding: space(4), paddingHorizontal: space(5), borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card, width: '100%' },
});
