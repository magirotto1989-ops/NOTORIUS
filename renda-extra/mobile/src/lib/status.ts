import type { TrackStatus } from './types';
import { colors } from '@/theme';

export const STATUS: Record<TrackStatus, { label: string; icon: string; bg: string; fg: string }> = {
  SAVED: { label: 'Salva', icon: 'bookmark', bg: '#F1F5F3', fg: colors.textMuted },
  IN_PROGRESS: { label: 'Em andamento', icon: 'play', bg: colors.brandTint, fg: colors.brandDark },
  EARNING: { label: 'Já faturando', icon: 'cash', bg: colors.goldSoft, fg: colors.warning },
  PAUSED: { label: 'Pausada', icon: 'pause', bg: '#F1F5F3', fg: colors.textMuted },
};
