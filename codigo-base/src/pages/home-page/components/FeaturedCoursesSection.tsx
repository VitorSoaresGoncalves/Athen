import { COURSES } from "../data";
import CourseCard from "./CourseCard";

export default function FeaturedCoursesSection() {
  return (
    <section className="px-6 md:px-16 py-16">
      <div className="flex items-center justify-between mb-10">
        <h2
          className="text-3xl md:text-4xl"
          style={{ fontFamily: "var(--font-display)", color: "#F4EEFF" }}
        >
          Cursos em destaque
        </h2>
        <a href="#" className="text-sm hidden sm:block" style={{ color: "#FFCC00", fontFamily: "var(--font-ui)" }}>
          Ver todos →
        </a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {COURSES.map((c) => (
          <CourseCard key={c.title} course={c} />
        ))}
      </div>
    </section>
  );
}
