// Conteúdo ESTÁTICO da home (identidade visual, navegação e textos editoriais).
// Tudo que é dado de verdade (cursos, categorias, números, ranking) vem do Supabase via services.ts.

export const logoColor = "/Athen.png";
export const logoGhost = "/Athen_ghost.png";

// Ajuste aqui se as rotas do seu app forem diferentes.
export const ROUTES = {
  login: "/login-page",
  register: "/register-page",
  explore: "/explorar",
  course: (slug: string) => `/curso/${slug}`,
};

// ---------------------------------------------------------------------------
// Tipos usados pelos componentes (já no formato da UI, não no formato das tabelas)
// ---------------------------------------------------------------------------

export interface HomeStats {
  students: number;
  courses: number;
  categories: number;
  avgRating: number | null;
}

export interface Category {
  label: string; // valor real de courses.category (usado no filtro)
  icon: string;
  count: number;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  category: string | null;
  coverUrl: string | null;
  xp: number;
  students: number;
  badge: string;
  bg: string;
  accent: string;
}

export interface Learner {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  level: number;
  xp: number;
  rank: number | null;
}

export interface Testimonial {
  id: string;
  text: string | null;
  name: string;
  username: string;
  level: number;
  xp: number;
  rating: number | null; // nota da avaliação (null quando vem do ranking)
  courseTitle: string | null;
  rank: number | null;
}

export interface HowItWorksStep {
  step: string;
  title: string;
  desc: string;
}

// ---------------------------------------------------------------------------
// Estático
// ---------------------------------------------------------------------------

// Ajuste os destinos conforme as rotas reais do app. Todos exigem login (ver navigation.ts).
export const NAV_LINKS = [
  { label: "Explorar", to: ROUTES.explore },
  { label: "Comunidade", to: "/comunidade" },
  { label: "Ranking", to: "/ranking" },
  { label: "Criar Curso", to: "/criar-curso" },
];

export const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    step: "01",
    title: "Explore cursos da comunidade",
    desc: "Descubra cursos criados por pessoas apaixonadas pelos seus temas.",
  },
  {
    step: "02",
    title: "Aprenda e ganhe XP",
    desc: "Complete lições, responda desafios e acumule pontos de experiência a cada avanço.",
  },
  {
    step: "03",
    title: "Suba de nível e desbloqueie conquistas",
    desc: "Evolua seu perfil, conquiste medalhas e apareça no ranking global da plataforma.",
  },
  {
    step: "04",
    title: "Crie e compartilhe seu curso",
    desc: "Use nosso editor intuitivo para montar seu próprio curso e contribuir com a comunidade.",
  },
];

// Paleta dos cards de curso (cicla pelo índice)
export const COURSE_PALETTE = [
  { bg: "#54318C", accent: "#FFCC00" },
  { bg: "#FFCC00", accent: "#54318C" },
  { bg: "#A486D5", accent: "#FFEB99" },
  { bg: "#FFDE5C", accent: "#54318C" },
];

// Ícone da categoria a partir do nome (as categorias são texto livre em courses.category)
export const CATEGORY_ICONS: [RegExp, string][] = [
  [/cienc|biolog|quimic|fisic|astronom/, "🧬"],
  [/arte|design|desenho|foto/, "🎨"],
  [/tecnolog|program|desenvolv|dados|data|comput|python|web|java|react/, "💻"],
  [/literat|leitura|escrita|portugues|redacao/, "📚"],
  [/music/, "🎵"],
  [/idioma|ingles|espanhol|frances|lingua/, "🌍"],
  [/matemat|calcul|logica|estatist/, "🧮"],
  [/histor|filosof|geograf|sociolog/, "🏛️"],
];
export const DEFAULT_CATEGORY_ICON = "📘";
