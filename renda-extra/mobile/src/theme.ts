import { Platform } from 'react-native';

export const colors = {
  brand: '#059669',
  brandDark: '#047857',
  brandDeep: '#064E3B',
  brandSoft: '#D1FAE5',
  brandTint: '#ECFDF5',
  accent: '#6366F1',
  gold: '#F59E0B',
  goldSoft: '#FEF3C7',
  bg: '#F5F7F6',
  card: '#FFFFFF',
  text: '#0B1B14',
  textMuted: '#5B6B64',
  textSoft: '#8A9A93',
  border: '#E3E9E6',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  warning: '#B45309',
  warningSoft: '#FFF7ED',
  dollar: '#1D4ED8',
  dollarSoft: '#DBEAFE',
  white: '#FFFFFF',
} as const;

export const gradients = {
  brand: ['#047857', '#059669', '#10B981'] as const,
  hero: ['#064E3B', '#047857', '#0D9488'] as const,
  premium: ['#1E1B4B', '#4338CA', '#7C3AED'] as const,
  gold: ['#F59E0B', '#F97316'] as const,
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const space = (n: number) => n * 4;

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  black: 'Inter_800ExtraBold',
} as const;

export const shadow = Platform.select({
  web: { boxShadow: '0 6px 24px rgba(6, 78, 59, 0.08)' } as object,
  default: {
    shadowColor: '#064E3B',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
});
