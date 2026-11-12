import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, T } from './ui';
import { colors, gradients, radius, space } from '@/theme';

export function PremiumBanner({ title = 'Desbloqueie o plano completo', text = 'Trilhas completas com roteiros e modelos, trilhas ilimitadas e relatório para o IR.' }: { title?: string; text?: string }) {
  return (
    <Pressable onPress={() => router.push('/paywall')}>
      <LinearGradient colors={gradients.premium} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.lg, padding: space(5), flexDirection: 'row', gap: space(4), alignItems: 'center' }}>
        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(253,230,138,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="diamond" size={24} color="#FDE68A" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="title" color={colors.white}>
            {title}
          </T>
          <T v="small" color="rgba(255,255,255,0.78)">
            {text}
          </T>
        </View>
        <Icon name="chevron-forward" color={colors.white} />
      </LinearGradient>
    </Pressable>
  );
}
