import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon, T } from '@/components/ui';
import { colors, font, gradients, radius, space } from '@/theme';

const FEATURES = [
  { icon: 'sparkles', title: 'Match com seu perfil', text: 'Um quiz de 2 minutos ranqueia 30+ formas reais de renda extra para você.' },
  { icon: 'map', title: 'Passo a passo', text: 'Trilhas práticas para sair do zero ao primeiro pagamento.' },
  { icon: 'trending-up', title: 'Controle de ganhos', text: 'Registre o que entra, acompanhe a meta e veja o que rende mais.' },
];

export default function Welcome() {
  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, padding: space(6), justifyContent: 'space-between', maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: space(4) }}>
          <View style={styles.logo}>
            <T v="h3" color={colors.brandDeep} style={{ fontFamily: font.black }}>
              R+
            </T>
          </View>
          <T v="h3" color={colors.white}>
            Renda+
          </T>
        </View>

        <View style={{ gap: space(4) }}>
          <T v="h1" color={colors.white} style={{ fontSize: 38, lineHeight: 44 }}>
            Sua renda extra,{'\n'}do jeito <T v="h1" color="#FDE68A" style={{ fontSize: 38, lineHeight: 44 }}>certo</T>.
          </T>
          <T v="body" color="rgba(255,255,255,0.82)" style={{ fontSize: 17, lineHeight: 25 }}>
            Descubra as oportunidades que combinam com seu tempo, habilidades e bolso — de casa ou na rua, em real ou em dólar.
          </T>

          <View style={{ gap: space(3), marginTop: space(2) }}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Icon name={f.icon} size={20} color="#FDE68A" />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="title" color={colors.white}>
                    {f.title}
                  </T>
                  <T v="small" color="rgba(255,255,255,0.75)">
                    {f.text}
                  </T>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ gap: space(3), marginBottom: space(2) }}>
          <Button title="Começar grátis" variant="gold" iconRight="arrow-forward" onPress={() => router.push('/register')} />
          <Button title="Já tenho conta" variant="ghost" onPress={() => router.push('/login')} style={{ borderColor: 'rgba(255,255,255,0.35)' }} />
          <T v="caption" color="rgba(255,255,255,0.6)" style={{ textAlign: 'center' }}>
            Sem promessas milagrosas: só oportunidades reais, com números honestos.
          </T>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' },
  feature: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.08)' },
  featureIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(253,230,138,0.15)', alignItems: 'center', justifyContent: 'center' },
});
