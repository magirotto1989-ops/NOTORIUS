import { View } from 'react-native';
import { router } from 'expo-router';
import { colors, font } from '@/theme';
import { money, payDays, range } from '@/lib/format';
import type { OpportunitySummary } from '@/lib/types';
import { Card, Icon, IconBubble, Pill, T } from './ui';

export function MatchBadge({ score, eligible = true, size = 'md' }: { score: number; eligible?: boolean; size?: 'md' | 'lg' }) {
  const tone = !eligible ? colors.textSoft : score >= 75 ? colors.brand : score >= 55 ? '#0D9488' : colors.gold;
  const big = size === 'lg';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: big ? 12 : 8,
        paddingVertical: big ? 6 : 4,
        borderRadius: 999,
        backgroundColor: tone + '1A',
      }}
    >
      <Icon name={eligible ? 'flash' : 'lock-closed'} size={big ? 14 : 11} color={tone} />
      <T v="caption" color={tone} style={{ fontFamily: font.bold, fontSize: big ? 14 : 12 }}>
        {eligible ? `${score}% match` : 'Não compatível'}
      </T>
    </View>
  );
}

export const modeLabel = { ONLINE: 'Online', PRESENCIAL: 'Presencial', HIBRIDO: 'Online ou presencial' } as const;

export function OpportunityCard({ o, compact }: { o: OpportunitySummary; compact?: boolean }) {
  return (
    <Card onPress={() => router.push({ pathname: '/opportunity/[slug]', params: { slug: o.slug } })} style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconBubble name={o.icon} color={o.color} />
        {o.match && <MatchBadge score={o.match.score} eligible={o.match.eligible} />}
      </View>
      <View style={{ gap: 2 }}>
        <T v="title" numberOfLines={2}>
          {o.title}
        </T>
        <T v="small" color={colors.textMuted} numberOfLines={compact ? 1 : 2}>
          {o.tagline}
        </T>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Pill label={modeLabel[o.mode]} icon={o.mode === 'PRESENCIAL' ? 'walk' : o.mode === 'ONLINE' ? 'wifi' : 'swap-horizontal'} bg="#F1F5F3" fg={colors.textMuted} />
        {o.currency === 'USD' && <Pill label="Paga em dólar" icon="logo-usd" bg={colors.dollarSoft} fg={colors.dollar} />}
        {o.startupCostBRL === 0 && <Pill label="Sem investimento" icon="sparkles" />}
        {o.daysToFirstPay <= 7 && <Pill label="Paga rápido" icon="flash" bg={colors.goldSoft} fg={colors.warning} />}
      </View>

      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: colors.border, paddingTop: 12 }}>
        <Metric label="Estimativa/mês" value={range(o.estMonthlyBRL.min, o.estMonthlyBRL.max)} />
        <Metric label="Por hora" value={range(o.hourlyBRL.min, o.hourlyBRL.max)} />
        {!compact && <Metric label="1º pagamento" value={payDays(o.daysToFirstPay)} />}
      </View>
      {o.match && !o.match.eligible && o.match.blockers[0] && (
        <T v="caption" color={colors.textSoft}>
          {o.match.blockers[0]}
        </T>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T v="caption" color={colors.textSoft}>
        {label}
      </T>
      <T v="small" style={{ fontFamily: font.bold }} numberOfLines={1}>
        {value}
      </T>
    </View>
  );
}

export { money };
