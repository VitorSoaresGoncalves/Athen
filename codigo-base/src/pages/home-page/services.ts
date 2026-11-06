// Todas as requisições da home ficam aqui. Os componentes só recebem dados prontos.
//
// ⚠️ Ajuste este import conforme a posição da pasta home-page no seu projeto
// (no CrudConsole o caminho é '../lib/supabase').
import { supabase } from "../../lib/supabase";
import {
  CATEGORY_ICONS,
  COURSE_PALETTE,
  DEFAULT_CATEGORY_ICON,
  type Category,
  type Course,
  type HomeStats,
  type Learner,
  type Testimonial,
} from "./data";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

// As funções rpc abaixo são OPCIONAIS (ver home_public_data.sql). Se não existirem, ou se
// falharem, cada serviço cai para consultas diretas nas tabelas (que respeitam a RLS).
type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function tryRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { data, error } = await (supabase as unknown as RpcClient).rpc(fn, args);
    return error ? null : (data as T);
  } catch {
    return null;
  }
}

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const iconForCategory = (label: string) => {
  const key = normalize(label);
  return CATEGORY_ICONS.find(([pattern]) => pattern.test(key))?.[1] ?? DEFAULT_CATEGORY_ICON;
};

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

// ---------------------------------------------------------------------------
// Números gerais (hero + CTA)
// ---------------------------------------------------------------------------

export async function fetchStats(): Promise<HomeStats> {
  const viaRpc = await tryRpc<{ students: number; courses: number; categories: number; avg_rating: number | null }>("home_stats");
  if (viaRpc) {
    return {
      students: Number(viaRpc.students) || 0,
      courses: Number(viaRpc.courses) || 0,
      categories: Number(viaRpc.categories) || 0,
      avgRating: viaRpc.avg_rating === null ? null : Number(viaRpc.avg_rating),
    };
  }

  const [profiles, courses, reviews] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("courses").select("category").eq("status", "published").eq("visibility", "public"),
    supabase.from("reviews").select("rating"),
  ]);
  if (profiles.error) throw new Error(profiles.error.message);
  if (courses.error) throw new Error(courses.error.message);

  const categories = new Set((courses.data ?? []).map((c) => c.category?.trim()).filter(Boolean));
  return {
    students: profiles.count ?? 0,
    courses: courses.data?.length ?? 0,
    categories: categories.size,
    avgRating: average((reviews.data ?? []).map((r) => Number(r.rating))),
  };
}

// ---------------------------------------------------------------------------
// Categorias (derivadas dos cursos publicados)
// ---------------------------------------------------------------------------

export async function fetchCategories(): Promise<Category[]> {
  const viaRpc = await tryRpc<{ label: string; total: number }[]>("home_categories", { lim: 8 });
  if (viaRpc) return viaRpc.map((r) => ({ label: r.label, count: Number(r.total) || 0, icon: iconForCategory(r.label) }));

  const { data, error } = await supabase
    .from("courses")
    .select("category")
    .eq("status", "published")
    .eq("visibility", "public");
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const label = row.category?.trim();
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, 8)
    .map(([label, count]) => ({ label, count, icon: iconForCategory(label) }));
}

// ---------------------------------------------------------------------------
// Cursos em destaque
// ---------------------------------------------------------------------------

// XP total do curso = soma do xp_value das questões das aulas publicadas (curso → módulos → aulas → questões)
async function xpByCourse(courseIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const { data: modules } = await supabase.from("modules").select("id, course_id").in("course_id", courseIds);
  if (!modules?.length) return result;

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, module_id")
    .in("module_id", modules.map((m) => m.id))
    .eq("status", "published");
  if (!lessons?.length) return result;

  const { data: questions } = await supabase
    .from("questions")
    .select("lesson_id, xp_value")
    .in("lesson_id", lessons.map((l) => l.id));

  const courseOfModule = new Map<string, string>(modules.map((m): [string, string] => [m.id, m.course_id]));
  const courseOfLesson = new Map<string, string | undefined>(lessons.map((l): [string, string | undefined] => [l.id, courseOfModule.get(l.module_id)]));
  for (const q of questions ?? []) {
    const courseId = courseOfLesson.get(q.lesson_id);
    if (courseId) result.set(courseId, (result.get(courseId) ?? 0) + (Number(q.xp_value) || 0));
  }
  return result;
}

async function studentsByCourse(courseIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const viaRpc = await tryRpc<{ course_id: string; students: number }[]>("home_course_students", { course_ids: courseIds });
  if (viaRpc) {
    for (const row of viaRpc) result.set(row.course_id, Number(row.students) || 0);
    return result;
  }
  // Fallback: a RLS de enrollments é "self only", então aqui só enxergamos as matrículas do próprio usuário.
  const { data } = await supabase.from("enrollments").select("course_id").in("course_id", courseIds);
  for (const row of data ?? []) result.set(row.course_id, (result.get(row.course_id) ?? 0) + 1);
  return result;
}

interface CourseData {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  coverUrl: string | null;
  author: string | null;
  xp: number;
  students: number;
  rating: number | null;
  createdAt: string;
}

// Caminho principal: uma função no banco que devolve tudo pronto (funciona para visitantes sem login)
async function coursesViaRpc(category: string | null, limit: number): Promise<CourseData[] | null> {
  const rows = await tryRpc<
    { id: string; slug: string; title: string; category: string | null; cover_url: string | null; author: string | null; xp: number; students: number; avg_rating: number | null; created_at: string }[]
  >("home_featured_courses", { cat: category, lim: limit });
  if (!rows) return null;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    category: r.category,
    coverUrl: r.cover_url,
    author: r.author,
    xp: Number(r.xp) || 0,
    students: Number(r.students) || 0,
    rating: r.avg_rating === null ? null : Number(r.avg_rating),
    createdAt: r.created_at,
  }));
}

// Fallback: consultas diretas (dependem da RLS das tabelas)
async function coursesViaTables(category: string | null, limit: number): Promise<CourseData[]> {
  let query = supabase
    .from("courses")
    .select("id, slug, title, category, cover_url, creator_id, created_at")
    .eq("status", "published")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(24);
  if (category) query = query.eq("category", category);

  const { data: courses, error } = await query;
  if (error) throw new Error(error.message);
  if (!courses?.length) return [];

  const courseIds = courses.map((c) => c.id);
  const creatorIds = [...new Set(courses.map((c) => c.creator_id))];

  const [authors, xp, students, reviews] = await Promise.all([
    supabase.from("profiles").select("id, display_name, username").in("id", creatorIds),
    xpByCourse(courseIds),
    studentsByCourse(courseIds),
    supabase.from("reviews").select("course_id, rating").in("course_id", courseIds),
  ]);

  const authorOf = new Map((authors.data ?? []).map((p) => [p.id, String(p.username || p.display_name)]));
  const ratingsOf = new Map<string, number[]>();
  for (const r of reviews.data ?? []) ratingsOf.set(r.course_id, [...(ratingsOf.get(r.course_id) ?? []), Number(r.rating)]);

  return courses
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      category: c.category,
      coverUrl: c.cover_url,
      author: authorOf.get(c.creator_id) ?? null,
      xp: xp.get(c.id) ?? 0,
      students: students.get(c.id) ?? 0,
      rating: average(ratingsOf.get(c.id) ?? []),
      createdAt: c.created_at,
    }))
    .sort(
      (a, b) =>
        b.students - a.students ||
        (b.rating ?? 0) - (a.rating ?? 0) ||
        +new Date(b.createdAt) - +new Date(a.createdAt),
    )
    .slice(0, limit);
}

export async function fetchCourses(category: string | null, limit = 4): Promise<Course[]> {
  const items = (await coursesViaRpc(category, limit)) ?? (await coursesViaTables(category, limit));

  const topStudents = Math.max(0, ...items.map((i) => i.students));
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  return items.map((item, index) => {
    const isNew = Date.now() - new Date(item.createdAt).getTime() < thirtyDays;
    const badge =
      item.rating !== null && item.rating >= 4.5
        ? "🏆 Top Avaliado"
        : topStudents > 0 && item.students === topStudents
          ? "🔥 Popular"
          : isNew
            ? "🆕 Novo"
            : `${iconForCategory(item.category ?? "")} ${item.category ?? "Curso"}`;
    const palette = COURSE_PALETTE[index % COURSE_PALETTE.length];
    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      author: item.author,
      category: item.category,
      coverUrl: item.coverUrl,
      xp: item.xp,
      students: item.students,
      badge,
      bg: palette.bg,
      accent: palette.accent,
    };
  });
}

// ---------------------------------------------------------------------------
// Ranking / perfis
// ---------------------------------------------------------------------------

type ProfileRow = { id: string; display_name: string; username: string; bio: string | null; level: number; xp_global: number };

const toLearner = (p: ProfileRow, rank: number | null): Learner => ({
  id: p.id,
  name: p.display_name,
  username: p.username,
  bio: p.bio,
  level: Number(p.level) || 1,
  xp: Number(p.xp_global) || 0,
  rank,
});

export async function fetchTopLearners(limit = 3): Promise<Learner[]> {
  const viaRpc = await tryRpc<ProfileRow[]>("home_top_learners", { lim: limit });
  if (viaRpc) return viaRpc.map((p, i) => toLearner(p, i + 1));

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, username, bio, level, xp_global")
    .order("xp_global", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((p, i) => toLearner(p, i + 1));
}

// Depoimentos reais: avaliações com comentário + autor + curso avaliado
export async function fetchTestimonials(limit = 3): Promise<Testimonial[]> {
  const viaRpc = await tryRpc<
    { id: string; comment: string; rating: number; display_name: string; username: string; level: number; xp_global: number; course_title: string }[]
  >("home_featured_reviews", { lim: limit });
  if (viaRpc) {
    return viaRpc.map((r) => ({
      id: r.id,
      text: r.comment,
      name: r.display_name,
      username: r.username,
      level: Number(r.level) || 1,
      xp: Number(r.xp_global) || 0,
      rating: Number(r.rating),
      courseTitle: r.course_title,
      rank: null,
    }));
  }

  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("id, comment, rating, user_id, course_id")
    .eq("status", "published")
    .not("comment", "is", null)
    .order("rating", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);

  const valid = (reviews ?? []).filter((r) => r.comment?.trim());
  if (!valid.length) return [];

  const [profiles, courses] = await Promise.all([
    supabase.from("profiles").select("id, display_name, username, level, xp_global").in("id", [...new Set(valid.map((r) => r.user_id))]),
    supabase.from("courses").select("id, title").in("id", [...new Set(valid.map((r) => r.course_id))]),
  ]);
  const profileOf = new Map((profiles.data ?? []).map((p) => [p.id, p]));
  const titleOf = new Map((courses.data ?? []).map((c) => [c.id, c.title]));

  const items: Testimonial[] = [];
  for (const r of valid) {
    const p = profileOf.get(r.user_id);
    if (!p) continue;
    items.push({
      id: r.id,
      text: r.comment!.trim(),
      name: p.display_name,
      username: String(p.username),
      level: Number(p.level) || 1,
      xp: Number(p.xp_global) || 0,
      rating: Number(r.rating),
      courseTitle: titleOf.get(r.course_id) ?? null,
      rank: null,
    });
  }
  return items.slice(0, limit);
}

// Perfil do usuário logado + posição dele no ranking global
export async function fetchMyProfile(userId: string): Promise<Learner | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, username, bio, level, xp_global")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).gt("xp_global", data.xp_global);
  return toLearner(data, count === null ? null : count + 1);
}

export const signOut = () => supabase.auth.signOut();
export const getSession = () => supabase.auth.getSession();
export const onAuthChange = (callback: (userId: string | null) => void) => {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session?.user?.id ?? null));
  return () => data.subscription.unsubscribe();
};
