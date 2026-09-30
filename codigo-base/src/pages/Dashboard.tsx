import { useEffect, useRef, useState } from "react";
import "./Dashboard.css";
import { aulaRepository, concluiRepository, cursoRepository, moduloRepository } from "../data/repositories";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type Curso = Database["public"]["Tables"]["Curso"]["Row"];
type Modulo = Database["public"]["Tables"]["Modulo"]["Row"];
type Aula = Database["public"]["Tables"]["Aula"]["Row"];
type ModuleTheme = { primary: string; muted: string };
type ModuleData = Modulo & { aulas: Aula[]; theme: ModuleTheme };

//tema modulo e geometria da trilha.
const FALLBACK_COLORS = ["#06b6d4", "#22c55e", "#a855f7", "#f97316"];
function moduleTheme(module: Modulo, index: number): ModuleTheme {
  const primary = module.Cor_Tema ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  return { primary, muted: `${primary}99` };
}
function trailPosition(index: number) {
  return { x: 120 + index * 150, y: 160 + 92 * Math.sin(index * 0.72) };
}
function trailPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const middle = (previous.x + current.x) / 2;
    path += ` C ${middle} ${previous.y}, ${middle} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}
type TrailItem = { type: "module"; module: ModuleData } | { type: "lesson"; module: ModuleData; aula: Aula };

export default function Dashboard() {
  const [courses, setCourses] = useState<Curso[]>([]);
  const [course, setCourse] = useState<Curso | null>(null);
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const trailRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ dragging: false, startX: 0, scrollLeft: 0, moved: false });

  // Busca cursos, módulos, aulas e conclusões do usuário.
  useEffect(() => {
    async function load() {
      try {
        const availableCourses = await cursoRepository.listar();
        const selected = availableCourses.find((item) => item.Status === "published") ?? availableCourses[0];
        if (!selected) throw new Error("Nenhum curso disponível.");
        const rows = await moduloRepository.listarPorCurso(selected.ID);
        const data = await Promise.all(rows.map(async (module, index) => ({ ...module, aulas: await aulaRepository.listarPorModulo(module.ID), theme: moduleTheme(module, index) })));
        const { data: userData } = await supabase.auth.getUser();
        const conclusions = userData.user ? await concluiRepository.listar() : [];
        setCourses(availableCourses);
        setCourse(selected);
        setModules(data);
        setCompletedIds(new Set(conclusions.map((item) => item.fk_Aula_ID)));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Falha ao carregar o dashboard.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const items: TrailItem[] = modules.flatMap((module) => [
    { type: "module" as const, module },
    ...module.aulas.map((aula) => ({ type: "lesson" as const, module, aula })),
  ]);
  const activeItem = items[activeIndex];
  const activeModule = activeItem?.module;
  const completedCount = activeModule?.aulas.filter((aula) => completedIds.has(aula.ID)).length ?? 0;
  const progress = activeModule?.aulas.length ? Math.round((completedCount / activeModule.aulas.length) * 100) : 0;

  // Conclusão local temporária: até a tela de aula existir, o clique alterna a aula.
  function toggleLesson(item: TrailItem, index: number) {
    if (item.type !== "lesson") return setActiveIndex(index);
    setActiveIndex(index);
    setCompletedIds((current) => {
      const next = new Set(current);
      if (next.has(item.aula.ID)) next.delete(item.aula.ID);
      else next.add(item.aula.ID);
      return next;
    });
  }

  async function changeCourse(id: string) {
    const nextCourse = courses.find((item) => item.ID === id);
    if (!nextCourse) return;
    setCourse(nextCourse);
    const rows = await moduloRepository.listarPorCurso(nextCourse.ID);
    const data = await Promise.all(rows.map(async (module, index) => ({ ...module, aulas: await aulaRepository.listarPorModulo(module.ID), theme: moduleTheme(module, index) })));
    setModules(data);
    setCompletedIds(new Set());
    setActiveIndex(0);
  }

  if (loading || !course || !activeModule) return <main className="dashboard__state">Carregando trilha...</main>;
  
  // seleção visual e arraste horizontal.
  const positions = items.map((_, index) => trailPosition(index));
  const trailWidth = 240 + items.length * 150;
  function pointerDown(clientX: number) {
    if (!trailRef.current) return;
    dragState.current = { dragging: true, startX: clientX, scrollLeft: trailRef.current.scrollLeft, moved: false };
  }
  function pointerMove(clientX: number) {
    if (!trailRef.current || !dragState.current.dragging) return;
    const distance = clientX - dragState.current.startX;
    if (Math.abs(distance) > 5) dragState.current.moved = true;
    trailRef.current.scrollLeft = dragState.current.scrollLeft - distance;
  }
  function pointerUp() { dragState.current.dragging = false; }
  if (error) return <main className="dashboard__state">{error}</main>;

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <label>Curso: <select value={course.ID} onChange={(event) => void changeCourse(event.target.value)}>{courses.map((item) => <option key={item.ID} value={item.ID}>{item.Titulo}</option>)}</select></label>
        <h1>{activeItem?.type === "lesson" ? activeItem.aula.Titulo : activeModule.Titulo}</h1>
      </header>
      <section ref={trailRef} className="dashboard__scroll" onMouseDown={(event) => pointerDown(event.pageX)} onMouseMove={(event) => pointerMove(event.pageX)} onMouseUp={pointerUp} onMouseLeave={pointerUp}>
        <div className="dashboard__canvas" style={{ width: trailWidth }}>
          <svg className="dashboard__svg" width={trailWidth} height="320" aria-hidden="true">
            <path d={trailPath(positions)} fill="none" stroke="#7c5bb599" strokeWidth="5" strokeDasharray="10 8" />
            {activeIndex > 0 && <path d={trailPath(positions.slice(0, activeIndex + 1))} fill="none" stroke={activeItem.module.theme.primary} strokeWidth="5" />}
          </svg>
          {items.map((item, index) => <button key={item.type === "module" ? item.module.ID : item.aula.ID} className={`dashboard__node ${item.type === "lesson" ? "dashboard__node--lesson" : ""}`} style={{ left: positions[index].x - 32, top: positions[index].y - 32, borderColor: item.module.theme.primary }} onClick={() => { if (!dragState.current.moved) toggleLesson(item, index); }}>{item.type === "module" ? item.module.Icone : completedIds.has(item.aula.ID) ? "✓" : index === activeIndex ? "▶" : "○"}</button>)}
        </div>
      </section>
      <p className="dashboard__label">{activeModule.Titulo} — {activeItem?.type === "lesson" ? activeItem.aula.Titulo : "módulo"}</p>
      <div className="dashboard__progress"><span style={{ width: `${progress}%` }} /></div>
      <strong>{progress}% concluído</strong>
    </main>
  );
}