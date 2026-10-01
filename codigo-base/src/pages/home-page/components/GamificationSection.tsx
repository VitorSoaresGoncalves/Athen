import { logoGhost } from "../data";
import LevelCard from "./LevelCard";

const TAGS = ["⚡ XP & Níveis", "🏅 Medalhas", "🏆 Rankings", "🔓 Conquistas", "🎯 Desafios diários"];

export default function GamificationSection() {
  return (
    <section className="relative px-6 md:px-16 py-24 flex flex-col lg:flex-row items-center gap-16 overflow-hidden">
      <img
        src={logoGhost}
        alt=""
        aria-hidden="true"
        className="absolute pointer-events-none select-none"
        style={{ width: 420, height: 420, top: "50%", left: "50%", transform: "translate(-50%, -50%)", opacity: 0.07 }}
      />
      <div className="flex-1">
        <span
          className="text-xs uppercase tracking-widest mb-4 block"
          style={{ color: "#FFCC00", fontFamily: "var(--font-ui)" }}
        >
          Gamificação real
        </span>
        <h2
          className="text-4xl md:text-5xl leading-tight mb-6"
          style={{ fontFamily: "var(--font-display)", color: "#F4EEFF" }}
        >
          Aprender nunca foi
          <br />
          <span style={{ color: "#FFCC00" }}>tão viciante.</span>
        </h2>
        <p className="text-base leading-relaxed mb-8" style={{ color: "#A486D5", fontFamily: "var(--font-body)", maxWidth: 440 }}>
          Cada lição completa te dá XP. Cada módulo finalizado te rende uma medalha. Compete com amigos, suba no ranking e desbloqueie recompensas exclusivas enquanto aprende.
        </p>
        <div className="flex flex-wrap gap-4">
          {TAGS.map((tag) => (
            <span
              key={tag}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ background: "rgba(164,134,213,0.15)", border: "1px solid rgba(164,134,213,0.3)", color: "#C9B8E8", fontFamily: "var(--font-ui)" }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* mock level card */}
      <div className="flex-1 flex justify-center">
        <LevelCard />
      </div>
    </section>
  );
}
