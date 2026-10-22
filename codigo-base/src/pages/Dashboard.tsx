import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LessonModal } from "../components/lesson/LessonModal";
import { CursoNotebook } from "../components/notebook/CursoNotebook";
import { SidebarLeft } from "../components/sidebar/SidebarLeft";
import { SidebarRight } from "../components/sidebar/SidebarRight";
import { aulaRepository, concluiRepository, cursoRepository, matriculaRepository, moduloRepository, salaRepository, tentativaRepository } from "../data/repositories";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";
import "./Dashboard.css";

type Curso = Database["public"]["Tables"]["courses"]["Row"];
type Sala = Database["public"]["Tables"]["rooms"]["Row"];
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
const DEFAULT_SALA_ICON = "👨‍🏫";

// cor, tema do módulo e geometria da trilha.
const FALLBACK_COLORS = ["#06b6d4", "#22c55e", "#a855f7", "#f97316", "#eab308"];
function normalizeColor(color: string | null | undefined, index: number) {
  const candidate = color?.trim();
  return candidate && /^#[0-9a-fA-F]{3,8}$/.test(candidate) ? candidate : FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

// O ícone vem de modules.icon (coluna not null, default "📘"). O padrão só cobre texto vazio.
function getModuleIcon(module: Pick<Modulo, "icon">) {
  return module.icon?.trim() || DEFAULT_MODULE_ICON;
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

// Aulas que o usuário logado já concluiu.
// - Sem sala: conclusões em contexto de curso.
// - Com sala: conclusões em contexto de sala cuja tentativa foi feita NESSA sala
//   (mesma regra da página Salas: a tentativa guarda o room_id).
// (Filtra pelo usuário: para administradores a policy também devolve as conclusões dos outros.)
async function loadCompletedLessonIds(salaId?: string): Promise<Set<string>> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return new Set();

  const conclusions = await concluiRepository.listarPorUsuario(data.user.id);

  if (!salaId) {
    return new Set(conclusions.filter((conclusion) => conclusion.context === "course").map((conclusion) => conclusion.lesson_id));
  }

  const attempts = await tentativaRepository.listarPorUsuario(data.user.id);
  const roomByAttempt = new Map(attempts.map((attempt) => [attempt.id, attempt.room_id] as const));
  return new Set(
    conclusions
      .filter((conclusion) => conclusion.context === "room" && conclusion.attempt_id && roomByAttempt.get(conclusion.attempt_id) === salaId)
      .map((conclusion) => conclusion.lesson_id),
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
  // Seletor de cursos/salas. "activeSalaId" é definido ao escolher uma sala: as aulas passam a contar para ela.
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"courses" | "rooms">("courses");
  const [salas, setSalas] = useState<Sala[]>([]);
  const [salasLoading, setSalasLoading] = useState(false);
  const [salasError, setSalasError] = useState("");
  const [activeSalaId, setActiveSalaId] = useState<string | undefined>(undefined);
  const telaRef = useRef<HTMLDivElement>(null);
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

        const lessonIds = await loadCompletedLessonIds(activeSalaId);

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
  }, [courses, selectedCourseId, activeSalaId]);

  // Fecha o seletor de cursos/salas com Esc.
  useEffect(() => {
    if (!coursePickerOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setCoursePickerOpen(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [coursePickerOpen]);

  // Carrega as salas só quando a aba "Salas" é aberta (tabela "rooms").
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

  // Expõe a largura real da sidebar (--sidebar-left-width) para o botão de curso e o notebook.
  useEffect(() => {
    const tela = telaRef.current;
    const sidebar = tela?.querySelector<HTMLElement>(".sidebarL");
    if (!(tela && sidebar)) return;

    const updateSidebarWidth = () => {
      tela.style.setProperty("--sidebar-left-width", `${sidebar.getBoundingClientRect().width}px`);
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


  // O curso atual aparece primeiro. A cor de cada card vem da posição original
  // do curso na lista (o banco novo não tem coluna de cor em "courses").
  const orderedCourses = useMemo(() => [
    ...courses.filter((availableCourse) => availableCourse.id === selectedCourseId),
    ...courses.filter((availableCourse) => availableCourse.id !== selectedCourseId),
  ], [courses, selectedCourseId]);

  function getCourseColor(courseIdToFind: string | null | undefined) {
    const index = courses.findIndex((availableCourse) => availableCourse.id === courseIdToFind);
    return normalizeColor(undefined, Math.max(0, index));
  }

  const activeSala = activeSalaId ? salas.find((sala) => sala.id === activeSalaId) : undefined;

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

  // Escolher um curso sai do modo sala: as aulas voltam a contar como "do curso".
  function handleCourseChange(nextCourseId: string) {
    setActiveSalaId(undefined);
    setSelectedCourseId(nextCourseId);
    setCoursePickerOpen(false);
  }

  // Escolher uma sala abre o curso dela e passa a registrar as aulas como atividade da sala
  // (XP interno da sala, nunca o XP global — veja o LessonModal).
  function handleSalaClick(sala: Sala) {
    if (!sala.course_id) return;

    setActiveSalaId(sala.id);
    setSelectedCourseId(sala.course_id);
    setCoursePickerOpen(false);
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
      setCompletedLessonIds(await loadCompletedLessonIds(activeSalaId));
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

  // Botão (≡) que abre o seletor de cursos/salas. Fica fora do <main> de conteúdo
  // para continuar disponível mesmo se o curso não tiver módulos.
  const courseTrigger = (
    <button
      type="button"
      className="dashboard-course-trigger absolute left-[calc(var(--sidebar-left-width,230px)+64px)] top-[26px] z-10 inline-flex max-w-[min(36%,360px)] items-center gap-2 rounded-lg border border-[rgba(193,150,255,0.34)] bg-[rgba(87,46,151,0.22)] px-3 py-1.5 text-left text-[#ffcc00] transition-colors hover:border-[#A486D5] hover:bg-[rgba(87,46,151,0.42)] focus:outline-none focus:ring-2 focus:ring-[#A486D5]/60 min-[1440px]:top-[30px] min-[1920px]:top-[34px]"
      onClick={() => setCoursePickerOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={coursePickerOpen}
      aria-label="Abrir seletor de cursos"
    >
      <span aria-hidden="true" className="flex h-6 w-6 flex-none items-center justify-center text-xl leading-none text-[#f4eeff]">≡</span>
    </button>
  );

  const coursePickerModal = coursePickerOpen && (
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
        aria-label="Selecionar curso ou sala"
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

            {/* Linhas com a altura do card (156px): com auto-rows-fr e max-h as linhas encolhiam e os cards se sobrepunham. */}
            <div className="grid max-h-[min(60vh,420px)] grid-cols-3 auto-rows-[156px] gap-3 overflow-y-auto px-1 pb-1 pt-4">
          {pickerTab === "courses" ? (
            orderedCourses.map((availableCourse) => {
              const isSelected = availableCourse.id === selectedCourseId;
              const cardColor = getCourseColor(availableCourse.id);

              return (
                <button
                  key={availableCourse.id}
                  type="button"
                  className={`group relative flex h-[156px] w-full flex-col justify-between overflow-hidden rounded-xl p-3 text-left transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-[#A486D5]/60 ${isSelected ? "z-10 scale-[1.04] brightness-110 shadow-[0_8px_22px_rgba(0,0,0,0.42)]" : "shadow-[0_3px_8px_rgba(0,0,0,0.2)] hover:z-10 hover:scale-[1.04] hover:shadow-none"}`}
                  style={{ background: `linear-gradient(145deg, ${hexToRgba(cardColor, isSelected ? 0.88 : 0.72)} 0%, #171027 65%, #120c22 100%)` }}
                  onClick={() => handleCourseChange(availableCourse.id)}
                  aria-pressed={isSelected}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#120c22]/70 text-2xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/15">{DEFAULT_COURSE_ICON}</span>
                    {isSelected
                      ? <span className="rounded-full bg-[#A486D5] px-2 py-0.5 text-[10px] font-bold text-[#171027]">Atual</span>
                      : availableCourse.status !== "published" && <span className="rounded-full bg-[#120c22]/70 px-2 py-0.5 text-[10px] text-[#e2d8f2] ring-1 ring-white/10">Rascunho</span>}
                  </span>
                  <span className="mt-3 min-w-0">
                    <span className="block truncate text-sm font-bold text-[#f4eeff] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{availableCourse.title}</span>
                    <span className="mt-1 block truncate text-[11px] text-[#e2d8f2] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{availableCourse.category || availableCourse.slug}</span>
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
              const salaCurso = courses.find((availableCourse) => availableCourse.id === sala.course_id);
              const cardColor = salaCurso ? getCourseColor(salaCurso.id) : "#A486D5";
              const isSalaAtiva = sala.id === activeSalaId;

              return (
                <button
                  type="button"
                  key={sala.id}
                  disabled={!salaCurso}
                  title={salaCurso ? undefined : "Esta sala não tem um curso disponível para você."}
                  className={`flex h-[156px] w-full cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-3 text-left transition-transform focus:outline-none focus:ring-2 focus:ring-[#A486D5]/60 disabled:cursor-not-allowed disabled:opacity-45 ${isSalaAtiva ? "z-10 scale-[1.04] brightness-110 shadow-[0_8px_22px_rgba(0,0,0,0.42)]" : "shadow-[0_3px_8px_rgba(0,0,0,0.2)] enabled:hover:z-10 enabled:hover:scale-[1.04] enabled:hover:shadow-none"}`}
                  style={{ background: `linear-gradient(145deg, ${hexToRgba(cardColor, isSalaAtiva ? 0.88 : 0.65)} 0%, #171027 65%, #120c22 100%)` }}
                  onClick={() => handleSalaClick(sala)}
                  aria-pressed={isSalaAtiva}
                  aria-label={`Abrir a sala ${sala.name}`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#120c22]/70 text-2xl shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/15">{DEFAULT_SALA_ICON}</span>
                    {isSalaAtiva
                      ? <span className="rounded-full bg-[#A486D5] px-2 py-0.5 text-[10px] font-bold text-[#171027]">Atual</span>
                      : <span className="rounded-full bg-[#120c22]/70 px-2 py-0.5 text-[10px] text-[#e2d8f2] ring-1 ring-white/10">Sala</span>}
                  </span>
                  <span className="mt-3 min-w-0">
                    <span className="block truncate text-sm font-bold text-[#f4eeff] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{sala.name}</span>
                    <span className="mt-1 block truncate text-[11px] text-[#e2d8f2] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      <strong className="text-[#f4eeff]">{sala.access_code}</strong>{salaCurso ? ` · ${salaCurso.title}` : ""}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );

  return (
    <div ref={telaRef} className="tela flex min-h-svh">
      <SidebarLeft />

      {loading ? (
        <main className="dashboard dashboard--state min-w-0 flex-1" style={{ paddingLeft: "calc(var(--sidebar-left-width, 230px) + 24px)" }}>Carregando sua trilha...</main>
      ) : errorMessage || !course || !activeModule ? (
        <main className="dashboard dashboard--state relative min-w-0 flex-1 flex-col gap-4" style={{ paddingLeft: "calc(var(--sidebar-left-width, 230px) + 24px)" }}>
          {courses.length > 0 && courseTrigger}
          {coursePickerModal}
          <p>{errorMessage || "Este curso ainda não tem módulos. Selecione outro curso."}</p>
          <Link className="dashboard__link text-sm text-[var(--amarelo-tangerina)] underline" to="/cursos">Ver todos os cursos</Link>
        </main>
      ) : (
        <main className="dashboard relative z-0 flex min-h-svh min-w-0 flex-1 flex-col overflow-hidden select-none leading-[normal] text-[#f4eeff] transition-[background] duration-700" style={{ background: activeTheme.background, color: "#f4eeff" }}>

          <header className="dashboard-header relative flex flex-none flex-col items-center px-6 pb-[14px] pt-[26px] text-center">
            {courseTrigger}
            <h1 className="dashboard-header__title m-[7px_0_0] text-[clamp(26px,4vw,38px)] font-normal tracking-[0.02em] text-[#f4eeff]">{activeItem?.type === "lesson" ? activeItem.aula.title : activeModule.title}</h1>
            {activeSala && <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[rgba(193,150,255,0.34)] bg-[rgba(87,46,151,0.22)] px-3 py-0.5 text-xs text-[#e2d8f2]"><span aria-hidden="true">{DEFAULT_SALA_ICON}</span>Sala: {activeSala.name}</span>}

            {/* Botão do notebook do curso. */}
            <CursoNotebook course={course} />
          </header>

          {coursePickerModal}

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
                      {item.type === "module" ? getModuleIcon(item.module) : completed ? "✓" : locked ? "🔒" : isActive ? "▶" : "○"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {notice && <div className="dashboard-toast fixed bottom-[168px] left-[calc(50%+115px)] z-20 -translate-x-1/2 rounded-xl border border-white/20 bg-[rgba(20,10,43,0.94)] px-[18px] py-2.5 text-[13px] text-[#f4eeff] shadow-[0_10px_30px_rgba(5,2,16,0.5)]" role="status">{notice}</div>}

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
              <button className="module-carousel__arrow" type="button" disabled={dashboardModules.length < 2} onClick={() => moveCarousel(-1)} aria-label="Módulo anterior">‹</button>
              <div className="module-carousel__viewport w-[min(100%,330px)] overflow-hidden">
                <div className="module-carousel__track flex items-end justify-center">
                  {carouselItems.map(({ module, current }) => (
                    <div key={module.id} className={`module-carousel__item flex-[0_0_33.3333%] ${current ? "module-carousel__item--current" : ""}`}>
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
                        <span className="module-carousel__icon">{getModuleIcon(module)}</span>
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
          salaId={activeSalaId}
          cor={openLesson.module.theme.primary}
          jaConcluida={completedLessonIds.has(openLesson.aula.id)}
          onFechar={() => setOpenLesson(null)}
          onConcluida={(lessonId) => void handleLessonCompleted(lessonId)}
        />
      )}
    </div>
  );
}