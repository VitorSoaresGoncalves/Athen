import type { Learner, Testimonial } from "../data";
import TestimonialCard from "./TestimonialCard";

interface TestimonialsSectionProps {
  testimonials: Testimonial[]; // avaliações reais com comentário
  learners: Learner[]; // alternativa: top do ranking, quando ainda não há comentários
  loading: boolean;
}

const fromLearner = (l: Learner): Testimonial => ({
  id: l.id,
  text: l.bio,
  name: l.name,
  username: l.username,
  level: l.level,
  xp: l.xp,
  rating: null,
  courseTitle: null,
  rank: l.rank,
});

export default function TestimonialsSection({ testimonials, learners, loading }: TestimonialsSectionProps) {
  const hasReviews = testimonials.length > 0;
  const items = hasReviews ? testimonials : learners.map(fromLearner);

  if (!loading && items.length === 0) return null;

  return (
    <section className="px-6 md:px-16 py-16">
      <h2 className="text-3xl md:text-4xl text-center mb-12" style={{ fontFamily: "var(--font-display)", color: "#F4EEFF" }}>
        {hasReviews ? "O que a comunidade diz" : "Quem está no topo da comunidade"}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {loading && items.length === 0
          ? Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-40 rounded-3xl animate-pulse" style={{ background: "#1A0F35" }} />
            ))
          : items.map((t) => <TestimonialCard key={t.id} testimonial={t} />)}
      </div>
    </section>
  );
}
