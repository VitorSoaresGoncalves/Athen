import { ROUTES, type Course } from "../data";
import { useGuardedNavigate } from "../navigation";

interface CourseCardProps {
  course: Course;
  loggedIn: boolean;
}

export default function CourseCard({ course: c, loggedIn }: CourseCardProps) {
  const goTo = useGuardedNavigate();
  const hasCover = !!c.coverUrl;
  const accent = hasCover ? "#FFCC00" : c.accent;
  const textColor = hasCover ? "#F4EEFF" : c.accent;

  return (
    <button
      type="button"
      onClick={() => void goTo(ROUTES.course(c.slug))}
      className="relative rounded-3xl overflow-hidden cursor-pointer group text-left w-full"
      style={{
        background: hasCover
          ? `linear-gradient(to top, rgba(14,8,32,0.92), rgba(14,8,32,0.35)), url(${c.coverUrl}) center / cover`
          : c.bg,
        minHeight: 220,
      }}
    >
      <div className="absolute inset-0 flex flex-col justify-between p-5">
        <div>
          <span
            className="inline-block text-xs px-3 py-1 rounded-full mb-4 font-semibold"
            style={{ background: "rgba(0,0,0,0.2)", color: accent, fontFamily: "var(--font-ui)" }}
          >
            {c.badge}
          </span>
          <h3 className="text-xl leading-snug mb-2" style={{ fontFamily: "var(--font-display)", color: accent }}>
            {c.title}
          </h3>
          {c.author && (
            <p className="text-xs opacity-75" style={{ color: textColor, fontFamily: "var(--font-ui)" }}>
              por {c.author}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between mt-4">
          <span
            className="text-xs font-semibold px-2 py-1 rounded-full"
            style={{ background: "rgba(0,0,0,0.15)", color: accent, fontFamily: "var(--font-ui)" }}
          >
            ⚡ {c.xp.toLocaleString("pt-BR")} XP
          </span>
          <span className="text-xs opacity-60" style={{ color: textColor, fontFamily: "var(--font-ui)" }}>
            {c.students.toLocaleString("pt-BR")} {c.students === 1 ? "aluno" : "alunos"}
          </span>
        </div>
      </div>
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex items-center justify-center"
        style={{ background: "rgba(84,49,140,0.7)" }}
      >
        <span
          className="font-semibold text-sm px-5 py-2 rounded-full"
          style={{ background: "#FFCC00", color: "#54318C", fontFamily: "var(--font-ui)" }}
        >
          {loggedIn ? "Começar agora" : "Criar conta para começar"}
        </span>
      </div>
    </button>
  );
}
