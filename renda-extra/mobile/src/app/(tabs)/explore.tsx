import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMeta, useOpportunities, type Filters } from '@/lib/queries';
import { Chip, EmptyState, ErrorBox, Input, T } from '@/components/ui';
import { OpportunityCard } from '@/components/OpportunityCard';
import { colors, space } from '@/theme';

const SORTS = [
  { k: 'match', label: 'Melhor match', icon: 'flash' },
  { k: 'earnings', label: 'Maior ganho', icon: 'trending-up' },
  { k: 'fast', label: 'Paga mais rápido', icon: 'time' },
  { k: 'cheap', label: 'Menor investimento', icon: 'wallet' },
  { k: 'popular', label: 'Populares', icon: 'people' },
];

export default function Explore() {
  const params = useLocalSearchParams<{ category?: string }>();
  const meta = useMeta();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [f, setF] = useState<Filters>({ sort: 'match', category: params.category });

  // Ao chegar por um atalho de categoria, aplica o filtro (ajuste de estado durante o render).
  const [lastParam, setLastParam] = useState(params.category);
  if (params.category !== lastParam) {
    setLastParam(params.category);
    if (params.category) setF((s) => ({ ...s, category: params.category }));
  }

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const list = useOpportunities({ ...f, q: debounced || undefined });
  const toggle = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((s) => ({ ...s, [k]: s[k] === v ? undefined : v }));

  const header = (
    <View style={{ gap: space(3), paddingBottom: space(2) }}>
      <View style={{ gap: 2 }}>
        <T v="h1">Explorar</T>
        <T v="body" color={colors.textMuted}>
          {list.data ? `${list.data.total} oportunidades${list.data.personalized ? ', ordenadas para o seu perfil' : ''}` : 'Carregando…'}
        </T>
      </View>
      <Input icon="search" value={q} onChangeText={setQ} placeholder="Buscar: iFood, inglês, design, Shopee…" autoCapitalize="none" returnKeyType="search" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip label="De casa" icon="wifi" active={f.mode === 'ONLINE'} onPress={() => toggle('mode', 'ONLINE')} />
        <Chip label="Na rua" icon="walk" active={f.mode === 'PRESENCIAL'} onPress={() => toggle('mode', 'PRESENCIAL')} />
        <Chip label="Em dólar" icon="logo-usd" active={f.currency === 'USD'} onPress={() => toggle('currency', 'USD')} />
        <Chip label="Sem investimento" icon="sparkles" active={f.maxStartup === 0} onPress={() => toggle('maxStartup', 0)} />
        <Chip label="Paga rápido" icon="flash" active={f.fastPay === true} onPress={() => toggle('fastPay', true)} />
        <Chip label="Só compatíveis" icon="checkmark-circle" active={f.eligibleOnly === true} onPress={() => toggle('eligibleOnly', true)} />
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip label="Todas" tone="dark" active={!f.category} onPress={() => setF((s) => ({ ...s, category: undefined }))} />
        {meta.data &&
          Object.entries(meta.data.categories).map(([k, c]) => (
            <Chip key={k} label={c.label} icon={c.icon} tone="dark" active={f.category === k} onPress={() => toggle('category', k)} />
          ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, { alignItems: 'center' }]}>
        <T v="caption" color={colors.textMuted}>
          Ordenar:
        </T>
        {SORTS.map((s) => (
          <Chip key={s.k} label={s.label} icon={s.icon} active={f.sort === s.k} onPress={() => setF((x) => ({ ...x, sort: s.k }))} />
        ))}
        {list.isFetching && <ActivityIndicator color={colors.brand} style={{ marginLeft: 8 }} />}
      </ScrollView>
      {list.error ? <ErrorBox message={(list.error as Error).message} onRetry={() => list.refetch()} /> : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => <OpportunityCard o={item} />}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={{ height: space(3) }} />}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          list.isLoading ? undefined : (
            <EmptyState icon="search" title="Nada encontrado" text="Tente remover alguns filtros ou buscar por outra palavra." />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(5), paddingBottom: space(16), width: '100%', maxWidth: 720, alignSelf: 'center' },
  row: { gap: space(2), paddingRight: space(5) },
});
