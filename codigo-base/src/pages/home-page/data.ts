export const logoColor = "/Athen.png";
export const logoGhost = "/Athen_ghost.png";

export interface Category {
  icon: string;
  label: string;
}

export interface Course {
  title: string;
  author: string;
  xp: number;
  students: number;
  badge: string;
  bg: string;
  accent: string;
}

export interface HowItWorksStep {
  step: string;
  title: string;
  desc: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface Testimonial {
  name: string;
  handle: string;
  avatar: string;
  text: string;
  xp: string;
}

export const NAV_LINKS = ["Explorar", "Comunidade", "Ranking", "Criar Curso"];

export const CATEGORIES: Category[] = [
  { icon: "🧬", label: "Ciências" },
  { icon: "🎨", label: "Arte & Design" },
  { icon: "💻", label: "Tecnologia" },
  { icon: "📚", label: "Literatura" },
  { icon: "🎵", label: "Música" },
  { icon: "🌍", label: "Idiomas" },
  { icon: "🧮", label: "Matemática" },
  { icon: "🏛️", label: "História" },
];

export const COURSES: Course[] = [
  {
    title: "Introdução à Astronomia",
    author: "stella_cosmo",
    xp: 1200,
    students: 3847,
    badge: "⭐ Em Alta",
    bg: "#54318C",
    accent: "#FFCC00",
  },
  {
    title: "Python para Iniciantes",
    author: "dev_lucas",
    xp: 950,
    students: 7210,
    badge: "🔥 Popular",
    bg: "#FFCC00",
    accent: "#54318C",
  },
  {
    title: "História da Arte Medieval",
    author: "arte_viva",
    xp: 780,
    students: 2103,
    badge: "🆕 Novo",
    bg: "#A486D5",
    accent: "#FFEB99",
  },
  {
    title: "Lógica e Pensamento Crítico",
    author: "filosofia_on",
    xp: 1100,
    students: 5589,
    badge: "🏆 Top Avaliado",
    bg: "#FFDE5C",
    accent: "#54318C",
  },
];

export const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    step: "01",
    title: "Explore cursos da comunidade",
    desc: "Descubra milhares de cursos criados por pessoas apaixonadas pelos seus temas.",
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

export const STATS: Stat[] = [
  { value: "48.000+", label: "Alunos ativos" },
  { value: "12.500+", label: "Cursos criados" },
  { value: "320+", label: "Categorias" },
  { value: "99%", label: "Satisfação" },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Marina Souza",
    handle: "@marinasouza",
    avatar: "M",
    text: "Comecei como aluna e em três meses já lancei meu primeiro curso sobre permacultura. A comunidade é incrível!",
    xp: "Nível 12 · 8.400 XP",
  },
  {
    name: "Carlos Henrique",
    handle: "@carlosdev",
    avatar: "C",
    text: "A gamificação faz toda a diferença. Nunca aprendi tanto em tão pouco tempo. Virei viciado em subir de nível.",
    xp: "Nível 18 · 15.200 XP",
  },
  {
    name: "Fernanda Lima",
    handle: "@fernandalima",
    avatar: "F",
    text: "O que me surpreendeu foi a qualidade dos cursos feitos por pessoas comuns. Muito melhor que plataformas tradicionais.",
    xp: "Nível 9 · 5.800 XP",
  },
];
