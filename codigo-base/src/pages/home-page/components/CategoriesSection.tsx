import type { Category } from "../data";

interface CategoriesSectionProps {
  categories: Category[];
  loading: boolean;
  error: string | null;
  selected: string | null;
  onSelect: (label: string) => void;
}

export default function CategoriesSection({ categories, loading, error, selected, onSelect }: CategoriesSectionProps) {
  return (
    <section className="px-6 md:px-16 py-16">
      <h2
        className="text-3xl md:text-4xl text-center mb-10"
        style={{ fontFamily: "var(--font-display)", color: "#F4EEFF" }}
      >
        Explore por categoria
      </h2>

      {loading ? (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "#1A0F35" }} />
          ))}
        </div>
      ) : error ? (
        <p className="text-center text-sm" style={{ color: "#C9B8E8", fontFamily: "var(--font-ui)" }}>
          Não foi possível carregar as categorias. Atualize a página para tentar de novo.
        </p>
      ) : categories.length === 0 ? (
        <p className="text-center text-sm" style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}>
          As categorias aparecem aqui assim que os primeiros cursos forem publicados.
        </p>
      ) : (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {categories.map((c) => {
            const active = selected === c.label;
            return (
              <button
                key={c.label}
                onClick={() => onSelect(c.label)}
                aria-pressed={active}
                title={`${c.count} ${c.count === 1 ? "curso" : "cursos"}`}
                className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all hover:scale-105 hover:shadow-lg"
                style={{
                  background: active ? "#54318C" : "#1A0F35",
                  border: `1px solid ${active ? "#FFCC00" : "rgba(164,134,213,0.2)"}`,
                }}
              >
                <span className="text-2xl">{c.icon}</span>
                <span className="text-xs text-center leading-tight" style={{ color: "#C9B8E8", fontFamily: "var(--font-ui)" }}>
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
