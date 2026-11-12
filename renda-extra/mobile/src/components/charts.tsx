import { Pressable, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, font, radius } from '@/theme';
import { T } from './ui';
import { monthShort } from '@/lib/format';

export function ProgressRing({
  pct,
  size = 120,
  stroke = 12,
  trackColor = 'rgba(255,255,255,0.18)',
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FDE68A" />
            <Stop offset="1" stopColor="#F59E0B" />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - p / 100)}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Barras mensais; destaca o mês selecionado e mostra linha da meta. */
export function MonthBars({
  series,
  selected,
  goal,
  onSelect,
  height = 140,
}: {
  series: { month: string; total: number }[];
  selected: string;
  goal: number;
  onSelect?: (m: string) => void;
  height?: number;
}) {
  const max = Math.max(goal, ...series.map((s) => s.total), 1);
  const goalY = (goal / max) * height;
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: goalY, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.gold }}
        />
        {series.map((s) => {
          const h = Math.max(4, (s.total / max) * height);
          const active = s.month === selected;
          return (
            <Pressable
              key={s.month}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}
              onPress={() => onSelect?.(s.month)}
              accessibilityLabel={`${monthShort(s.month)}: ${Math.round(s.total)} reais`}
            >
              <View
                style={{
                  width: '100%',
                  maxWidth: 34,
                  height: h,
                  borderRadius: radius.sm,
                  backgroundColor: active ? colors.brand : s.total ? colors.brandSoft : '#EEF2F0',
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        {series.map((s) => (
          <T
            key={s.month}
            v="caption"
            color={s.month === selected ? colors.text : colors.textSoft}
            style={{ flex: 1, textAlign: 'center', fontFamily: s.month === selected ? font.bold : font.medium, fontSize: 11 }}
          >
            {monthShort(s.month)}
          </T>
        ))}
      </View>
    </View>
  );
}

/** Barra horizontal empilhada para "de onde veio o dinheiro". */
export function StackedBar({ parts }: { parts: { value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <View style={{ flexDirection: 'row', height: 12, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: '#EEF2F0', gap: 2 }}>
      {parts.map((p, i) => (
        <View key={i} style={{ flex: p.value / total, backgroundColor: p.color }} />
      ))}
    </View>
  );
}
