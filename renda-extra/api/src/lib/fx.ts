/**
 * Cotação USD→BRL com cache em memória (6h) e fallback configurável.
 * Fonte padrão: AwesomeAPI (gratuita, sem chave).
 */
let cache: { rate: number; at: number } | null = null;
const TTL = 6 * 60 * 60 * 1000;

export async function getUsdBrl(opts: { url: string; fallback: number; offline?: boolean }): Promise<number> {
  if (cache && Date.now() - cache.at < TTL) return cache.rate;
  if (opts.offline) return opts.fallback;
  try {
    const res = await fetch(opts.url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { USDBRL?: { bid?: string } };
    const rate = Number(json.USDBRL?.bid);
    if (!Number.isFinite(rate) || rate < 1 || rate > 20) throw new Error('cotação inválida');
    cache = { rate, at: Date.now() };
    return rate;
  } catch {
    cache = { rate: opts.fallback, at: Date.now() - TTL + 10 * 60 * 1000 }; // tenta de novo em 10 min
    return opts.fallback;
  }
}

export function resetFxCache() {
  cache = null;
}
