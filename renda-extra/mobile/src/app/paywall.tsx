import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { goBack } from '@/lib/nav';
import { billing, type PlanOption } from '@/lib/billing';
import { useMeta } from '@/lib/queries';
import { money } from '@/lib/format';
import { Button, ErrorBox, Icon, T } from '@/components/ui';
import { colors, font, gradients, radius, space } from '@/theme';

export default function Paywall() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const meta = useMeta();
  const { user, setUser, refreshMe } = useAuth();
  const qc = useQueryClient();
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [store, setStore] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p = meta.data?.plans;

  useEffect(() => {
    billing.options().then(setStore).catch(() => {});
  }, []);

  const priceOf = (id: 'monthly' | 'yearly') => store.find((s) => s.id === id)?.priceString ?? (p ? money(p[id].price, true) : '');

  async function buy() {
    setLoading(true);
    setError(null);
    try {
      const u = await billing.purchase(plan);
      setUser(u);
      qc.invalidateQueries();
      goBack();
    } catch (e) {
      const msg = (e as { userCancelled?: boolean; message?: string }).userCancelled ? null : (e as Error).message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (user?.plan === 'PREMIUM') {
    return (
      <LinearGradient colors={gradients.premium} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, padding: space(6), justifyContent: 'center', gap: space(4), alignItems: 'center' }}>
          <Icon name="diamond" size={56} color="#FDE68A" />
          <T v="h1" color={colors.white} style={{ textAlign: 'center' }}>
            Você já é Premium 💎
          </T>
          {user.premiumUntil && (
            <T v="body" color="rgba(255,255,255,0.8)">
              Acesso ativo até {new Date(user.premiumUntil).toLocaleDateString('pt-BR')}
            </T>
          )}
          <Button title="Voltar" variant="gold" onPress={() => goBack()} style={{ alignSelf: 'stretch' }} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={gradients.premium} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: space(5), paddingBottom: 0 }}>
          <Pressable hitSlop={12} onPress={() => goBack()} style={styles.close}>
            <Icon name="close" size={22} color={colors.white} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.badge}>
            <Icon name="diamond" size={30} color="#FDE68A" />
          </View>
          <T v="h1" color={colors.white} style={{ textAlign: 'center' }}>
            Renda+ Premium
          </T>
          <T v="body" color="rgba(255,255,255,0.8)" style={{ textAlign: 'center' }}>
            {reason ?? 'Tudo o que você precisa para transformar renda extra em renda de verdade.'}
          </T>

          <View style={{ gap: space(3), alignSelf: 'stretch' }}>
            {(p?.benefits ?? []).map((b) => (
              <View key={b} style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
                <View style={styles.check}>
                  <Icon name="checkmark" size={14} color="#1E1B4B" />
                </View>
                <T v="body" color={colors.white} style={{ flex: 1 }}>
                  {b}
                </T>
              </View>
            ))}
          </View>

          <View style={{ gap: space(3), alignSelf: 'stretch' }}>
            {(['yearly', 'monthly'] as const).map((id) => {
              const on = plan === id;
              const perMonth = id === 'yearly' && p ? money(p.yearly.price / 12, true) : null;
              return (
                <Pressable key={id} onPress={() => setPlan(id)} style={[styles.plan, on && styles.planOn]}>
                  <Icon name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? '#FDE68A' : 'rgba(255,255,255,0.6)'} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <T v="title" color={colors.white}>
                        {p?.[id].label}
                      </T>
                      {id === 'yearly' && p?.yearly.badge && (
                        <View style={styles.save}>
                          <T v="caption" color="#1E1B4B" style={{ fontFamily: font.bold, fontSize: 11 }}>
                            {p.yearly.badge}
                          </T>
                        </View>
                      )}
                    </View>
                    {perMonth && (
                      <T v="caption" color="rgba(255,255,255,0.7)">
                        equivale a {perMonth}/mês
                      </T>
                    )}
                  </View>
                  <T v="title" color={colors.white} style={{ fontFamily: font.bold }}>
                    {priceOf(id)}
                    <T v="caption" color="rgba(255,255,255,0.7)">
                      {id === 'yearly' ? '/ano' : '/mês'}
                    </T>
                  </T>
                </Pressable>
              );
            })}
          </View>
          {error && <ErrorBox message={error} />}
        </ScrollView>

        <View style={{ padding: space(5), gap: space(3), maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <Button title="Assinar agora" variant="gold" iconRight="arrow-forward" loading={loading} onPress={buy} />
          {!billing.available && (
            <T v="caption" color="rgba(255,255,255,0.7)" style={{ textAlign: 'center' }}>
              Modo demonstração: ativa o Premium por 30 dias, sem cobrança.
            </T>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space(5) }}>
            <Pressable
              onPress={async () => {
                await billing.restore().catch(() => {});
                await refreshMe().catch(() => {});
              }}
            >
              <T v="caption" color="rgba(255,255,255,0.8)" style={{ textDecorationLine: 'underline' }}>
                Restaurar compras
              </T>
            </Pressable>
          </View>
          <T v="caption" color="rgba(255,255,255,0.55)" style={{ textAlign: 'center', fontSize: 11 }}>
            Cobrança pela sua conta da App Store/Google Play. Renovação automática; cancele quando quiser nas configurações da loja.
          </T>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  content: { padding: space(6), paddingTop: 0, gap: space(5), alignItems: 'center', maxWidth: 560, width: '100%', alignSelf: 'center' },
  badge: { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(253,230,138,0.15)', alignItems: 'center', justifyContent: 'center' },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderRadius: radius.lg, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)' },
  planOn: { borderColor: '#FDE68A', backgroundColor: 'rgba(253,230,138,0.1)' },
  save: { backgroundColor: '#FDE68A', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
});
