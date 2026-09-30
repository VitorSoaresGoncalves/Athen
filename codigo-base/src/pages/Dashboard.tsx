import { useEffect, useMemo, useRef, useState } from "react";
import "./Dashboard.css";
import { aulaRepository, concluiRepository, cursoRepository, moduloRepository } from "../data/repositories";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type Curso = Database["public"]["Tables"]["Curso"]["Row"];
type Modulo = Database["public"]["Tables"]["Modulo"]["Row"];
type Aula = Database["public"]["Tables"]["Aula"]["Row"];
type ModuleTheme = { primary: string; background: string; muted: string; shadow: string };
type DashboardModule = Modulo & { aulas: Aula[]; theme: ModuleTheme };
type TrailItem = { type: "module"; module: DashboardModule } | { type: "lesson"; module: DashboardModule; aula: Aula };
interface DashboardProps { courseId?: string }

// cor, tema do módulo e geometria da trilha.
const FALLBACK_COLORS = ["#06b6d4", "#22c55e", "#a855f7", "#f97316", "#eab308"];
function normalizeColor(color: string | null | undefined, index: number) {
  const candidate = color?.trim();
  return candidate && /^#[0-9a-fA-F]{3,8}$/.test(candidate) ? candidate : FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}
function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((part) => `${part}${part}`).join("") : normalized;
  if (value.length !== 6) return `rgba(6, 182, 212, ${alpha})`;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
function createTheme(module: Modulo, index: number): ModuleTheme {
  const primary = normalizeColor(module.Cor_Tema, index);
  return {
    primary,
    background: `radial-gradient(ellipse at 50% 58%, ${hexToRgba(primary, 0.34)} 0%, #140a2b 72%, #100721 100%)`,
    muted: hexToRgba(primary, 0.42),
    shadow: hexToRgba(primary, 0.55),
  };
}
function getPosition(index: number) {
  return { x: 120 + index * 150, y: 160 + 92 * Math.sin(index * 0.72) };
}
function createSmoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const middleX = (previous.x + current.x) / 2;
    path += ` C ${middleX} ${previous.y}, ${middleX} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}
function getRequestedCourseId(courseId?: string) {
  if (courseId) return courseId;
  return new URLSearchParams(window.location.search).get("curso") ?? undefined;
}

export default function Dashboard({ courseId }: DashboardProps) {
  const [courses, setCourses] = useState<Curso[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(() => getRequestedCourseId(courseId));
  const [course, setCourse] = useState<Curso | null>(null);
  const [dashboardModules, setDashboardModules] = useState<DashboardModule[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const trailRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ dragging: false, startX: 0, scrollLeft: 0, moved: false });

  // Busca os cursos do seletor
  useEffect(() => {
    let cancelled = false;
    async function loadCourses() {
      setLoading(true);
      setErrorMessage("");
      try {
        const requestedCourseId = getRequestedCourseId(courseId);
        const courses = await cursoRepository.listar();
        const initialCourse = requestedCourseId ? courses.find((item) => item.ID === requestedCourseId) : courses.find((item) => item.Status === "published");
        if (!initialCourse) throw new Error(requestedCourseId ? "Curso não encontrado." : "Nenhum curso publicado disponível.");
        if (cancelled) return;
        setCourses(courses);
        setSelectedCourseId(initialCourse.ID);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar a trilha.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadCourses();
    return () => { cancelled = true; };
  }, [courseId]);

  // Busca módulos, aulas e conclusões do curso escolhido.
  useEffect(() => {
    if (!selectedCourseId) return;
    let cancelled = false;
    async function loadCourseTrail() {
      setLoading(true);
      setErrorMessage("");
      try {
        const selectedCourse = courses.find((item) => item.ID === selectedCourseId);
        if (!selectedCourse) throw new Error("Curso não encontrado.");
        const modules = await moduloRepository.listarPorCurso(selectedCourse.ID);
        const modulesWithLessons = await Promise.all(modules.map(async (module, index) => ({ ...module, aulas: await aulaRepository.listarPorModulo(module.ID), theme: createTheme(module, index) })));
        const { data: userData } = await supabase.auth.getUser();
        const conclusions = userData.user ? await concluiRepository.listar() : [];
        const lessonIds = new Set(conclusions.map((conclusion) => conclusion.fk_Aula_ID));
        if (cancelled) return;
        setCourse(selectedCourse);
        setDashboardModules(modulesWithLessons);
        setCompletedLessonIds(lessonIds);
        setActiveIndex(0);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar a trilha.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadCourseTrail();
    return () => { cancelled = true; };
  }, [courses, selectedCourseId]);

  // Junta módulos e aulas numa sequência única para o SVG e os nós.
  const trail = useMemo<TrailItem[]>(() => dashboardModules.flatMap((module) => [
    { type: "module", module } as const,
    ...module.aulas.map((aula) => ({ type: "lesson", module, aula }) as const),
  ]), [dashboardModules]);
  const positions = useMemo(() => trail.map((_, index) => getPosition(index)), [trail]);
  const trailWidth = 240 + trail.length * 150;
  const activeItem = trail[activeIndex];
  const activeModule = activeItem?.module ?? dashboardModules[0];
  const activeTheme = activeModule?.theme ?? createTheme({ Cor_Tema: "#06b6d4" } as Modulo, 0);
  const activeLessons = activeModule?.aulas ?? [];
  const completedLessons = activeLessons.filter((lesson) => completedLessonIds.has(lesson.ID)).length;
  const progressPercent = activeLessons.length > 0 ? Math.round((completedLessons / activeLessons.length) * 100) : 0;
  const completedBlocks = Math.round((completedLessons / Math.max(activeLessons.length, 1)) * 12);
  const { lastCompletedIndex: completedPathEndIndex } = trail.reduce((progress, item, index) => {
    if (!progress.canContinue || item.type === "module") return progress;
    if (!completedLessonIds.has(item.aula.ID)) return { ...progress, canContinue: false };
    return { ...progress, lastCompletedIndex: index };
  }, { lastCompletedIndex: -1, canContinue: true });
  // A linha avança até a última aula concluída ou até o item selecionado.
  const pathEndIndex = Math.max(completedPathEndIndex, activeIndex);

  // Centraliza o nó ativo ao trocar de aula ou módulo.
  useEffect(() => {
    const selectedItem = trailRef.current?.querySelector(`[data-trail-index="${activeIndex}"]`);
    if (selectedItem instanceof HTMLElement) selectedItem.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIndex, trail.length]);

  function handlePointerDown(clientX: number) {
    const element = trailRef.current;
    if (!element) return;
    dragState.current = { dragging: true, startX: clientX - element.offsetLeft, scrollLeft: element.scrollLeft, moved: false };
  }
  function handlePointerMove(clientX: number) {
    const element = trailRef.current;
    const drag = dragState.current;
    if (!element || !drag.dragging) return;
    const distance = clientX - element.offsetLeft - drag.startX;
    if (Math.abs(distance) > 4) drag.moved = true;
    element.scrollLeft = drag.scrollLeft - distance;
  }
  function handleCourseChange(nextCourseId: string) { setSelectedCourseId(nextCourseId); }

  // Conclusão local temporária (nada é gravado em "conclui"): 1º clique seleciona,
  // 2º clique alterna a conclusão, e só vale se a aula anterior já estiver concluída.
  function handleTrailItemClick(index: number, item: TrailItem) {
    if (dragState.current.moved) return;
    if (item.type === "lesson" && index === activeIndex) {
      setCompletedLessonIds((currentIds) => {
        const nextIds = new Set(currentIds);
        if (nextIds.has(item.aula.ID)) { nextIds.delete(item.aula.ID); return nextIds; }
        const previousLesson = [...trail.slice(0, index)].reverse().find((trailItem) => trailItem.type === "lesson");
        const previousLessonCompleted = !previousLesson || nextIds.has(previousLesson.aula.ID);
        if (!previousLessonCompleted) return currentIds;
        nextIds.add(item.aula.ID);
        return nextIds;
      });
      return;
    }
    setActiveIndex(index);
  }

  if (loading) return <main className="dashboard dashboard--state">Carregando sua trilha...</main>;
  if (errorMessage || !course || !activeModule) return <main className="dashboard dashboard--state"><p>{errorMessage || "Não há módulos cadastrados para este curso."}</p></main>;

  return (
    <main className="dashboard" style={{ background: activeTheme.background, color: "#f4eeff" }}>
      <header className="dashboard-header">
        <label className="dashboard-course-select"><select className="dashboard-course-select__field" value={selectedCourseId ?? course.ID} onChange={(event) => handleCourseChange(event.target.value)} aria-label="Selecionar curso">{courses.map((availableCourse) => <option key={availableCourse.ID} value={availableCourse.ID}>{availableCourse.Titulo}</option>)}</select></label>
        <h1 className="dashboard-header__title">{activeItem?.type === "lesson" ? activeItem.aula.Titulo : activeModule.Titulo}</h1>
      </header>
      <section ref={trailRef} className="trail-scroll" aria-label="Trilha de aprendizagem" onMouseDown={(event) => handlePointerDown(event.pageX)} onMouseMove={(event) => handlePointerMove(event.pageX)} onMouseUp={() => { dragState.current.dragging = false; }} onMouseLeave={() => { dragState.current.dragging = false; }} onTouchStart={(event) => handlePointerDown(event.touches[0].pageX)} onTouchMove={(event) => handlePointerMove(event.touches[0].pageX)} onTouchEnd={() => { dragState.current.dragging = false; }}>
        <div className="trail" style={{ width: trailWidth }}>
          <svg className="trail__path" width={trailWidth} height="320" aria-hidden="true">
            <path d={createSmoothPath(positions)} fill="none" stroke={activeTheme.muted} strokeWidth="5" strokeDasharray="10 8" strokeLinecap="round" />
            {pathEndIndex > 0 && <path d={createSmoothPath(positions.slice(0, pathEndIndex + 1))} fill="none" stroke={activeTheme.primary} strokeWidth="5" strokeLinecap="round" />}
          </svg>
          {trail.map((item, index) => {
            const isActive = index === activeIndex;
            const isPast = index <= pathEndIndex;
            const completed = item.type === "lesson" && completedLessonIds.has(item.aula.ID);
            const theme = item.module.theme;
            const position = positions[index];
            return (
              <button key={item.type === "module" ? item.module.ID : item.aula.ID} className={`trail-node trail-node--${item.type}`} data-trail-index={index} style={{ left: position.x - (item.type === "module" ? 40 : 32), top: position.y - (item.type === "module" ? 40 : 32) }} onClick={() => handleTrailItemClick(index, item)} aria-label={item.type === "module" ? `Módulo ${item.module.Titulo}` : `Aula ${item.aula.Titulo}`}>
                {item.type === "lesson" && isActive && <span className="trail-node__sparkles">✦ ✦ ✦</span>}
                <span className="trail-node__face" style={{ background: isActive || isPast || completed ? `linear-gradient(145deg, ${theme.primary}, ${theme.primary}aa)` : "#30244d", borderColor: isActive || isPast || completed ? theme.primary : theme.muted, boxShadow: isActive ? `0 0 28px ${theme.primary}99` : undefined }}>{item.type === "module" ? item.module.Icone : completed ? "✓" : isActive ? "▶" : "○"}</span>
                {item.type === "module" && <span className="trail-node__label" style={{ color: isActive ? theme.primary : theme.muted }}>{item.module.Titulo.toUpperCase()}</span>}
              </button>
            );
          })}
        </div>
      </section>
      <footer className="dashboard-footer">
        <div className="progress-row" aria-label={`Progresso do módulo: ${progressPercent}%`}>
          <div className="progress-blocks">{Array.from({ length: 12 }).map((_, index) => <span key={index} className={`progress-block ${index < completedBlocks ? "progress-block--completed" : ""}`} style={{ borderColor: index < completedBlocks ? activeTheme.primary : activeTheme.muted, background: index < completedBlocks ? activeTheme.primary : "transparent" }} />)}</div>
          <span className="progress-separator" style={{ color: activeTheme.muted }}>|</span>
          <strong className="progress-percent" style={{ color: activeTheme.primary }}>{progressPercent}%</strong>
        </div>
      </footer>
    </main>
  );
}