import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { Button, ErrorBox, Icon, Loading, ProgressBar, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useMeta } from '@/lib/queries';
import { money } from '@/lib/format';
import type { Mode } from '@/lib/types';
import { colors, font, radius, space } from '@/theme';

type Answers = {
  modePref: Mode | null;
  hoursPerWeek: number | null;
  monthlyGoal: number | null;
  skills: string[];
  assets: string[];
  englishLevel: number | null;
  capitalBRL: number | null;
  needsFastCash: boolean | null;
  wantsDollar: boolean;
  experience: number | null;
};

const HOURS = [
  { v: 3, label: 'Até 3h', hint: 'Só nas brechas' },
  { v: 6, label: '4 a 8h', hint: '~1h por dia' },
  { v: 12, label: '9 a 15h', hint: 'Algumas noites e o fim de semana' },
  { v: 20, label: '16 a 25h', hint: 'Meio período' },
  { v: 35, label: '25h ou mais', hint: 'Quase tempo integral' },
];
const GOALS = [300, 500, 1000, 2000, 3000, 5000];
const CAPITAL = [
  { v: 0, label: 'Nada por enquanto', hint: 'Quero começar sem gastar' },
  { v: 150, label: 'Até R$ 150', hint: 'Algo pequeno, tipo um curso ou material' },
  { v: 600, label: 'Até R$ 600', hint: 'Equipamento ou estoque inicial' },
  { v: 2500, label: 'Até R$ 2.500 ou mais', hint: 'Posso investir para crescer rápido' },
];

export default function Quiz() {
  const meta = useMeta();
  const { user, profile, refreshMe } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [a, setA] = useState<Answers>(() => ({
    modePref: profile?.modePref ?? null,
    hoursPerWeek: profile?.hoursPerWeek ?? null,
    monthlyGoal: profile ? (user?.monthlyGoal ?? null) : null,
    skills: profile?.skills ?? [],
    assets: profile?.assets ?? ['smartphone'],
    englishLevel: profile?.englishLevel ?? null,
    capitalBRL: profile?.capitalBRL ?? null,
    needsFastCash: profile?.needsFastCash ?? null,
    wantsDollar: profile?.wantsDollar ?? false,
    experience: profile?.experience ?? null,
  }));
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => {
    Haptics.selectionAsync().catch(() => {});
    setA((s) => ({ ...s, [k]: v }));
  };
  const toggle = (k: 'skills' | 'assets', v: string) =>
    set(k, a[k].includes(v) ? a[k].filter((x) => x !== v) : [...a[k], v]);

  const steps = (() => {
    if (!meta.data) return [];
    const m = meta.data;
    return [
      {
        title: 'Onde você prefere trabalhar?',
        subtitle: 'Isso já elimina o que não combina com você.',
        valid: a.modePref !== null,
        body: (
          <View style={{ gap: space(3) }}>
            {(['ONLINE', 'PRESENCIAL', 'HIBRIDO'] as Mode[]).map((k) => (
              <Option
                key={k}
                icon={m.modes[k].icon}
                label={m.modes[k].label}
                hint={k === 'ONLINE' ? 'Pelo computador ou celular' : k === 'PRESENCIAL' ? 'Entregas, serviços, aulas no bairro' : 'Estou aberto(a) a tudo'}
                selected={a.modePref === k}
                onPress={() => set('modePref', k)}
              />
            ))}
          </View>
        ),
      },
      {
        title: 'Quanto tempo por semana você tem?',
        subtitle: 'Seja realista — consistência vale mais que intensidade.',
        valid: a.hoursPerWeek !== null,
        body: (
          <View style={{ gap: space(3) }}>
            {HOURS.map((h) => (
              <Option key={h.v} icon="time-outline" label={h.label} hint={h.hint} selected={a.hoursPerWeek === h.v} onPress={() => set('hoursPerWeek', h.v)} />
            ))}
          </View>
        ),
      },
      {
        title: 'Qual sua meta de renda extra por mês?',
        subtitle: 'Vamos priorizar o que tem potencial de chegar lá.',
        valid: a.monthlyGoal !== null,
        body: (
          <View style={styles.grid}>
            {GOALS.map((g) => (
              <Tile key={g} label={money(g)} sub={g >= 5000 ? 'ou mais' : 'por mês'} selected={a.monthlyGoal === g} onPress={() => set('monthlyGoal', g)} />
            ))}
          </View>
        ),
      },
      {
        title: 'O que você sabe fazer bem?',
        subtitle: 'Marque tudo que se aplica. Não sabe? Pode pular — há opções sem experiência.',
        valid: true,
        body: (
          <View style={styles.wrap}>
            {Object.entries(m.skills).map(([k, s]) => (
              <Toggle key={k} icon={s.icon} label={s.label} selected={a.skills.includes(k)} onPress={() => toggle('skills', k)} />
            ))}
          </View>
        ),
      },
      {
        title: 'O que você tem à disposição?',
        subtitle: 'Algumas oportunidades exigem veículo, equipamento ou espaço.',
        valid: true,
        body: (
          <View style={styles.wrap}>
            {Object.entries(m.assets).map(([k, s]) => (
              <Toggle key={k} icon={s.icon} label={s.label} selected={a.assets.includes(k)} onPress={() => toggle('assets', k)} />
            ))}
          </View>
        ),
      },
      {
        title: 'Como está seu inglês?',
        subtitle: 'Inglês abre portas para ganhar em dólar.',
        valid: a.englishLevel !== null,
        body: (
          <View style={{ gap: space(3) }}>
            {m.englishLevels.map((l, i) => (
              <Option
                key={l}
                icon={['close-circle-outline', 'chatbubble-outline', 'chatbubbles-outline', 'globe-outline'][i]}
                label={l}
                hint={['Não falo nem leio', 'Leio com tradutor', 'Converso com algum esforço', 'Converso e escrevo com fluência'][i]}
                selected={a.englishLevel === i}
                onPress={() => set('englishLevel', i)}
              />
            ))}
          </View>
        ),
      },
      {
        title: 'Quanto pode investir para começar?',
        subtitle: 'Tudo bem se for zero: muitas opções não exigem nada.',
        valid: a.capitalBRL !== null,
        body: (
          <View style={{ gap: space(3) }}>
            {CAPITAL.map((c) => (
              <Option key={c.v} icon="wallet-outline" label={c.label} hint={c.hint} selected={a.capitalBRL === c.v} onPress={() => set('capitalBRL', c.v)} />
            ))}
          </View>
        ),
      },
      {
        title: 'Últimos detalhes',
        subtitle: 'Para afinar o ranking.',
        valid: a.needsFastCash !== null && a.experience !== null,
        body: (
          <View style={{ gap: space(5) }}>
            <View style={{ gap: space(2) }}>
              <T v="title">Precisa do dinheiro com urgência?</T>
              <View style={styles.row}>
                <Tile label="Sim, logo" sub="em dias" selected={a.needsFastCash === true} onPress={() => set('needsFastCash', true)} />
                <Tile label="Posso esperar" sub="construir algo maior" selected={a.needsFastCash === false} onPress={() => set('needsFastCash', false)} />
              </View>
            </View>
            <View style={{ gap: space(2) }}>
              <T v="title">Já fez renda extra antes?</T>
              <View style={{ gap: space(2) }}>
                {m.experienceLevels.map((l, i) => (
                  <Option key={l} icon={['leaf-outline', 'trending-up-outline', 'trophy-outline'][i]} label={l} selected={a.experience === i} onPress={() => set('experience', i)} />
                ))}
              </View>
            </View>
            <Option icon="logo-usd" label="Tenho interesse em ganhar em dólar" hint="Daremos um bônus para oportunidades internacionais" selected={a.wantsDollar} onPress={() => set('wantsDollar', !a.wantsDollar)} />
          </View>
        ),
      },
    ];
  })();

  if (!user) return <Redirect href="/welcome" />;
  if (meta.isLoading || !meta.data) return meta.error ? <ErrorBox message="Não foi possível carregar o quiz." onRetry={() => meta.refetch()} /> : <Loading />;

  const current = steps[step];
  const last = step === steps.length - 1;

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await api('/me/profile', {
        method: 'PUT',
        body: {
          hoursPerWeek: a.hoursPerWeek,
          modePref: a.modePref,
          capitalBRL: a.capitalBRL,
          skills: a.skills,
          assets: a.assets,
          englishLevel: a.englishLevel,
          needsFastCash: a.needsFastCash,
          wantsDollar: a.wantsDollar,
          experience: a.experience,
          monthlyGoal: a.monthlyGoal,
        },
      });
      await refreshMe();
      qc.invalidateQueries();
      router.replace('/home');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.container}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(5), paddingTop: space(3) }}>
          <Pressable
            hitSlop={12}
            onPress={() => (step > 0 ? setStep(step - 1) : router.canGoBack() ? router.back() : null)}
            style={{ opacity: step === 0 && !router.canGoBack() ? 0.3 : 1 }}
          >
            <Icon name="arrow-back" size={24} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar pct={((step + 1) / steps.length) * 100} />
          </View>
          <T v="caption" color={colors.textMuted}>
            {step + 1}/{steps.length}
          </T>
        </View>

        <ScrollView contentContainerStyle={{ padding: space(5), gap: space(5), paddingBottom: space(8) }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: space(2) }}>
            <T v="h2">{current.title}</T>
            <T v="body" color={colors.textMuted}>
              {current.subtitle}
            </T>
          </View>
          {current.body}
          {error && <ErrorBox message={error} />}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={last ? 'Ver minhas oportunidades' : 'Continuar'}
            iconRight={last ? 'sparkles' : 'arrow-forward'}
            disabled={!current.valid}
            loading={saving}
            onPress={() => (last ? finish() : setStep(step + 1))}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Option({ icon, label, hint, selected, onPress }: { icon: string; label: string; hint?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.option, selected && styles.optionOn, pressed && { opacity: 0.9 }]}>
      <View style={[styles.optionIcon, selected && { backgroundColor: colors.brand }]}>
        <Icon name={icon} size={20} color={selected ? colors.white : colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="title">{label}</T>
        {hint && (
          <T v="small" color={colors.textMuted}>
            {hint}
          </T>
        )}
      </View>
      <Icon name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected ? colors.brand : colors.border} />
    </Pressable>
  );
}

function Tile({ label, sub, selected, onPress }: { label: string; sub?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, selected && styles.optionOn, pressed && { opacity: 0.9 }]}>
      <T v="h3" color={selected ? colors.brandDark : colors.text}>
        {label}
      </T>
      {sub && (
        <T v="caption" color={colors.textMuted}>
          {sub}
        </T>
      )}
    </Pressable>
  );
}

function Toggle({ icon, label, selected, onPress }: { icon: string; label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.toggle, selected && { backgroundColor: colors.brand, borderColor: colors.brand }, pressed && { opacity: 0.85 }]}>
      <Icon name={icon} size={16} color={selected ? colors.white : colors.brand} />
      <T v="small" color={selected ? colors.white : colors.text} style={{ fontFamily: font.semibold }}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, maxWidth: 620, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  row: { flexDirection: 'row', gap: space(3) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(4),
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionOn: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  optionIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 120,
    padding: space(4),
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 2,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  footer: { padding: space(5), paddingTop: space(3), borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
});
