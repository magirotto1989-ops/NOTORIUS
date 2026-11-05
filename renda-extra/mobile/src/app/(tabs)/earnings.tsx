import { useState } from 'react';
import { Platform, Pressable, RefreshControl, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { apiText, ApiError } from '@/lib/api';
import { useEarnings, useEarningsSummary } from '@/lib/queries';
import { money, moneyIn, monthLong, shiftMonth, shortDate, thisMonth } from '@/lib/format';
import { Button, Card, Divider, EmptyState, ErrorBox, Icon, IconBubble, ProgressBar, Screen, SectionHeader, T } from '@/components/ui';
import { MonthBars, StackedBar } from '@/components/charts';
import { PremiumBanner } from '@/components/PremiumBanner';
import { colors, font, radius, shadow, space } from '@/theme';

const PALETTE = ['#059669', '#6366F1', '#F59E0B', '#EC4899', '#0EA5E9', '#84CC16', '#A855F7'];

export default function Earnings() {
  const { user } = useAuth();
  const [month, setMonth] = useState(thisMonth());
  const summary = useEarningsSummary(month);
  const list = useEarnings(month);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const locked = (summary.error as ApiError | null)?.isPremium || (list.error as ApiError | null)?.isPremium;
  const s = summary.data;
  const isCurrent = month === thisMonth();

  async function exportCsv() {
    if (user?.plan !== 'PREMIUM') return router.push({ pathname: '/paywall', params: { reason: 'Exportação em planilha é um recurso Premium.' } });
    setExporting(true);
    setExportError(null);
    try {
      const csv = await apiText('/earnings/export.csv');
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ganhos-renda-mais.csv';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ title: 'Meus ganhos (Renda+)', message: csv });
      }
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen
        refreshControl={<RefreshControl refreshing={summary.isRefetching} onRefresh={() => {
              summary.refetch();
              list.refetch();
            }} />}
        contentStyle={{ maxWidth: 720, width: '100%', alignSelf: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <T v="h1">Ganhos</T>
            <T v="body" color={colors.textMuted}>
              Tudo o que entrou, num lugar só.
            </T>
          </View>
          <Pressable onPress={exportCsv} style={styles.iconBtn} accessibilityLabel="Exportar planilha">
            <Icon name={exporting ? 'hourglass-outline' : 'download-outline'} size={20} />
          </Pressable>
        </View>
        {exportError && <ErrorBox message={exportError} />}

        <View style={styles.monthNav}>
          <Pressable hitSlop={12} onPress={() => setMonth(shiftMonth(month, -1))} style={styles.navBtn}>
            <Icon name="chevron-back" />
          </Pressable>
          <T v="title">{monthLong(month)}</T>
          <Pressable hitSlop={12} disabled={isCurrent} onPress={() => setMonth(shiftMonth(month, 1))} style={[styles.navBtn, isCurrent && { opacity: 0.3 }]}>
            <Icon name="chevron-forward" />
          </Pressable>
        </View>

        {locked ? (
          <View style={{ gap: space(3) }}>
            <EmptyState icon="lock-closed-outline" title="Histórico completo é Premium" text="No plano grátis você vê os últimos 3 meses. Assine para ver todo o histórico e gráficos de 12 meses." />
            <PremiumBanner title="Ver todo o histórico" />
            <Button title="Voltar para este mês" variant="ghost" onPress={() => setMonth(thisMonth())} />
          </View>
        ) : (
          <>
            <Card style={{ gap: space(3) }}>
              <T v="label" color={colors.textMuted}>
                Total do mês
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space(3), flexWrap: 'wrap' }}>
                <T v="number">{money(s?.total ?? 0, true)}</T>
                {s?.deltaPct != null && (
                  <View style={[styles.delta, { backgroundColor: s.deltaPct >= 0 ? colors.brandTint : colors.dangerSoft }]}>
                    <Icon name={s.deltaPct >= 0 ? 'arrow-up' : 'arrow-down'} size={12} color={s.deltaPct >= 0 ? colors.brand : colors.danger} />
                    <T v="caption" color={s.deltaPct >= 0 ? colors.brand : colors.danger} style={{ fontFamily: font.bold }}>
                      {Math.abs(s.deltaPct)}% vs mês anterior
                    </T>
                  </View>
                )}
              </View>
              <ProgressBar pct={s?.goalPct ?? 0} color={colors.gold} track={colors.goldSoft} height={10} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T v="caption" color={colors.textMuted}>
                  {s?.goalPct ?? 0}% da meta de {money(s?.goal ?? 0)}
                </T>
                {isCurrent && s?.projection != null && (
                  <T v="caption" color={colors.warning} style={{ fontFamily: font.semibold }}>
                    Projeção: {money(s.projection)}
                  </T>
                )}
              </View>
            </Card>

            {s && s.series.some((x) => x.total > 0) && (
              <Card style={{ gap: space(3) }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T v="title">Evolução</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 14, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.gold }} />
                    <T v="caption" color={colors.textMuted}>
                      meta
                    </T>
                  </View>
                </View>
                <MonthBars series={s.series} selected={month} goal={s.goal} onSelect={setMonth} />
                {s.historyLimited && (
                  <Pressable onPress={() => router.push('/paywall')}>
                    <T v="caption" color={colors.accent} style={{ fontFamily: font.semibold }}>
                      🔒 Veja 12 meses de histórico com o Premium
                    </T>
                  </Pressable>
                )}
              </Card>
            )}

            {s && s.bySource.length > 0 && (
              <Card style={{ gap: space(3) }}>
                <T v="title">De onde veio</T>
                <StackedBar parts={s.bySource.map((b, i) => ({ value: b.total, color: b.color ?? PALETTE[i % PALETTE.length] }))} />
                {s.bySource.map((b, i) => (
                  <View key={b.source} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: b.color ?? PALETTE[i % PALETTE.length] }} />
                    <T v="small" style={{ flex: 1 }} numberOfLines={1}>
                      {b.source}
                    </T>
                    <T v="small" style={{ fontFamily: font.bold }}>
                      {money(b.total)}
                    </T>
                    <T v="caption" color={colors.textSoft} style={{ width: 40, textAlign: 'right' }}>
                      {s.total ? Math.round((b.total / s.total) * 100) : 0}%
                    </T>
                  </View>
                ))}
              </Card>
            )}

            <SectionHeader title="Lançamentos" />
            {list.error && !locked ? <ErrorBox message={(list.error as Error).message} onRetry={() => list.refetch()} /> : null}
            {list.data?.items.length === 0 && (
              <EmptyState
                icon="wallet-outline"
                title="Nenhum ganho neste mês"
                text="Registre cada pagamento que receber. Ver o dinheiro entrando é o melhor combustível para continuar."
                action="Registrar ganho"
                onAction={() => router.push('/earning-form')}
              />
            )}
            {list.data && list.data.items.length > 0 && (
              <Card style={{ paddingVertical: space(1) }}>
                {list.data.items.map((e, i) => (
                  <View key={e.id}>
                    {i > 0 && <Divider />}
                    <Pressable
                      style={styles.entry}
                      onPress={() =>
                        router.push({
                          pathname: '/earning-form',
                          params: { id: e.id, amount: String(e.amount), currency: e.currency, source: e.source, date: e.date, note: e.note ?? '', slug: e.opportunity?.slug ?? '' },
                        })
                      }
                    >
                      <IconBubble name={e.opportunity?.icon ?? 'cash-outline'} color={e.opportunity?.color ?? colors.brand} size={40} />
                      <View style={{ flex: 1 }}>
                        <T v="title" numberOfLines={1}>
                          {e.source}
                        </T>
                        <T v="caption" color={colors.textMuted} numberOfLines={1}>
                          {shortDate(e.date)}
                          {e.note ? ` · ${e.note}` : ''}
                        </T>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <T v="title" color={colors.brandDark} style={{ fontFamily: font.bold }}>
                          +{moneyIn(e.amount, e.currency, true)}
                        </T>
                        {e.currency === 'USD' && (
                          <T v="caption" color={colors.textSoft}>
                            ≈ {money(e.amountBRL, true)}
                          </T>
                        )}
                      </View>
                    </Pressable>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </Screen>

      <Pressable style={[styles.fab, shadow]} onPress={() => router.push('/earning-form')} accessibilityLabel="Registrar ganho">
        <Icon name="add" size={30} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.pill, padding: 6, borderWidth: 1, borderColor: colors.border },
  navBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  entry: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  fab: { position: 'absolute', right: space(5), bottom: space(5), width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
});
