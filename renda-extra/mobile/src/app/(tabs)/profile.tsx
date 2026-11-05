import { useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useMeta } from '@/lib/queries';
import { money } from '@/lib/format';
import { Button, Card, Divider, ErrorBox, Icon, Input, Pill, Screen, SectionHeader, T } from '@/components/ui';
import { PremiumBanner } from '@/components/PremiumBanner';
import { colors, font, radius, space } from '@/theme';

type AdminStats = {
  users: number;
  premium: number;
  conversionPct: number;
  quizCompletionPct: number;
  clicksLast30d: { platform: string; affiliate: boolean; clicks: number }[];
  earningsTrackedBRL: number;
};

export default function Profile() {
  const { user, profile, logout, refreshMe } = useAuth();
  const meta = useMeta();
  const [goal, setGoal] = useState(String(user?.monthlyGoal ?? ''));
  const [editingGoal, setEditingGoal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const admin = useQuery({ queryKey: ['admin-stats'], queryFn: () => api<AdminStats>('/admin/stats'), enabled: user?.role === 'ADMIN' });

  if (!user) return null;

  async function saveGoal() {
    const v = Number(goal.replace(/\D/g, ''));
    if (!v || v < 50) return setErr('Meta mínima de R$ 50');
    setErr(null);
    await api('/me', { method: 'PATCH', body: { monthlyGoal: v } });
    await refreshMe();
    setEditingGoal(false);
  }

  async function exportData() {
    const data = await api('/me/export');
    const text = JSON.stringify(data, null, 2);
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meus-dados-renda-mais.json';
      a.click();
    } else await Share.share({ title: 'Meus dados (Renda+)', message: text });
    setMsg('Seus dados foram exportados.');
  }

  async function deleteAccount() {
    setErr(null);
    try {
      await api('/me', { method: 'DELETE', body: { password } });
      await logout();
      router.replace('/welcome');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Não foi possível excluir');
    }
  }

  const initial = user.name.trim()[0]?.toUpperCase() ?? '?';

  return (
    <Screen contentStyle={{ maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(4) }}>
        <View style={styles.avatar}>
          <T v="h2" color={colors.white}>
            {initial}
          </T>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T v="h2">{user.name}</T>
          <T v="small" color={colors.textMuted}>
            {user.email}
          </T>
          {user.plan === 'PREMIUM' ? <Pill label="Premium" icon="diamond" bg={colors.goldSoft} fg={colors.warning} /> : <Pill label="Plano grátis" icon="leaf" />}
        </View>
      </View>

      {user.plan !== 'PREMIUM' && <PremiumBanner />}
      {msg && (
        <Card style={{ backgroundColor: colors.brandTint }}>
          <T v="small" color={colors.brandDark}>
            {msg}
          </T>
        </Card>
      )}
      {err && <ErrorBox message={err} />}

      <SectionHeader title="Seu plano de renda" />
      <Card style={{ gap: space(3) }}>
        <View style={styles.row}>
          <Icon name="flag-outline" color={colors.brand} />
          <View style={{ flex: 1 }}>
            <T v="caption" color={colors.textMuted}>
              Meta mensal
            </T>
            {editingGoal ? (
              <Input value={goal} onChangeText={setGoal} keyboardType="number-pad" icon="cash-outline" autoFocus onSubmitEditing={saveGoal} />
            ) : (
              <T v="title">{money(user.monthlyGoal)}</T>
            )}
          </View>
          <Button title={editingGoal ? 'Salvar' : 'Editar'} size="sm" variant="secondary" onPress={editingGoal ? saveGoal : () => setEditingGoal(true)} />
        </View>
        <Divider />
        {profile && meta.data && (
          <View style={{ gap: 6 }}>
            <T v="caption" color={colors.textMuted}>
              Seu perfil
            </T>
            <T v="small">
              {meta.data.modes[profile.modePref].label} · {profile.hoursPerWeek}h/semana · inglês {meta.data.englishLevels[profile.englishLevel].toLowerCase()} · investe até{' '}
              {money(profile.capitalBRL)}
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {profile.skills.map((s) => (
                <Pill key={s} label={meta.data!.skills[s]?.label ?? s} />
              ))}
            </View>
          </View>
        )}
        <Button title="Refazer o quiz" icon="refresh" variant="ghost" size="md" onPress={() => router.push('/quiz')} />
      </Card>

      {user.role === 'ADMIN' && admin.data && (
        <>
          <SectionHeader title="Painel do negócio (admin)" />
          <Card style={{ gap: space(3) }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
              <Kpi label="Usuários" value={String(admin.data.users)} />
              <Kpi label="Premium" value={`${admin.data.premium} (${admin.data.conversionPct}%)`} />
              <Kpi label="Fizeram o quiz" value={`${admin.data.quizCompletionPct}%`} />
              <Kpi label="Renda registrada" value={money(admin.data.earningsTrackedBRL)} />
            </View>
            <T v="caption" color={colors.textMuted}>
              Cliques em plataformas (30 dias)
            </T>
            {admin.data.clicksLast30d.slice(0, 6).map((c) => (
              <View key={c.platform + c.affiliate} style={styles.row}>
                <T v="small" style={{ flex: 1 }}>
                  {c.platform} {c.affiliate ? '· afiliado' : ''}
                </T>
                <T v="small" style={{ fontFamily: font.bold }}>
                  {c.clicks}
                </T>
              </View>
            ))}
            <T v="caption" color={colors.textSoft}>
              Cadastre links de afiliado em PATCH /admin/platforms/:id (veja /docs na API).
            </T>
          </Card>
        </>
      )}

      <SectionHeader title="Conta" />
      <Card style={{ paddingVertical: space(1) }}>
        <Row icon="diamond-outline" label={user.plan === 'PREMIUM' ? 'Minha assinatura' : 'Conhecer o Premium'} onPress={() => router.push('/paywall')} />
        <Divider />
        <Row
          icon="shield-checkmark-outline"
          label="Como evitar golpes"
          onPress={() => setMsg('Regra de ouro: nenhuma plataforma séria cobra para você trabalhar. Desconfie de promessas de ganho garantido, pedidos de Pix para "liberar" tarefas e links fora dos sites oficiais.')}
        />
        <Divider />
        <Row icon="download-outline" label="Exportar meus dados (LGPD)" onPress={exportData} />
        <Divider />
        <Row icon="mail-outline" label="Fale com a gente" onPress={() => Linking.openURL('mailto:contato@rendamais.app')} />
        <Divider />
        <Row icon="log-out-outline" label="Sair" onPress={async () => (await logout(), router.replace('/welcome'))} />
      </Card>

      <Card style={{ gap: space(3) }}>
        {!deleting ? (
          <Pressable onPress={() => setDeleting(true)} style={styles.row}>
            <Icon name="trash-outline" color={colors.danger} />
            <T v="title" color={colors.danger} style={{ flex: 1 }}>
              Excluir minha conta
            </T>
          </Pressable>
        ) : (
          <>
            <T v="title" color={colors.danger}>
              Excluir conta permanentemente
            </T>
            <T v="small" color={colors.textMuted}>
              Todos os seus dados (perfil, trilhas e ganhos) serão apagados. Se tiver assinatura, cancele também na loja.
            </T>
            <Input value={password} onChangeText={setPassword} placeholder="Confirme sua senha" secureTextEntry icon="lock-closed-outline" />
            <View style={{ flexDirection: 'row', gap: space(3) }}>
              <Button title="Cancelar" variant="ghost" size="md" onPress={() => setDeleting(false)} style={{ flex: 1 }} />
              <Button title="Excluir" variant="danger" size="md" onPress={deleteAccount} disabled={!password} style={{ flex: 1 }} />
            </View>
          </>
        )}
      </Card>

      <T v="caption" color={colors.textSoft} style={{ textAlign: 'center' }}>
        Renda+ v1.0 · {meta.data?.disclaimer}
      </T>
    </Screen>
  );
}

function Row({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { paddingVertical: space(4) }, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} color={colors.text} />
      <T v="title" style={{ flex: 1, fontFamily: font.medium }}>
        {label}
      </T>
      <Icon name="chevron-forward" color={colors.textSoft} size={18} />
    </Pressable>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', padding: space(3), borderRadius: radius.md, backgroundColor: colors.bg }}>
      <T v="caption" color={colors.textMuted}>
        {label}
      </T>
      <T v="title" style={{ fontFamily: font.bold }}>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
});
