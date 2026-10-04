import { useEffect, useMemo, useRef, useState } from "react";
import { SidebarLeft } from "../components/sidebar/SidebarLeft";
import { SidebarRight } from "../components/sidebar/SidebarRight";
import { aulaRepository, concluiRepository, cursoRepository, moduloRepository, salaRepository } from "../data/repositories";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";
import "./Dashboard.css";


type Curso = Database["public"]["Tables"]["Curso"]["Row"];
type Sala = Database["public"]["Tables"]["Sala"]["Row"];
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
  return Math.max(640, window.innerWidth);
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
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"courses" | "rooms">("courses");
  const [salas, setSalas] = useState<Sala[]>([]);
  const [salasLoading, setSalasLoading] = useState(false);
  const [salasError, setSalasError] = useState("");
  const [course, setCourse] = useState<Curso | null>(null);
  const [dashboardModules, setDashboardModules] = useState<DashboardModule[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const headerRef = useRef<HTMLElement>(null);
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

  useEffect(() => {
    if (!coursePickerOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setCoursePickerOpen(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [coursePickerOpen]);

  // Carrega todas as salas.
  useEffect(() => {
    if (!coursePickerOpen || pickerTab !== "rooms" || salas.length > 0) return;

    let cancelled = false;

    async function loadSalas() {
      setSalasLoading(true);
      setSalasError("");

      try {
        const availableSalas = await salaRepository.listar();
        if (!cancelled) setSalas(availableSalas);
      } catch (error) {
        if (!cancelled) setSalasError(error instanceof Error ? error.message : "Não foi possível carregar as salas.");
      } finally {
        if (!cancelled) setSalasLoading(false);
      }
    }

    void loadSalas();
    return () => { cancelled = true; };
  }, [coursePickerOpen, pickerTab, salas.length]);

  useEffect(() => {
    const header = headerRef.current;
    const sidebar = document.querySelector<HTMLElement>(".tela > .sidebarL");
    if (!(header && sidebar)) return;

    const updateSidebarWidth = () => {
      header.style.setProperty("--sidebar-left-width", `${sidebar.getBoundingClientRect().width}px`);
    };

    updateSidebarWidth();
    const observer = new ResizeObserver(updateSidebarWidth);
    observer.observe(sidebar);

    return () => observer.disconnect();
  }, []);

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

  // Por enquanto, o curso atual aparece primeiro. Futuramente, este ranking
  // pode ser substituído por uma ordenação baseada na atividade mais recente.
  const orderedCourses = useMemo(() => [
    ...courses.filter((availableCourse) => availableCourse.ID === selectedCourseId),
    ...courses.filter((availableCourse) => availableCourse.ID !== selectedCourseId),
  ], [courses, selectedCourseId]);


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
    setCoursePickerOpen(false);
  }

  function handleSalaClick(sala: Sala) {
    if (!sala.fk_Curso_ID) return;

    // talvez mudar, se o painel da sala for diferente chamar ent o painel da sala não o padrão do dashboard, decissao futura
    handleCourseChange(sala.fk_Curso_ID);
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
      <div className="tela flex min-h-svh">

      <SidebarLeft />

    <main className="dashboard relative z-0 flex min-h-svh min-w-0 flex-1 flex-col overflow-hidden select-none text-[#f4eeff] transition-[background] duration-700" style={{ background: activeTheme.background, color: "#f4eeff" }}>
      
      <header ref={headerRef} className="dashboard-header relative flex flex-none flex-col items-center px-6 pb-[14px] pt-[26px] text-center">
        <button
          type="button"
          className="dashboard-course-trigger absolute left-[calc(var(--sidebar-left-width,230px)+32px)] top-[26px] z-10 inline-flex max-w-[min(36%,360px)] items-center gap-2 rounded-lg border border-[rgba(193,150,255,0.34)] bg-[rgba(87,46,151,0.22)] px-3 py-1.5 text-left text-[#ffcc00] transition-colors hover:border-[#A486D5] hover:bg-[rgba(87,46,151,0.42)] focus:outline-none focus:ring-2 focus:ring-[#A486D5]/60 min-[1440px]:top-[30px] min-[1920px]:top-[34px]"
          onClick={() => setCoursePickerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={coursePickerOpen}
          aria-label="Abrir seletor de cursos"
        >
          <span aria-hidden="true" className="flex h-6 w-6 flex-none items-center justify-center text-xl leading-none text-[#f4eeff]" > ≡ </span>
        </button>
        <h1 className="dashboard-header__title m-[7px_0_0] text-[clamp(26px,4vw,38px)] font-normal tracking-[0.02em] text-[#f4eeff]">{activeItem?.type === "lesson" ? activeItem.aula.Titulo : activeModule.Titulo}</h1>

        <button
          data-toggle-lousa='true'
          className='dashboard__lousa-toggle absolute right-[50px] top-8 cursor-pointer rounded-lg border border-[#1e2a3d] bg-[#182335] px-[17px] py-[11px] text-sm text-[#eaf2ff]'
          onClick={() => setLousaAberta(!lousaAberta)}
        >
          ▼
        </button>
      </header>

      {coursePickerOpen && (
        <div
          className="fixed inset-0 z-30 flex items-start justify-center bg-[#090512]/70 px-5 pt-[18vh] backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCoursePickerOpen(false);
          }}
        >
          <section
            className="w-full max-w-2xl rounded-2xl border border-[rgba(193,150,255,0.38)] bg-[#1a1035] p-5 text-[#f4eeff] shadow-2xl shadow-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-picker-title"
          >

            <div className="mb-4 grid grid-cols-2 gap-2 border-b border-white/10 pb-4">
              <button
                type="button"
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[#A486D5]/60 ${pickerTab === "courses" ? "border-[#A486D5] bg-[#5a3b91]/55 text-[#f4eeff]" : "border-white/10 bg-white/[0.04] text-[#cfc2e8] hover:border-[#A486D5]/70 hover:bg-white/[0.09]"}`}
                onClick={() => setPickerTab("courses")}
                aria-pressed={pickerTab === "courses"}
              >
                <span aria-hidden="true" className="text-lg">💼</span>
                <span>Cursos</span>
              </button>
              <button
                type="button"
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[#A486D5]/60 ${pickerTab === "rooms" ? "border-[#A486D5] bg-[#5a3b91]/55 text-[#f4eeff]" : "border-white/10 bg-white/[0.04] text-[#cfc2e8] hover:border-[#A486D5]/70 hover:bg-white/[0.09]"}`}
                onClick={() => setPickerTab("rooms")}
                aria-pressed={pickerTab === "rooms"}
              >
                <span aria-hidden="true" className="text-lg">👨‍🏫</span>
                <span>Salas</span>
              </button>
            </div>

            <div className="grid max-h-[min(60vh,420px)] grid-cols-3 auto-rows-fr gap-3 overflow-y-auto px-1 pb-1 pt-4">
              {pickerTab === "courses" ? (
                orderedCourses.map((availableCourse, index) => {
                  const isSelected = availableCourse.ID === selectedCourseId;
                  const cardColor = normalizeColor(availableCourse.Cor_Capa, index);

                  return (
                    <button
                      key={availableCourse.ID}
                      type="button"
                      className={`group relative flex h-[156px] w-full flex-col justify-between overflow-hidden rounded-xl p-3 text-left transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-[#A486D5]/60 ${isSelected ? "z-10 scale-[1.04] brightness-110 shadow-[0_8px_22px_rgba(0,0,0,0.42)]" : "shadow-[0_3px_8px_rgba(0,0,0,0.2)] hover:z-10 hover:scale-[1.04] hover:shadow-none"}`}
                      style={{ background: `linear-gradient(145deg, ${hexToRgba(cardColor, isSelected ? 0.88 : 0.72)} 0%, #171027 65%, #120c22 100%)` }}
                      onClick={() => handleCourseChange(availableCourse.ID)}
                      aria-pressed={isSelected}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#120c22]/70 text-2xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/15">{availableCourse.Icone}</span>
                        {isSelected && <span className="rounded-full bg-[#A486D5] px-2 py-0.5 text-[10px] font-bold text-[#171027]">Atual</span>}
                      </span>
                      <span className="mt-3 min-w-0">
                        <span className="block truncate text-sm font-bold text-[#f4eeff] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{availableCourse.Titulo}</span>
                        <span className="mt-1 block truncate text-[11px] text-[#e2d8f2] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{availableCourse.Categoria || availableCourse.Slug}</span>
                      </span>
                    </button>
                  );
                })
              ) : salasLoading ? (
                <p className="col-span-3 px-2 py-6 text-center text-sm text-[#cfc2e8]">Carregando salas...</p>
              ) : salasError ? (
                <p className="col-span-3 px-2 py-6 text-center text-sm text-red-200">{salasError}</p>
              ) : salas.length === 0 ? (
                <p className="col-span-3 px-2 py-6 text-center text-sm text-[#cfc2e8]">Nenhuma sala cadastrada.</p>
              ) : (
                salas.map((sala) => {
                  const salaCurso = courses.find((availableCourse) => availableCourse.ID === sala.fk_Curso_ID);
                  const cardColor = salaCurso ? normalizeColor(salaCurso.Cor_Capa, 0) : "#A486D5";
                  const salaIcon = salaCurso?.Icone?.trim() || "👨‍🏫";

                  return (
                    <button
                      type="button"
                      key={sala.ID}
                      className="flex h-[156px] w-full cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-3 text-left shadow-[0_3px_8px_rgba(0,0,0,0.2)] transition-transform hover:z-10 hover:scale-[1.04] hover:shadow-none focus:outline-none focus:ring-2 focus:ring-[#A486D5]/60"
                      style={{ background: `linear-gradient(145deg, ${hexToRgba(cardColor, 0.65)} 0%, #171027 65%, #120c22 100%)` }}
                      onClick={() => handleSalaClick(sala)}
                      aria-label={`Abrir o curso associado à sala ${sala.Nome}`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#120c22]/70 text-2xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/15">{salaIcon}</span>
                        <span className="rounded-full bg-[#120c22]/70 px-2 py-0.5 text-[10px] text-[#e2d8f2] ring-1 ring-white/10">Sala</span>
                      </span>
                      <span className="mt-3 min-w-0">
                        <span className="block truncate text-sm font-bold text-[#f4eeff] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{sala.Nome}</span>
                        <span className="mt-1 block truncate text-[11px] text-[#e2d8f2] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        <strong className="text-[#f4eeff]">{sala.Codigo}</strong>{salaCurso ? ` · ${salaCurso.Titulo}` : ""}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      <section
        ref={trailRef}
        className="trail-scroll min-h-0 w-full flex-1 cursor-grab overflow-x-auto overflow-y-hidden"
        aria-label="Trilha de aprendizagem"
        onMouseDown={(event) => handlePointerDown(event.pageX)}
        onMouseMove={(event) => handlePointerMove(event.pageX)}
        onMouseUp={() => { dragState.current.dragging = false; }}
        onMouseLeave={() => { dragState.current.dragging = false; }}
        onTouchStart={(event) => handlePointerDown(event.touches[0].pageX)}
        onTouchMove={(event) => handlePointerMove(event.touches[0].pageX)}
        onTouchEnd={() => { dragState.current.dragging = false; }}
      >
        <div className="trail relative h-[320px] max-w-none" style={{ width: trailWidth }}>
          <div className="trail__glow pointer-events-none absolute inset-0 transition-[background] duration-700" style={{ background: `radial-gradient(ellipse 50% 60% at 50% 50%, ${hexToRgba(activeTheme.primary, 0.12)} 0%, transparent 70%)` }} />
          <svg className="trail__path pointer-events-none absolute left-0 top-0 overflow-visible" width={trailWidth} height="320" aria-hidden="true">
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
      <footer className="dashboard-footer mx-auto flex w-full max-w-[960px] flex-none flex-col px-5 pb-5 pt-2">
        <div className="progress-row flex items-center justify-center gap-3" aria-label={`Progresso do módulo: ${progressPercent}%`}>
          <div className="progress-blocks flex min-h-6 items-center gap-1.5">
            {Array.from({ length: progressBlockCount }).map((_, index) => <span key={index} className={`progress-block block h-3 w-3 rounded-[3px] border-2 border-transparent transition-all duration-500 ${index < completedBlocks ? "progress-block--completed" : ""}`} style={{ borderColor: index < completedBlocks ? activeTheme.primary : activeTheme.muted, background: index < completedBlocks ? activeTheme.primary : "transparent" }} />)}
          </div>
          <span className="progress-separator text-base font-black" style={{ color: activeTheme.muted }}>|</span>
          <strong className="progress-percent text-xl tracking-[0.08em]" style={{ color: activeTheme.primary }}>{progressPercent}%</strong>
        </div>
        <div className="module-carousel mt-4 flex items-center justify-center gap-0.5" aria-label="Navegação entre módulos">
          <button className="module-carousel__arrow" type="button" onClick={() => moveCarousel(-1)} aria-label="Módulo anterior">‹</button>
          <div className="module-carousel__viewport w-[min(100%,330px)] overflow-hidden">
            <div className="module-carousel__track grid grid-cols-3 items-end gap-0">
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
