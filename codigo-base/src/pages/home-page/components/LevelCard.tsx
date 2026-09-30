const TOP_CATEGORIES = [
  { icon: "🧬", label: "Ciências" },
  { icon: "💻", label: "Tech" },
  { icon: "🎨", label: "Arte" },
];

const RECENT_ACHIEVEMENTS = ["🔥", "⚡", "📚", "🎯", "🌟"];

export default function LevelCard() {
  return (
    <div
      className="w-72 rounded-3xl p-6 flex flex-col gap-5"
      style={{ background: "#1A0F35", border: "1px solid rgba(164,134,213,0.3)", boxShadow: "0 0 60px rgba(84,49,140,0.4)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold"
          style={{ background: "#54318C", color: "#FFCC00", fontFamily: "var(--font-display)" }}
        >
          A
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: "#F4EEFF", fontFamily: "var(--font-ui)" }}>Ana Ribeiro</div>
          <div className="text-xs" style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}>@anaribeiro · Nível 7</div>
        </div>
        <span
          className="ml-auto text-xs px-2 py-1 rounded-full"
          style={{ background: "#FFCC00", color: "#54318C", fontFamily: "var(--font-ui)", fontWeight: 700 }}
        >
          🏆 Top 50
        </span>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1" style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}>
          <span>XP: 4.820</span>
          <span>Próximo nível: 6.000</span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(164,134,213,0.2)" }}>
          <div className="h-full rounded-full" style={{ width: "80%", background: "linear-gradient(90deg, #54318C, #FFCC00)" }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {TOP_CATEGORIES.map(({ icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center py-2 rounded-xl"
            style={{ background: "rgba(164,134,213,0.1)" }}
          >
            <span className="text-xl">{icon}</span>
            <span className="text-xs mt-1" style={{ color: "#C9B8E8", fontFamily: "var(--font-ui)" }}>{label}</span>
          </div>
        ))}
      </div>

      <div>
        <div className="text-xs mb-2" style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}>Conquistas recentes</div>
        <div className="flex gap-2">
          {RECENT_ACHIEVEMENTS.map((e) => (
            <span
              key={e}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{ background: "rgba(255,204,0,0.1)", border: "1px solid rgba(255,204,0,0.3)" }}
            >
              {e}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
