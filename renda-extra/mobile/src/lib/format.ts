const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brl2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const money = (v: number, cents = false) => (cents ? brl2 : brl).format(v);
export const moneyIn = (v: number, currency: 'BRL' | 'USD', cents = false) =>
  currency === 'USD' ? (cents ? `US$ ${v.toFixed(2)}` : usd.format(v).replace('$', 'US$ ')) : money(v, cents);

export const range = (min: number, max: number, fmt: (n: number) => string = (n) => money(n)) =>
  min === max ? fmt(min) : min === 0 ? `até ${fmt(max)}` : `${fmt(min)}–${fmt(max).replace(/^R\$\s?|^US\$\s?/, '')}`;

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const monthShort = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1];
export const monthLong = (ym: string) => `${MONTHS_FULL[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const shortDate = (iso: string) => `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const thisMonth = () => todayISO().slice(0, 7);
export const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const payDays = (d: number) => (d <= 1 ? 'no mesmo dia' : d <= 7 ? 'em até 1 semana' : d <= 30 ? `~${Math.round(d / 7)} semanas` : `~${Math.round(d / 30)} ${d >= 45 ? 'meses' : 'mês'}`);

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

export const firstName = (name: string) => name.trim().split(/\s+/)[0];
