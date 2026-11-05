/**
 * Vocabulário controlado do app. O app mobile busca isto em GET /meta,
 * então quiz, filtros e rótulos ficam com uma única fonte da verdade.
 */

export const SKILLS = {
  escrita: { label: 'Escrita e revisão', icon: 'create-outline' },
  design: { label: 'Design / Canva', icon: 'color-palette-outline' },
  video: { label: 'Edição de vídeo', icon: 'film-outline' },
  programacao: { label: 'Programação', icon: 'code-slash-outline' },
  idiomas: { label: 'Idiomas (inglês, espanhol…)', icon: 'language-outline' },
  ensino: { label: 'Ensinar / explicar', icon: 'school-outline' },
  vendas: { label: 'Vendas e negociação', icon: 'pricetags-outline' },
  redes_sociais: { label: 'Redes sociais', icon: 'logo-instagram' },
  marketing_digital: { label: 'Marketing / anúncios', icon: 'megaphone-outline' },
  atendimento: { label: 'Atendimento ao cliente', icon: 'chatbubbles-outline' },
  organizacao: { label: 'Organização / administrativo', icon: 'folder-open-outline' },
  analise: { label: 'Raciocínio lógico / análise', icon: 'analytics-outline' },
  cozinha: { label: 'Cozinhar', icon: 'restaurant-outline' },
  cuidados: { label: 'Cuidar de pessoas ou pets', icon: 'heart-outline' },
  reparos: { label: 'Reparos e manutenção', icon: 'construct-outline' },
  limpeza: { label: 'Limpeza e organização da casa', icon: 'sparkles-outline' },
  fotografia: { label: 'Fotografia', icon: 'camera-outline' },
  beleza: { label: 'Beleza e estética', icon: 'cut-outline' },
  artesanato: { label: 'Artesanato / arte', icon: 'brush-outline' },
} as const;

export const ASSETS = {
  computador: { label: 'Computador ou notebook', icon: 'laptop-outline' },
  smartphone: { label: 'Smartphone', icon: 'phone-portrait-outline' },
  carro: { label: 'Carro', icon: 'car-outline' },
  moto: { label: 'Moto', icon: 'bicycle-outline' },
  bicicleta: { label: 'Bicicleta', icon: 'bicycle-outline' },
  cnh: { label: 'CNH com EAR (motorista)', icon: 'card-outline' },
  quarto_extra: { label: 'Quarto ou imóvel livre', icon: 'bed-outline' },
  camera: { label: 'Câmera boa (ou celular top)', icon: 'aperture-outline' },
  ferramentas: { label: 'Ferramentas', icon: 'hammer-outline' },
} as const;

export const CATEGORIES = {
  FREELANCE: { label: 'Freelance', icon: 'briefcase-outline' },
  ENSINO: { label: 'Aulas', icon: 'school-outline' },
  CONTEUDO: { label: 'Conteúdo', icon: 'videocam-outline' },
  AFILIADOS: { label: 'Afiliados', icon: 'link-outline' },
  ECOMMERCE: { label: 'Vendas online', icon: 'storefront-outline' },
  MICROTAREFAS: { label: 'Microtarefas & IA', icon: 'hardware-chip-outline' },
  ENTREGAS_MOBILIDADE: { label: 'Entregas & corridas', icon: 'navigate-outline' },
  SERVICOS_LOCAIS: { label: 'Serviços locais', icon: 'home-outline' },
  ALUGUEL_ATIVOS: { label: 'Aluguel de bens', icon: 'key-outline' },
  ALIMENTACAO: { label: 'Comida caseira', icon: 'fast-food-outline' },
} as const;

export const MODES = {
  ONLINE: { label: 'De casa (online)', icon: 'wifi-outline' },
  PRESENCIAL: { label: 'Na rua (presencial)', icon: 'walk-outline' },
  HIBRIDO: { label: 'Os dois', icon: 'swap-horizontal-outline' },
} as const;

export const ENGLISH_LEVELS = ['Nenhum', 'Básico', 'Intermediário', 'Avançado'] as const;
export const EXPERIENCE_LEVELS = ['Nunca fiz renda extra', 'Já fiz algumas vezes', 'Tenho experiência'] as const;

export type SkillKey = keyof typeof SKILLS;
export type AssetKey = keyof typeof ASSETS;

export const SKILL_KEYS = Object.keys(SKILLS) as SkillKey[];
export const ASSET_KEYS = Object.keys(ASSETS) as AssetKey[];

/** Regras do plano gratuito (aplicadas no servidor). */
export const FREE_LIMITS = {
  activeTracks: 2,
  earningsHistoryMonths: 3,
} as const;
