import type { Testimonial } from "../data";

interface TestimonialCardProps {
  testimonial: Testimonial;
}

export default function TestimonialCard({ testimonial: t }: TestimonialCardProps) {
  return (
    <div
      className="rounded-3xl p-6 flex flex-col gap-4"
      style={{ background: "#1A0F35", border: "1px solid rgba(164,134,213,0.2)" }}
    >
      {t.rating !== null && (
        <div className="text-sm" style={{ color: "#FFCC00" }} aria-label={`Nota ${t.rating} de 5`}>
          {"★".repeat(t.rating)}
          <span style={{ opacity: 0.25 }}>{"★".repeat(Math.max(0, 5 - t.rating))}</span>
        </div>
      )}
      <p className="text-sm leading-relaxed flex-1" style={{ color: "#C9B8E8", fontFamily: "var(--font-body)" }}>
        {t.text ? `"${t.text}"` : "Aprendendo e ganhando XP na Athen."}
      </p>
      <div className="flex items-center gap-3 pt-2" style={{ borderTop: "1px solid rgba(164,134,213,0.15)" }}>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
          style={{ background: "#54318C", color: "#FFCC00", fontFamily: "var(--font-display)" }}
        >
          {t.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: "#F4EEFF", fontFamily: "var(--font-ui)" }}>{t.name}</div>
          <div className="text-xs truncate" style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}>
            {t.courseTitle ? `sobre ${t.courseTitle}` : `@${t.username}`} · Nível {t.level} · {t.xp.toLocaleString("pt-BR")} XP
          </div>
        </div>
        {t.rank && (
          <span className="ml-auto text-xs font-semibold" style={{ color: "#FFCC00", fontFamily: "var(--font-ui)" }}>#{t.rank}</span>
        )}
      </div>
    </div>
  );
}
