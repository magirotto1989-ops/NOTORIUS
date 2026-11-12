import { describe, expect, it } from 'vitest';
import { ONLINE } from '../prisma/data/online.js';
import { LOCAL } from '../prisma/data/local.js';

/**
 * Auditoria de plataformas (nov/2026): estas foram reprovadas e não podem voltar
 * ao catálogo sem nova verificação. Motivos em docs/auditoria-plataformas-2026-11.md.
 */
const REPROVADAS = ['Elo7', 'YouGov', 'Lalamove', 'inDrive', 'Superprof', 'Profes', 'Cambly', 'DataAnnotation', 'Booking.com'];

const all = [...ONLINE, ...LOCAL];

describe('catálogo', () => {
  it('não contém plataformas reprovadas na auditoria', () => {
    const names = all.flatMap((o) => o.platforms.map((p) => p.name));
    for (const r of REPROVADAS) expect(names, r).not.toContain(r);
  });

  it('toda oportunidade tem ao menos uma plataforma com link https', () => {
    for (const o of all) {
      expect(o.platforms.length, o.slug).toBeGreaterThan(0);
      for (const p of o.platforms) expect(p.url, `${o.slug}/${p.name}`).toMatch(/^https:\/\//);
    }
  });

  it('slugs são únicos', () => {
    const slugs = all.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
