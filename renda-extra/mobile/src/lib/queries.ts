import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Earning, EarningsSummary, Meta, OpportunityDetail, OpportunitySummary, TrackDetail, TrackListItem, TrackStatus } from './types';

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => api<Meta>('/meta'), staleTime: 60 * 60 * 1000 });

export type Filters = {
  q?: string;
  category?: string;
  mode?: string;
  currency?: string;
  maxStartup?: number;
  fastPay?: boolean;
  eligibleOnly?: boolean;
  sort?: string;
};

export function useOpportunities(f: Filters) {
  const qs = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== false) qs.set(k, String(v));
  });
  return useQuery({
    queryKey: ['opportunities', qs.toString()],
    queryFn: () => api<{ items: OpportunitySummary[]; total: number; personalized: boolean }>(`/opportunities?${qs}`),
    placeholderData: (prev) => prev,
  });
}

export const useRecommended = (enabled: boolean, limit = 10) =>
  useQuery({
    queryKey: ['recommended', limit],
    queryFn: () => api<{ items: OpportunitySummary[] }>(`/opportunities/recommended?limit=${limit}`),
    enabled,
  });

export const useOpportunity = (slug: string) =>
  useQuery({ queryKey: ['opportunity', slug], queryFn: () => api<OpportunityDetail>(`/opportunities/${slug}`) });

export const useTracks = () => useQuery({ queryKey: ['tracks'], queryFn: () => api<{ items: TrackListItem[] }>('/tracks') });

export const useTrack = (slug: string) => useQuery({ queryKey: ['track', slug], queryFn: () => api<TrackDetail>(`/tracks/${slug}`) });

export function useSetTrackStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, status }: { slug: string; status: TrackStatus | null }) =>
      status ? api(`/tracks/${slug}`, { method: 'PUT', body: { status } }) : api(`/tracks/${slug}`, { method: 'DELETE' }),
    onSuccess: (_d, { slug }) => {
      qc.invalidateQueries({ queryKey: ['tracks'] });
      qc.invalidateQueries({ queryKey: ['track', slug] });
      qc.invalidateQueries({ queryKey: ['opportunity', slug] });
    },
  });
}

export function useToggleStep(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stepId, done }: { stepId: string; done: boolean }) =>
      api(`/tracks/${slug}/steps/${stepId}`, { method: 'POST', body: { done } }),
    onMutate: async ({ stepId, done }) => {
      await qc.cancelQueries({ queryKey: ['track', slug] });
      const prev = qc.getQueryData<TrackDetail>(['track', slug]);
      if (prev) {
        const steps = prev.steps.map((s) => (s.id === stepId ? { ...s, done } : s));
        const completed = steps.filter((s) => s.done).length;
        qc.setQueryData<TrackDetail>(['track', slug], {
          ...prev,
          steps,
          progress: { ...prev.progress, completed, pct: Math.round((completed / steps.length) * 100) },
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['track', slug], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tracks'] }),
  });
}

export const useEarnings = (month: string) =>
  useQuery({ queryKey: ['earnings', month], queryFn: () => api<{ items: Earning[] }>(`/earnings?month=${month}`), retry: false });

export const useEarningsSummary = (month: string) =>
  useQuery({ queryKey: ['earnings-summary', month], queryFn: () => api<EarningsSummary>(`/earnings/summary?month=${month}`), retry: false });

export function useInvalidateEarnings() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['earnings'] });
    qc.invalidateQueries({ queryKey: ['earnings-summary'] });
    qc.invalidateQueries({ queryKey: ['tracks'] });
  };
}
