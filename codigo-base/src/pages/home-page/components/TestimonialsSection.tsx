import { TESTIMONIALS } from "../data";
import TestimonialCard from "./TestimonialCard";

export default function TestimonialsSection() {
  return (
    <section className="px-6 md:px-16 py-16">
      <h2
        className="text-3xl md:text-4xl text-center mb-12"
        style={{ fontFamily: "var(--font-display)", color: "#F4EEFF" }}
      >
        O que a comunidade diz
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {TESTIMONIALS.map((t) => (
          <TestimonialCard key={t.name} testimonial={t} />
        ))}
      </div>
    </section>
  );
}
