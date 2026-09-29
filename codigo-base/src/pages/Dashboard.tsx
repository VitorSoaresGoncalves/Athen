import { useEffect, useState } from "react";
import "./Dashboard.css";
import { aulaRepository, cursoRepository, moduloRepository } from "../data/repositories";
import type { Database } from "../types/database";

type Curso = Database["public"]["Tables"]["Curso"]["Row"];
type Modulo = Database["public"]["Tables"]["Modulo"]["Row"];
type Aula = Database["public"]["Tables"]["Aula"]["Row"];

type ModuleData = Modulo & { aulas: Aula[] };

export default function Dashboard() {
  const [courses, setCourses] = useState<Curso[]>([]);
  const [course, setCourse] = useState<Curso | null>(null);
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Busca os cursos disponíveis e seleciona o primeiro curso publicado.
  useEffect(() => {
    async function loadCourses() {
      try {
        const availableCourses = await cursoRepository.listar();
        const selectedCourse = availableCourses.find((item) => item.Status === "published") ?? availableCourses[0];
        if (!selectedCourse) throw new Error("Nenhum curso disponível.");
        setCourses(availableCourses);
        setCourse(selectedCourse);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Falha ao buscar cursos.");
      }
    }
    void loadCourses();
  }, []);

  // Busca os módulos do curso e as aulas de cada módulo.
  useEffect(() => {
    if (!course) return;
    async function loadTrail() {
      setLoading(true);
      try {
        const moduleRows = await moduloRepository.listarPorCurso(course!.ID);
        const data = await Promise.all(moduleRows.map(async (module) => ({
          ...module,
          aulas: await aulaRepository.listarPorModulo(module.ID),
        })));
        setModules(data);
        setActiveIndex(0);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Falha ao buscar a trilha.");
      } finally {
        setLoading(false);
      }
    }
    void loadTrail();
  }, [course]);

  const items = modules.flatMap((module) => [
    { type: "module" as const, module, title: module.Titulo },
    ...module.aulas.map((aula) => ({ type: "lesson" as const, module, title: aula.Titulo })),
  ]);

  if (loading || !course) return <main className="dashboard__loading">Carregando trilha...</main>;
  if (error) return <main className="dashboard__error">{error}</main>;

  return (
    <main className="dashboard">
      <label className="dashboard__title">Curso: <select value={course.ID} onChange={(event) => setCourse(courses.find((item) => item.ID === event.target.value) ?? course)}>{courses.map((item) => <option key={item.ID} value={item.ID}>{item.Titulo}</option>)}</select></label>
      <section className="dashboard__trail">
        {items.map((item, index) => <button key={`${item.module.ID}-${item.title}`} className={`dashboard__node ${item.type === "lesson" ? "dashboard__node--lesson" : ""}`} onClick={() => setActiveIndex(index)}>{item.type === "module" ? item.module.Icone : index === activeIndex ? "▶" : "○"}</button>)}
      </section>
      <p className="dashboard__module">{items[activeIndex]?.module.Titulo} — {items[activeIndex]?.title}</p>
    </main>
  );
}
