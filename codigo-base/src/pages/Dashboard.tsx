import { useEffect, useMemo, useRef, useState } from "react";
import { SidebarLeft } from "../components/sidebar/SidebarLeft";
import { SidebarRight } from "../components/sidebar/SidebarRight";
import { aulaRepository, concluiRepository, cursoRepository, moduloRepository } from "../data/repositories";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";
import "./Dashboard.css";


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
  const value = normalized.length === 3
    ? normalized.split("").map((part) => `${part}${part}`).join("")
    : normalized;

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
  return Math.max(640, window.innerWidth - 320);
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


export default function Dashboard({ courseId }: DashboardProps) {

  const [lousaAberta, setLousaAberta] = useState(false);
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
        const initialCourse = requestedCourseId
          ? courses.find((item) => item.ID === requestedCourseId)
          : courses.find((item) => item.Status === "published");

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
        const modulesWithLessons = await Promise.all(
          modules.map(async (module, index) => ({
            ...module,
            aulas: await aulaRepository.listarPorModulo(module.ID),
            theme: createTheme(module, index),
          })),
        );

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
  const trailStep = getDesktopTrailStep();
  const trailViewportWidth = getTrailViewportWidth();
  const trailWidth = trailViewportWidth + Math.max(0, trail.length - 1) * trailStep;
  const activeItem = trail[activeIndex];
  const activeModule = activeItem?.module ?? dashboardModules[0];
  const activeTheme = activeModule?.theme ?? createTheme({ Cor_Tema: "#06b6d4" } as Modulo, 0);
  const activeLessons = activeModule?.aulas ?? [];
  const completedLessons = activeLessons.filter((lesson) => completedLessonIds.has(lesson.ID)).length;
  const progressPercent = activeLessons.length > 0 ? Math.round((completedLessons / activeLessons.length) * 100) : 0;
  // Até 12 aulas, cada quadrado representa exatamente uma aula. Acima disso,
  // a barra mantém 12 quadrados e distribui o percentual proporcionalmente.
  const progressBlockCount = Math.min(Math.max(activeLessons.length, 1), 12);
  const completedBlocks = activeLessons.length <= 12
    ? completedLessons
    : Math.round((progressPercent / 100) * progressBlockCount);
  const { lastCompletedIndex: completedPathEndIndex } = trail.reduce((progress, item, index) => {
    if (!progress.canContinue || item.type === "module") return progress;
    if (!completedLessonIds.has(item.aula.ID)) {
      return { ...progress, canContinue: false };
    }
    return { ...progress, lastCompletedIndex: index };
  }, { lastCompletedIndex: -1, canContinue: true });

  // A linha avança até a última aula concluída ou até o item selecionado.
  const pathEndIndex = Math.max(completedPathEndIndex, activeIndex);
  const activeModuleIndex = Math.max(0, dashboardModules.findIndex((module) => module.ID === activeModule?.ID));
  const carouselModules = dashboardModules.length > 0
    ? [
        dashboardModules[(activeModuleIndex - 1 + dashboardModules.length) % dashboardModules.length],
        dashboardModules[activeModuleIndex],
        dashboardModules[(activeModuleIndex + 1) % dashboardModules.length],
      ]
    : [];


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
    const moduleIndex = trail.findIndex((item) => item.type === "module" && item.module.ID === moduleId);
    if (moduleIndex >= 0) setActiveIndex(moduleIndex);
  }

  function handleCourseChange(nextCourseId: string) {
    setSelectedCourseId(nextCourseId);
  }

  // ---------------------------------------------------------------------------
  // CONCLUSÃO VISUAL TEMPORÁRIA — remover quando existir a tela de aula.
  //
  // Conclusão local temporária (nada é gravado em "conclui"): 1º clique seleciona,
  // 2º clique alterna a conclusão, e só vale se a aula anterior já estiver concluída.
  // ---------------------------------------------------------------------------
  function handleTrailItemClick(index: number, item: TrailItem) {
    if (dragState.current.moved) return;

    if (item.type === "lesson" && index === activeIndex) {
      setCompletedLessonIds((currentIds) => {
        const nextIds = new Set(currentIds);

        if (nextIds.has(item.aula.ID)) {
          nextIds.delete(item.aula.ID);
          return nextIds;
        }

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

  // Move o carrossel para o módulo anterior ou para o próximo módulo.
  function moveCarousel(direction: -1 | 1) {
    if (dashboardModules.length < 1) return;

    const nextModuleIndex = (activeModuleIndex + direction + dashboardModules.length) % dashboardModules.length;
    selectModule(dashboardModules[nextModuleIndex].ID);
  }

  if (loading) {
    return <main className="dashboard dashboard--state">Carregando sua trilha...</main>;
  }

  if (errorMessage || !course || !activeModule) {
    return (
      <main className="dashboard dashboard--state">
        <p>{errorMessage || "Não há módulos cadastrados para este curso."}</p>
      </main>
    );
  }

  return (
      <div className="tela">

      <SidebarLeft />

    <main className="dashboard" style={{ background: activeTheme.background, color: "#f4eeff" }}>
      
      <header className="dashboard-header">
        <label className="dashboard-course-select">
          <span className="dashboard-course-select__icon">{course.Icone}</span>
          <select
            className="dashboard-course-select__field"
            value={selectedCourseId ?? course.ID}
            onChange={(event) => handleCourseChange(event.target.value)}
            aria-label="Selecionar curso"
          >
            {courses.map((availableCourse) => (
              <option key={availableCourse.ID} value={availableCourse.ID}>
                {availableCourse.Titulo}
              </option>
            ))}
          </select>
        </label>
        <h1 className="dashboard-header__title">{activeItem?.type === "lesson" ? activeItem.aula.Titulo : activeModule.Titulo}</h1>

        <button
          data-toggle-lousa='true'
          className='dashboard__lousa-toggle'
          onClick={() => setLousaAberta(!lousaAberta)}
        >
          ▼
        </button>
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
                  const changesModule = trail[index].module.ID !== trail[index + 1].module.ID;
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
            const completed = item.type === "lesson" && completedLessonIds.has(item.aula.ID);
            const theme = item.module.theme;
            const position = positions[index];
            
            return (
              <button
              key={item.type === "module" ? item.module.ID : item.aula.ID}
              className={`trail-node trail-node--${item.type} ${isActive ? "trail-node--active" : ""}`}
              data-trail-index={index}
              style={{ left: position.x - getTrailNodeOffset(item.type), top: position.y - getTrailNodeOffset(item.type) }}
              onClick={() => handleTrailItemClick(index, item)}
              aria-label={item.type === "module" ? `Módulo ${item.module.Titulo}` : `Aula ${item.aula.Titulo}`}
              >
                <span
                  className="trail-node__face"
                  style={{
                    background: isActive || isPast || completed ? `linear-gradient(145deg, ${theme.primary}, ${theme.primary}aa)` : "#30244d",
                    borderColor: isActive || isPast || completed ? theme.primary : theme.muted,
                    boxShadow: isActive ? `0 0 28px ${theme.primary}99` : undefined,
                  }}
                  >
                  {item.type === "module" ? item.module.Icone : completed ? "✓" : isActive ? "▶" : "○"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

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
          <button className="module-carousel__arrow" type="button" onClick={() => moveCarousel(-1)} aria-label="Módulo anterior">‹</button>
          <div className="module-carousel__viewport">
            <div className="module-carousel__track">
              {carouselModules.map((module, index) => {
                const isCurrent = index === 1;
                
                return (
                  <div key={`${module.ID}-${index}`} className={`module-carousel__item ${isCurrent ? "module-carousel__item--current" : ""}`}>
                    <span className="module-carousel__name" style={{ color: isCurrent ? module.theme.primary : module.theme.muted, borderColor: isCurrent ? module.theme.primary : module.theme.muted }}>{module.Titulo}</span>
                    <button
                      className="module-carousel__button"
                      type="button"
                      style={{
                        background: isCurrent ? `linear-gradient(145deg, ${module.theme.primary}, ${module.theme.primary}bb)` : "transparent",
                        borderColor: module.theme.primary,
                        boxShadow: isCurrent ? `0 0 20px ${module.theme.primary}66` : "none",
                      }}
                      onClick={() => selectModule(module.ID)}
                      aria-label={`Selecionar módulo ${module.Titulo}`}
                      >
                      <span className="module-carousel__icon">{module.Icone}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <button className="module-carousel__arrow" type="button" onClick={() => moveCarousel(1)} aria-label="Próximo módulo">›</button>
        </div>
      </footer>
    </main>

    <SidebarRight
        aberta={lousaAberta}
        onFechar={() => setLousaAberta(false)}
        titulo='Fundamentos'
      >
        <section className='bloco'>Bloco 1</section>
        <section className='bloco'>Bloco 2</section>
        <section className='bloco'>Bloco 3</section>
        <section className='bloco'>Bloco 4</section>

    </SidebarRight>
    
    </div>
  );
}