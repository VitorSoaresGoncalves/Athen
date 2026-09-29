import type { Course } from "../data";

interface CourseCardProps {
  course: Course;
}

export default function CourseCard({ course: c }: CourseCardProps) {
  return (
    <div
      className="relative rounded-3xl overflow-hidden cursor-pointer group"
      style={{ background: c.bg, minHeight: 220 }}
    >
      <div className="absolute inset-0 flex flex-col justify-between p-5">
        <div>
          <span
            className="inline-block text-xs px-3 py-1 rounded-full mb-4 font-semibold"
            style={{ background: "rgba(0,0,0,0.2)", color: c.accent, fontFamily: "var(--font-ui)" }}
          >
            {c.badge}
          </span>
          <h3
            className="text-xl leading-snug mb-2"
            style={{ fontFamily: "var(--font-display)", color: c.accent }}
          >
            {c.title}
          </h3>
          <p className="text-xs opacity-75" style={{ color: c.accent, fontFamily: "var(--font-ui)" }}>
            por {c.author}
          </p>
        </div>
        <div className="flex items-center justify-between mt-4">
          <span
            className="text-xs font-semibold px-2 py-1 rounded-full"
            style={{ background: "rgba(0,0,0,0.15)", color: c.accent, fontFamily: "var(--font-ui)" }}
          >
            ⚡ {c.xp} XP
          </span>
          <span className="text-xs opacity-60" style={{ color: c.accent, fontFamily: "var(--font-ui)" }}>
            {c.students.toLocaleString("pt-BR")} alunos
          </span>
        </div>
      </div>
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        style={{ background: "rgba(84,49,140,0.7)" }}
      >
        <span
          className="font-semibold text-sm px-5 py-2 rounded-full"
          style={{ background: "#FFCC00", color: "#54318C", fontFamily: "var(--font-ui)" }}
        >
          Começar agora
        </span>
      </div>
    </div>
  );
}
