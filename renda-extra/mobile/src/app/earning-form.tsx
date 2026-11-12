import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { api, ApiError } from '@/lib/api';
import { useInvalidateEarnings, useTracks } from '@/lib/queries';
import { todayISO } from '@/lib/format';
import { goBack } from '@/lib/nav';
import { Button, Chip, ErrorBox, Icon, Input, T } from '@/components/ui';
import { colors, font, radius, space } from '@/theme';

type Params = { id?: string; amount?: string; currency?: 'BRL' | 'USD'; source?: string; date?: string; note?: string; slug?: string };

const isoToBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const brToIso = (br: string) => {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) || d.getDate() !== Number(m[1]) ? null : iso;
};
const yesterdayISO = () => {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function EarningForm() {
  const p = useLocalSearchParams<Params>();
  const editing = Boolean(p.id);
  const tracks = useTracks();
  const invalidate = useInvalidateEarnings();

  const [amount, setAmount] = useState(p.amount ? p.amount.replace('.', ',') : '');
  const [currency, setCurrency] = useState<'BRL' | 'USD'>(p.currency ?? 'BRL');
  const [slug, setSlug] = useState<string | null>(p.slug || null);
  const [source, setSource] = useState(p.source ?? '');
  const [date, setDate] = useState(p.date ?? todayISO());
  const [customDate, setCustomDate] = useState(p.date && p.date !== todayISO() && p.date !== yesterdayISO() ? isoToBr(p.date) : '');
  const [note, setNote] = useState(p.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const myTracks = useMemo(() => tracks.data?.items ?? [], [tracks.data]);
  const dateMode = date === todayISO() ? 'today' : date === yesterdayISO() ? 'yesterday' : 'custom';

  function pickTrack(s: string, title: string) {
    Haptics.selectionAsync().catch(() => {});
    if (slug === s) {
      setSlug(null);
      return;
    }
    setSlug(s);
    if (!source || myTracks.some((t) => t.title === source)) setSource(title);
  }

  async function save() {
    setError(null);
    const value = Number(amount.replace(/\./g, '').replace(',', '.'));
    if (!value || value <= 0) return setError('Informe o valor recebido');
    if (!source.trim()) return setError('Informe de onde veio (ex.: iFood, cliente, Workana)');
    let finalDate = date;
    if (dateMode === 'custom' || customDate) {
      const iso = brToIso(customDate);
      if (customDate && !iso) return setError('Data inválida. Use DD/MM/AAAA');
      if (iso) finalDate = iso;
    }
    setSaving(true);
    try {
      const body = { amount: value, currency, source: source.trim(), opportunitySlug: slug, date: finalDate, note: note.trim() || null };
      if (editing) await api(`/earnings/${p.id}`, { method: 'PATCH', body });
      else await api('/earnings', { method: 'POST', body });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      invalidate();
      goBack('/earnings');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await api(`/earnings/${p.id}`, { method: 'DELETE' });
      invalidate();
      goBack('/earnings');
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => goBack('/earnings')}>
            <Icon name="close" size={26} />
          </Pressable>
          <T v="title">{editing ? 'Editar ganho' : 'Novo ganho'}</T>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.amountBox}>
            <View style={styles.currencySwitch}>
              {(['BRL', 'USD'] as const).map((c) => (
                <Pressable key={c} onPress={() => setCurrency(c)} style={[styles.curBtn, currency === c && styles.curBtnOn]}>
                  <T v="caption" color={currency === c ? colors.white : colors.textMuted} style={{ fontFamily: font.bold }}>
                    {c === 'BRL' ? 'R$' : 'US$'}
                  </T>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <T v="h2" color={colors.textMuted}>
                {currency === 'BRL' ? 'R$' : 'US$'}
              </T>
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^\d,.]/g, ''))}
                placeholder="0,00"
                placeholderTextColor={colors.border}
                keyboardType="decimal-pad"
                autoFocus={!editing}
                style={styles.amountInput}
              />
            </View>
            {currency === 'USD' && (
              <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
                Convertemos para reais pela cotação do dia.
              </T>
            )}
          </View>

          {myTracks.length > 0 && (
            <View style={{ gap: space(2) }}>
              <T v="caption" color={colors.textMuted}>
                Vincular a uma trilha (opcional)
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
                {myTracks.map((t) => (
                  <Chip key={t.slug} label={t.title} icon={t.icon} active={slug === t.slug} onPress={() => pickTrack(t.slug, t.title)} />
                ))}
              </View>
            </View>
          )}

          <Input label="De onde veio?" icon="pricetag-outline" value={source} onChangeText={setSource} placeholder="Ex.: iFood, Workana, cliente Maria" maxLength={60} />

          <View style={{ gap: space(2) }}>
            <T v="caption" color={colors.textMuted}>
              Quando recebeu?
            </T>
            <View style={{ flexDirection: 'row', gap: space(2), flexWrap: 'wrap' }}>
              <Chip label="Hoje" active={dateMode === 'today' && !customDate} onPress={() => (setDate(todayISO()), setCustomDate(''))} />
              <Chip label="Ontem" active={dateMode === 'yesterday' && !customDate} onPress={() => (setDate(yesterdayISO()), setCustomDate(''))} />
              <Chip label="Outra data" icon="calendar-outline" active={dateMode === 'custom' || Boolean(customDate)} onPress={() => setCustomDate(customDate || isoToBr(date))} />
            </View>
            {(dateMode === 'custom' || customDate !== '') && (
              <Input
                value={customDate}
                onChangeText={(t) => {
                  const d = t.replace(/\D/g, '').slice(0, 8);
                  setCustomDate(d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                }}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                icon="calendar-outline"
              />
            )}
          </View>

          <Input label="Observação (opcional)" icon="document-text-outline" value={note} onChangeText={setNote} placeholder="Ex.: 12 entregas, projeto do logo…" maxLength={240} />

          {error && <ErrorBox message={error} />}
        </ScrollView>

        <View style={styles.footer}>
          {editing && <Button title="Excluir" variant="danger" icon="trash-outline" onPress={remove} disabled={saving} style={{ flex: 1 }} />}
          <Button title={editing ? 'Salvar' : 'Registrar'} icon="checkmark" onPress={save} loading={saving} style={{ flex: 2 }} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space(5), paddingBottom: space(2) },
  content: { padding: space(5), gap: space(5), width: '100%', maxWidth: 560, alignSelf: 'center' },
  amountBox: { gap: space(3), padding: space(5), backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  currencySwitch: { flexDirection: 'row', alignSelf: 'center', backgroundColor: colors.bg, borderRadius: radius.pill, padding: 4 },
  curBtn: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: radius.pill },
  curBtnOn: { backgroundColor: colors.brand },
  amountInput: { fontFamily: font.black, fontSize: 44, color: colors.text, minWidth: 140, textAlign: 'center', paddingVertical: 4, outlineStyle: 'none' } as object,
  footer: { flexDirection: 'row', gap: space(3), padding: space(4), paddingHorizontal: space(5), borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
});
