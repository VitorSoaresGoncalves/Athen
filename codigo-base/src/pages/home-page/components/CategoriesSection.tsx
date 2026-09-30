import { CATEGORIES } from "../data";

export default function CategoriesSection() {
  return (
    <section className="px-6 md:px-16 py-16">
      <h2
        className="text-3xl md:text-4xl text-center mb-10"
        style={{ fontFamily: "var(--font-display)", color: "#F4EEFF" }}
      >
        Explore por categoria
      </h2>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.label}
            className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all hover:scale-105 hover:shadow-lg"
            style={{ background: "#1A0F35", border: "1px solid rgba(164,134,213,0.2)" }}
          >
            <span className="text-2xl">{c.icon}</span>
            <span className="text-xs text-center leading-tight" style={{ color: "#C9B8E8", fontFamily: "var(--font-ui)" }}>
              {c.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
