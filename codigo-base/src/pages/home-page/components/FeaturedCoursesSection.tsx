import { ROUTES, type Course } from "../data";
import { useGuardedNavigate } from "../navigation";
import CourseCard from "./CourseCard";

interface FeaturedCoursesSectionProps {
  courses: Course[];
  loading: boolean;
  error: string | null;
  category: string | null;
  loggedIn: boolean;
  onClearCategory: () => void;
}

export default function FeaturedCoursesSection({ courses, loading, error, category, loggedIn, onClearCategory }: FeaturedCoursesSectionProps) {
  const goTo = useGuardedNavigate();

  return (
    <section id="cursos" className="px-6 md:px-16 py-16">
      <div className="flex items-center justify-between mb-10 gap-4">
        <h2 className="text-3xl md:text-4xl" style={{ fontFamily: "var(--font-display)", color: "#F4EEFF" }}>
          {category ? `Cursos de ${category}` : "Cursos em destaque"}
        </h2>
        {category ? (
          <button onClick={onClearCategory} className="text-sm" style={{ color: "#FFCC00", fontFamily: "var(--font-ui)" }}>
            Limpar filtro ✕
          </button>
        ) : (
          <button
            onClick={() => void goTo(ROUTES.explore)}
            className="text-sm hidden sm:block"
            style={{ color: "#FFCC00", fontFamily: "var(--font-ui)" }}
          >
            Ver todos →
          </button>
        )}
      </div>

      {loading && courses.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-3xl animate-pulse" style={{ background: "#1A0F35", minHeight: 220 }} />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm" style={{ color: "#C9B8E8", fontFamily: "var(--font-ui)" }}>
          Não foi possível carregar os cursos. Atualize a página para tentar de novo.
        </p>
      ) : courses.length === 0 ? (
        <p className="text-sm" style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}>
          {category ? "Nenhum curso publicado nesta categoria ainda." : "Nenhum curso publicado ainda. Que tal criar o primeiro?"}
        </p>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 transition-opacity"
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} loggedIn={loggedIn} />
          ))}
        </div>
      )}
    </section>
  );
}
