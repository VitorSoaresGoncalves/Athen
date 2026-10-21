import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LessonModal } from "../components/lesson/LessonModal";
import { SidebarLeft } from "../components/sidebar/SidebarLeft";
import { SidebarRight } from "../components/sidebar/SidebarRight";
import { aulaRepository, concluiRepository, cursoRepository, matriculaRepository, moduloRepository } from "../data/repositories";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";
import "./Dashboard.css";

type Curso = Database["public"]["Tables"]["courses"]["Row"];
type Modulo = Database["public"]["Tables"]["modules"]["Row"];
type Aula = Database["public"]["Tables"]["lessons"]["Row"];
type ModuleTheme = { primary: string; background: string; muted: string; shadow: string };
type DashboardModule = Modulo & { aulas: Aula[]; theme: ModuleTheme };
type LessonTrailItem = { type: "lesson"; module: DashboardModule; aula: Aula };
type TrailItem = { type: "module"; module: DashboardModule } | LessonTrailItem;
interface DashboardProps { courseId?: string }

// O banco novo não tem mais coluna de ícone em cursos/módulos: usamos ícones padrão.
const DEFAULT_COURSE_ICON = "📚";
const DEFAULT_MODULE_ICON = "📘";

// Largura da SidebarLeft (fixa). O conteúdo da trilha usa o espaço que sobra.
const SIDEBAR_WIDTH = 230;

// cor, tema do módulo e geometria da trilha.
const FALLBACK_COLORS = ["#06b6d4", "#22c55e", "#a855f7", "#f97316", "#eab308"];
function normalizeColor(color: string | null | undefined, index: number) {
  const candidate = color?.trim();
  return candidate && /^#[0-9a-fA-F]{3,8}$/.test(candidate) ? candidate : FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((part) => `${part}${part}`).join("")
    : normalized;

  if (value.length !== 6) return `rgba(6, 182, 212, ${alpha})`;

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function createTheme(module: Pick<Modulo, "color">, index: number): ModuleTheme {
  const primary = normalizeColor(module.color, index);

  return {
    primary,
    // Fundo-base mais vivo: mantém a profundidade roxa, mas deixa a cor do
    // módulo participar mais da tela em monitores que escurecem os tons.
    background: `radial-gradient(ellipse at 50% 58%, ${hexToRgba(primary, 0.34)} 0%, #140a2b 72%, #100721 100%)`,
    muted: hexToRgba(primary, 0.42),
    shadow: hexToRgba(primary, 0.55),
  };
}

function getDesktopTrailStep() {
  if (typeof window === "undefined") return 150;
  if (window.innerWidth >= 1920) return 180;
  if (window.innerWidth >= 1440) return 165;
  if (window.innerWidth >= 1280) return 155;
  return 150;
}

function getTrailNodeOffset(type: TrailItem["type"]) {
  if (typeof window === "undefined") return type === "module" ? 40 : 32;
  if (window.innerWidth >= 1920) return type === "module" ? 50 : 38;
  if (window.innerWidth >= 1440) return type === "module" ? 44 : 35;
  return type === "module" ? 40 : 32;
}

function getTrailViewportWidth() {
  if (typeof window === "undefined") return 960;
  return Math.max(640, window.innerWidth - SIDEBAR_WIDTH);
}

function getPosition(index: number) {
  const step = getDesktopTrailStep();
  const viewportWidth = getTrailViewportWidth();

  return {
    // Metade do espaço útil antes do primeiro nó permite centralizá-lo também.
    x: viewportWidth / 2 + index * step,
    y: 160 + 92 * Math.sin(index * 0.72),
  };
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

// Aulas que o usuário logado já concluiu no contexto de curso.
// (Filtra pelo usuário: para administradores a policy também devolve as conclusões dos outros.)
async function loadCompletedLessonIds(): Promise<Set<string>> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return new Set();

  const conclusions = await concluiRepository.listarPorUsuario(data.user.id);
  return new Set(conclusions.filter((conclusion) => conclusion.context === "course").map((conclusion) => conclusion.lesson_id));
}

function CourseSelect({ courses, value, onChange }: { courses: Curso[]; value: string | undefined; onChange: (courseId: string) => void }) {
  return (
    <label className="dashboard-course-select">
      <span className="dashboard-course-select__icon">{DEFAULT_COURSE_ICON}</span>
      <select
        className="dashboard-course-select__field"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Selecionar curso"
      >
        {courses.map((availableCourse) => (
          <option key={availableCourse.id} value={availableCourse.id}>
            {availableCourse.title}
          </option>
        ))}
      </select>
    </label>
  );
}


export default function Dashboard({ courseId }: DashboardProps) {

  const [lousaAberta, setLousaAberta] = useState(false);
  const [courses, setCourses] = useState<Curso[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(() => getRequestedCourseId(courseId));
  const [course, setCourse] = useState<Curso | null>(null);
  const [dashboardModules, setDashboardModules] = useState<DashboardModule[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [openLesson, setOpenLesson] = useState<{ aula: Aula; module: DashboardModule } | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const trailRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ dragging: false, startX: 0, scrollLeft: 0, moved: false });
  const noticeTimer = useRef<number | undefined>(undefined);

  // Mostra um aviso rápido na tela e some sozinho.
  function showNotice(message: string) {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2800);
  }

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  // Busca os cursos do seletor e escolhe o curso inicial:
  // o do link (?curso=), senão o matriculado mais recente, senão o primeiro publicado.
  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      setLoading(true);
      setErrorMessage("");

      try {
        const requestedCourseId = getRequestedCourseId(courseId);
        const { data: userData } = await supabase.auth.getUser();
        const [courses, enrollments] = await Promise.all([
          cursoRepository.listar(),
          userData.user ? matriculaRepository.listarPorUsuario(userData.user.id) : Promise.resolve([]),
        ]);

        // As matrículas já vêm da mais recente para a mais antiga.
        const enrolledCourse = enrollments
          .filter((enrollment) => enrollment.status !== "dropped")
          .map((enrollment) => courses.find((item) => item.id === enrollment.course_id))
          .find((item) => item !== undefined);

        const initialCourse = requestedCourseId
          ? courses.find((item) => item.id === requestedCourseId)
          : enrolledCourse ?? courses.find((item) => item.status === "published");

        if (!initialCourse) throw new Error(requestedCourseId ? "Curso não encontrado." : "Nenhum curso publicado disponível.");

        if (cancelled) return;
        setCourses(courses);
        setSelectedCourseId(initialCourse.id);
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
        const selectedCourse = courses.find((item) => item.id === selectedCourseId);
        if (!selectedCourse) throw new Error("Curso não encontrado.");

        const modules = await moduloRepository.listarPorCurso(selectedCourse.id);
        const modulesWithLessons = await Promise.all(
          modules.map(async (module, index) => ({
            ...module,
            aulas: await aulaRepository.listarPorModulo(module.id),
            theme: createTheme(module, index),
          })),
        );

        const lessonIds = await loadCompletedLessonIds();

        // Começa a trilha na primeira aula ainda não concluída ("continuar de onde parou").
        let position = 0;
        let startIndex = 0;
        let foundStart = false;
        for (const module of modulesWithLessons) {
          position += 1;
          for (const aula of module.aulas) {
            if (!foundStart && !lessonIds.has(aula.id)) {
              startIndex = position;
              foundStart = true;
            }
            position += 1;
          }
        }

        if (cancelled) return;
        setCourse(selectedCourse);
        setDashboardModules(modulesWithLessons);
        setCompletedLessonIds(lessonIds);
        setActiveIndex(startIndex);
        setOpenLesson(null);
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

  // Uma aula só libera quando a aula anterior da trilha foi concluída.
  const lockedIndexes = useMemo(() => {
    const locked = new Set<number>();
    let previousDone = true;

    trail.forEach((item, index) => {
      if (item.type !== "lesson") return;
      const done = completedLessonIds.has(item.aula.id);
      if (!done && !previousDone) locked.add(index);
      previousDone = done;
    });

    return locked;
  }, [trail, completedLessonIds]);

  const positions = useMemo(() => trail.map((_, index) => getPosition(index)), [trail]);
  const trailStep = getDesktopTrailStep();
  const trailViewportWidth = getTrailViewportWidth();
  const trailWidth = trailViewportWidth + Math.max(0, trail.length - 1) * trailStep;
  const activeItem = trail[activeIndex];
  const activeModule = activeItem?.module ?? dashboardModules[0];
  const activeTheme = activeModule?.theme ?? createTheme({ color: "#06b6d4" }, 0);
  const activeLessons = activeModule?.aulas ?? [];
  const completedLessons = activeLessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
  const progressPercent = activeLessons.length > 0 ? Math.round((completedLessons / activeLessons.length) * 100) : 0;
  // Até 12 aulas, cada quadrado representa exatamente uma aula. Acima disso,
  // a barra mantém 12 quadrados e distribui o percentual proporcionalmente.
  const progressBlockCount = Math.min(Math.max(activeLessons.length, 1), 12);
  const completedBlocks = activeLessons.length <= 12
    ? completedLessons
    : Math.round((progressPercent / 100) * progressBlockCount);
  const { lastCompletedIndex: completedPathEndIndex } = trail.reduce((progress, item, index) => {
    if (!progress.canContinue || item.type === "module") return progress;
    if (!completedLessonIds.has(item.aula.id)) {
      return { ...progress, canContinue: false };
    }
    return { ...progress, lastCompletedIndex: index };
  }, { lastCompletedIndex: -1, canContinue: true });

  // A linha avança até a última aula concluída ou até o item selecionado.
  const pathEndIndex = Math.max(completedPathEndIndex, activeIndex);
  const activeModuleIndex = Math.max(0, dashboardModules.findIndex((module) => module.id === activeModule?.id));

  // Carrossel: anterior, atual e próximo. Com menos de 3 módulos, mostra só os que existem
  // (sem repetir o mesmo módulo nas laterais).
  const carouselItems = useMemo(() => {
    const total = dashboardModules.length;
    if (total === 0) return [];

    const indexes = total >= 3
      ? [(activeModuleIndex - 1 + total) % total, activeModuleIndex, (activeModuleIndex + 1) % total]
      : Array.from({ length: total }, (_, index) => index);

    return indexes.map((moduleIndex) => ({
      module: dashboardModules[moduleIndex],
      current: moduleIndex === activeModuleIndex,
    }));
  }, [dashboardModules, activeModuleIndex]);


  // Centraliza o nó ativo após a troca de aula ou módulo.
  useEffect(() => {
    const element = trailRef.current;
    const selectedItem = element?.querySelector(`[data-trail-index="${activeIndex}"]`);
    if (!(element && selectedItem instanceof HTMLElement)) return;

    // Centraliza qualquer nó, inclusive o primeiro e o último, sem depender
    // do comportamento diferente de scrollIntoView em cada navegador.
    const targetScroll = selectedItem.offsetLeft + selectedItem.offsetWidth / 2 - element.clientWidth / 2;
    const maxScroll = element.scrollWidth - element.clientWidth;
    element.scrollTo({ left: Math.max(0, Math.min(targetScroll, maxScroll)), behavior: "smooth" });
  }, [activeIndex, trail.length]);

  function handlePointerDown(clientX: number) {
    const element = trailRef.current;
    if (!element) return;
    dragState.current = {
      dragging: true,
      startX: clientX - element.offsetLeft,
      scrollLeft: element.scrollLeft,
      moved: false,
    };
  }

  function handlePointerMove(clientX: number) {
    const element = trailRef.current;
    const drag = dragState.current;
    if (!element || !drag.dragging) return;
    const distance = clientX - element.offsetLeft - drag.startX;
    if (Math.abs(distance) > 4) drag.moved = true;
    element.scrollLeft = drag.scrollLeft - distance;
  }

  function selectModule(moduleId: string) {
    const moduleIndex = trail.findIndex((item) => item.type === "module" && item.module.id === moduleId);
    if (moduleIndex >= 0) setActiveIndex(moduleIndex);
  }

  function handleCourseChange(nextCourseId: string) {
    setSelectedCourseId(nextCourseId);
  }

  // 1º clique seleciona a aula; 2º clique (na aula já selecionada) abre o pop-up
  // com o conteúdo e as questões. Aulas bloqueadas só mostram um aviso.
  function handleTrailItemClick(index: number, item: TrailItem) {
    if (dragState.current.moved) return;

    if (item.type === "lesson" && index === activeIndex) {
      if (lockedIndexes.has(index)) {
        showNotice("Conclua a aula anterior para liberar esta.");
        return;
      }
      setOpenLesson({ aula: item.aula, module: item.module });
      return;
    }

    setActiveIndex(index);
  }

  // O servidor já gravou a conclusão em finalize_attempt: aqui só recarregamos
  // as conclusões e avançamos a seleção para a próxima aula.
  async function handleLessonCompleted(lessonId: string) {
    try {
      setCompletedLessonIds(await loadCompletedLessonIds());
    } catch {
      showNotice("Aula concluída, mas não foi possível atualizar a trilha agora.");
    }

    const lessonIndex = trail.findIndex((item) => item.type === "lesson" && item.aula.id === lessonId);
    const nextLessonIndex = trail.findIndex((item, index) => index > lessonIndex && item.type === "lesson");
    if (lessonIndex === activeIndex && nextLessonIndex >= 0) setActiveIndex(nextLessonIndex);
  }

  // Move o carrossel para o módulo anterior ou para o próximo módulo.
  function moveCarousel(direction: -1 | 1) {
    if (dashboardModules.length < 2) return;

    const nextModuleIndex = (activeModuleIndex + direction + dashboardModules.length) % dashboardModules.length;
    selectModule(dashboardModules[nextModuleIndex].id);
  }

  return (
    <div className="tela">
      <SidebarLeft />

      {loading ? (
        <main className="dashboard dashboard--state">Carregando sua trilha...</main>
      ) : errorMessage || !course || !activeModule ? (
        <main className="dashboard dashboard--state">
          <p>{errorMessage || "Nenhum curso ou módulo disponível no momento."}</p>
          {courses.length > 0 && <CourseSelect courses={courses} value={selectedCourseId} onChange={handleCourseChange} />}
          <Link className="dashboard__link" to="/cursos">Ver todos os cursos</Link>
        </main>
      ) : (
        <main className="dashboard" style={{ background: activeTheme.background, color: "#f4eeff" }}>

          <header className="dashboard-header">
            <CourseSelect courses={courses} value={selectedCourseId ?? course.id} onChange={handleCourseChange} />
            <h1 className="dashboard-header__title">{activeItem?.type === "lesson" ? activeItem.aula.title : activeModule.title}</h1>
          </header>

          <section
            ref={trailRef}
            className="trail-scroll"
            aria-label="Trilha de aprendizagem"
            onMouseDown={(event) => handlePointerDown(event.pageX)}
            onMouseMove={(event) => handlePointerMove(event.pageX)}
            onMouseUp={() => { dragState.current.dragging = false; }}
            onMouseLeave={() => { dragState.current.dragging = false; }}
            onTouchStart={(event) => handlePointerDown(event.touches[0].pageX)}
            onTouchMove={(event) => handlePointerMove(event.touches[0].pageX)}
            onTouchEnd={() => { dragState.current.dragging = false; }}
          >
            <div className="trail" style={{ width: trailWidth }}>
              <div className="trail__glow" style={{ background: `radial-gradient(ellipse 50% 60% at 50% 50%, ${hexToRgba(activeTheme.primary, 0.12)} 0%, transparent 70%)` }} />
              <svg className="trail__path" width={trailWidth} height="320" aria-hidden="true">
                <path d={createSmoothPath(positions)} fill="none" stroke={activeTheme.muted} strokeWidth="5" strokeDasharray="10 8" strokeLinecap="round" />
                {Array.from({ length: pathEndIndex }).map((_, index) => (
                  <g key={`completed-segment-${index}`}>
                    {(() => {
                      const changesModule = trail[index].module.id !== trail[index + 1].module.id;
                      const transitionStart = changesModule ? 78 : 0;

                      return (
                        <defs>
                          <linearGradient
                            id={`trail-segment-gradient-${index}`}
                            gradientUnits="userSpaceOnUse"
                            x1={positions[index].x}
                            y1={positions[index].y}
                            x2={positions[index + 1].x}
                            y2={positions[index + 1].y}
                          >
                            <stop offset="0%" stopColor={trail[index].module.theme.primary} />
                            <stop offset={`${transitionStart}%`} stopColor={trail[index].module.theme.primary} />
                            <stop offset="100%" stopColor={trail[index + 1].module.theme.primary} />
                          </linearGradient>
                        </defs>
                      );
                    })()}
                    <path
                      d={createSmoothPath(positions.slice(index, index + 2))}
                      fill="none"
                      stroke={`url(#trail-segment-gradient-${index})`}
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  </g>
                ))}
              </svg>
              {trail.map((item, index) => {
                const isActive = index === activeIndex;
                const isPast = index <= pathEndIndex;
                const completed = item.type === "lesson" && completedLessonIds.has(item.aula.id);
                const locked = lockedIndexes.has(index);
                const theme = item.module.theme;
                const position = positions[index];
                const lit = isActive || isPast || completed;

                return (
                  <button
                    key={item.type === "module" ? item.module.id : item.aula.id}
                    className={`trail-node trail-node--${item.type} ${isActive ? "trail-node--active" : ""} ${locked ? "trail-node--locked" : ""}`}
                    data-trail-index={index}
                    style={{ left: position.x - getTrailNodeOffset(item.type), top: position.y - getTrailNodeOffset(item.type) }}
                    onClick={() => handleTrailItemClick(index, item)}
                    aria-label={item.type === "module" ? `Módulo ${item.module.title}` : `Aula ${item.aula.title}${locked ? " (bloqueada)" : completed ? " (concluída)" : ""}`}
                  >
                    <span
                      className="trail-node__face"
                      style={{
                        background: lit ? `linear-gradient(145deg, ${theme.primary}, ${theme.primary}aa)` : "#30244d",
                        borderColor: lit ? theme.primary : theme.muted,
                        boxShadow: isActive ? `0 0 28px ${theme.primary}99` : undefined,
                      }}
                    >
                      {item.type === "module" ? DEFAULT_MODULE_ICON : completed ? "✓" : locked ? "🔒" : isActive ? "▶" : "○"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {notice && <div className="dashboard-toast" role="status">{notice}</div>}

          {/* Rodapé: percentual do módulo ativo e atalhos para os módulos carregados. */}
          <footer className="dashboard-footer">
            <div className="progress-row" aria-label={`Progresso do módulo: ${progressPercent}%`}>
              <div className="progress-blocks">
                {Array.from({ length: progressBlockCount }).map((_, index) => <span key={index} className={`progress-block ${index < completedBlocks ? "progress-block--completed" : ""}`} style={{ borderColor: index < completedBlocks ? activeTheme.primary : activeTheme.muted, background: index < completedBlocks ? activeTheme.primary : "transparent" }} />)}
              </div>
              <span className="progress-separator" style={{ color: activeTheme.muted }}>|</span>
              <strong className="progress-percent" style={{ color: activeTheme.primary }}>{progressPercent}%</strong>
            </div>
            <div className="module-carousel" aria-label="Navegação entre módulos">
              <button className="module-carousel__arrow" type="button" disabled={dashboardModules.length < 2} onClick={() => moveCarousel(-1)} aria-label="Módulo anterior">‹</button>
              <div className="module-carousel__viewport">
                <div className="module-carousel__track">
                  {carouselItems.map(({ module, current }) => (
                    <div key={module.id} className={`module-carousel__item ${current ? "module-carousel__item--current" : ""}`}>
                      <span className="module-carousel__name" title={module.title} style={{ color: current ? module.theme.primary : module.theme.muted, borderColor: current ? module.theme.primary : module.theme.muted }}>{module.title}</span>
                      <button
                        className="module-carousel__button"
                        type="button"
                        style={{
                          background: current ? `linear-gradient(145deg, ${module.theme.primary}, ${module.theme.primary}bb)` : "transparent",
                          borderColor: module.theme.primary,
                          boxShadow: current ? `0 0 20px ${module.theme.primary}66` : "none",
                        }}
                        onClick={() => selectModule(module.id)}
                        aria-label={`Selecionar módulo ${module.title}`}
                        aria-current={current ? "true" : undefined}
                      >
                        <span className="module-carousel__icon">{DEFAULT_MODULE_ICON}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button className="module-carousel__arrow" type="button" disabled={dashboardModules.length < 2} onClick={() => moveCarousel(1)} aria-label="Próximo módulo">›</button>
            </div>
          </footer>
        </main>
      )}

      {/* A aba da própria sidebar abre e fecha o painel, por isso onFechar alterna o estado. */}
      <SidebarRight
        aberta={lousaAberta}
        onFechar={() => setLousaAberta((aberta) => !aberta)}
        cor={activeTheme.primary}
      />

      {course && openLesson && (
        <LessonModal
          key={openLesson.aula.id}
          aula={openLesson.aula}
          moduloTitulo={openLesson.module.title}
          cursoId={course.id}
          cor={openLesson.module.theme.primary}
          jaConcluida={completedLessonIds.has(openLesson.aula.id)}
          onFechar={() => setOpenLesson(null)}
          onConcluida={(lessonId) => void handleLessonCompleted(lessonId)}
        />
      )}
    </div>
  );
}