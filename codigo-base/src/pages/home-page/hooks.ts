import { useCallback, useEffect, useState } from "react";
import type { Category, Course, HomeStats, Learner, Testimonial } from "./data";
import {
  fetchCategories,
  fetchCourses,
  fetchMyProfile,
  fetchStats,
  fetchTestimonials,
  fetchTopLearners,
  getSession,
  onAuthChange,
  signOut,
} from "./services";

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Executa `load` e acompanha loading/erro. `load` precisa ser estável (função de módulo ou useCallback).
// Não chama setState de forma síncrona no effect: o "loading" é derivado, comparando qual `load`
// gerou o resultado guardado com o `load` atual. Enquanto recarrega, o `data` anterior continua disponível.
function useQuery<T>(load: () => Promise<T>): QueryState<T> {
  const [result, setResult] = useState<{ source: (() => Promise<T>) | null; data: T | null; error: string | null }>({
    source: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => { if (!cancelled) setResult({ source: load, data, error: null }) })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ source: load, data: null, error: error instanceof Error ? error.message : "Erro ao carregar." });
      });
    return () => { cancelled = true };
  }, [load]);

  const settled = result.source === load;
  return { data: result.data, loading: !settled, error: settled ? result.error : null };
}

// Sessão do Supabase + perfil do usuário logado
export function useMe() {
  const [userId, setUserId] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    let active = true
    void getSession().then(({ data }) => {
      if (!active) return
      setUserId(data.session?.user?.id ?? null)
      setSessionReady(true)
    })
    const unsubscribe = onAuthChange((id) => setUserId(id))
    return () => { active = false; unsubscribe() }
  }, [])

  const loadProfile = useCallback(() => (userId ? fetchMyProfile(userId) : Promise.resolve(null)), [userId])
  const profile = useQuery<Learner | null>(loadProfile)

  return {
    ready: sessionReady,
    loggedIn: !!userId,
    profile: userId ? profile.data : null,
    signOut,
  }
}

export function useHomeData(category: string | null) {
  const loadCourses = useCallback(() => fetchCourses(category), [category])

  const stats: QueryState<HomeStats> = useQuery(fetchStats)
  const categories: QueryState<Category[]> = useQuery(fetchCategories)
  const courses: QueryState<Course[]> = useQuery(loadCourses)
  const learners: QueryState<Learner[]> = useQuery(fetchTopLearners)
  const testimonials: QueryState<Testimonial[]> = useQuery(fetchTestimonials)

  return { stats, categories, courses, learners, testimonials }
}
