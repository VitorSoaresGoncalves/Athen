import type { Learner } from "../data";

interface LevelCardProps {
  learner: Learner | null;
  leaderXp: number;
  isMine: boolean;
  loading: boolean;
}

const cardStyle = { background: "#1A0F35", border: "1px solid rgba(164,134,213,0.3)", boxShadow: "0 0 60px rgba(84,49,140,0.4)" };

export default function LevelCard({ learner, leaderXp, isMine, loading }: LevelCardProps) {
  if (loading) {
    return <div className="w-72 h-64 rounded-3xl animate-pulse" style={cardStyle} aria-busy="true" />;
  }

  if (!learner) {
    return (
      <div className="w-72 rounded-3xl p-6 text-center" style={cardStyle}>
        <p className="text-sm" style={{ color: "#C9B8E8", fontFamily: "var(--font-ui)" }}>
          O ranking ainda está vazio. Crie sua conta e seja o primeiro a ganhar XP.
        </p>
      </div>
    );
  }

  const progress = leaderXp > 0 ? Math.min(100, Math.round((learner.xp / leaderXp) * 100)) : 0;
  const tiles = [
    { label: "Nível", value: String(learner.level) },
    { label: "XP", value: learner.xp.toLocaleString("pt-BR") },
    { label: "Ranking", value: learner.rank ? `#${learner.rank}` : "—" },
  ];

  return (
    <div className="w-72 rounded-3xl p-6 flex flex-col gap-5" style={cardStyle}>
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold"
          style={{ background: "#54318C", color: "#FFCC00", fontFamily: "var(--font-display)" }}
        >
          {learner.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: "#F4EEFF", fontFamily: "var(--font-ui)" }}>{learner.name}</div>
          <div className="text-xs truncate" style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}>@{learner.username} · Nível {learner.level}</div>
        </div>
        <span
          className="ml-auto text-xs px-2 py-1 rounded-full whitespace-nowrap"
          style={{ background: "#FFCC00", color: "#54318C", fontFamily: "var(--font-ui)", fontWeight: 700 }}
        >
          {isMine ? "Você" : "🏆 Líder"}
        </span>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1" style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}>
          <span>XP: {learner.xp.toLocaleString("pt-BR")}</span>
          <span>Líder: {leaderXp.toLocaleString("pt-BR")}</span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(164,134,213,0.2)" }}>
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #54318C, #FFCC00)" }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center py-2 rounded-xl" style={{ background: "rgba(164,134,213,0.1)" }}>
            <span className="text-base font-semibold" style={{ color: "#F4EEFF", fontFamily: "var(--font-ui)" }}>{value}</span>
            <span className="text-xs mt-1" style={{ color: "#C9B8E8", fontFamily: "var(--font-ui)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
