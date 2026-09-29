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
      <p className="text-sm leading-relaxed flex-1" style={{ color: "#C9B8E8", fontFamily: "var(--font-body)" }}>
        "{t.text}"
      </p>
      <div className="flex items-center gap-3 pt-2" style={{ borderTop: "1px solid rgba(164,134,213,0.15)" }}>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
          style={{ background: "#54318C", color: "#FFCC00", fontFamily: "var(--font-display)" }}
        >
          {t.avatar}
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: "#F4EEFF", fontFamily: "var(--font-ui)" }}>{t.name}</div>
          <div className="text-xs" style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}>{t.xp}</div>
        </div>
      </div>
    </div>
  );
}
