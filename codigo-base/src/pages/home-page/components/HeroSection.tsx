import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES, logoColor, logoGhost, type HomeStats } from "../data";

interface HeroSectionProps {
  stats: HomeStats | null;
  loading: boolean;
  loggedIn: boolean;
}

const formatNumber = (value: number) => value.toLocaleString("pt-BR");

export default function HeroSection({ stats, loading, loggedIn }: HeroSectionProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const placeholder = loading ? "…" : "—";
  const statItems = [
    { label: "Alunos cadastrados", value: stats ? formatNumber(stats.students) : placeholder },
    { label: "Cursos publicados", value: stats ? formatNumber(stats.courses) : placeholder },
    { label: "Categorias", value: stats ? formatNumber(stats.categories) : placeholder },
    {
      label: "Avaliação média",
      value: stats?.avgRating != null ? `${stats.avgRating.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5` : placeholder,
    },
  ];

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <section className="relative flex flex-col items-center text-center px-6 pt-24 pb-32 overflow-hidden">
      {/* ghost logo watermark */}
      <img
        src={logoGhost}
        alt=""
        aria-hidden="true"
        className="absolute z-0 pointer-events-none select-none"
        style={{ width: 640, height: 640, top: -80, right: -120, opacity: 0.18 }}
      />
      {/* decorative blobs */}
      <div
        className="absolute -top-20 -left-20 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: "#A486D5" }}
      />
      <div
        className="absolute top-40 -right-32 w-80 h-80 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ background: "#FFCC00" }}
      />

      <div className="flex items-center gap-4 mb-8">
        <img
          src={logoColor}
          alt="Athen"
          className="w-40 h-40 rounded-2xl object-cover shadow-xl"
        />
      </div>
      <span
        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full mb-6"
        style={{ background: "rgba(164,134,213,0.15)", border: "1px solid rgba(164,134,213,0.35)", color: "#C9B8E8", fontFamily: "var(--font-ui)" }}
      >
        🎓 Educação criada pela comunidade · Gamificada
      </span>

      <h1
        className="text-5xl md:text-7xl leading-tight max-w-3xl mb-6"
        style={{ fontFamily: "var(--font-display)", color: "#FFCC00", textShadow: "0 0 60px rgba(255,204,0,0.25)" }}
      >
        Aprenda qualquer coisa.
        <br />
        <span style={{ color: "#F4EEFF" }}>Do seu jeito.</span>
      </h1>

      <p
        className="text-lg md:text-xl max-w-xl mb-10 leading-relaxed"
        style={{ color: "#A486D5", fontFamily: "var(--font-body)" }}
      >
        Na Athen, a comunidade cria os cursos — e você aprende ganhando XP, medalhas e subindo de nível. Educação de verdade, do jeito que você merece.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-4 mb-14">
        {loggedIn ? (
          <button
            onClick={() => scrollTo("cursos")}
            className="text-sm font-semibold px-6 py-3 rounded-full transition-transform hover:scale-105"
            style={{ background: "#FFCC00", color: "#54318C", fontFamily: "var(--font-ui)" }}
          >
            Explorar cursos
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate(ROUTES.register, { state: { email: email.trim() } });
            }}
            className="flex items-center gap-2 rounded-full overflow-hidden pl-5 pr-2 py-2"
            style={{ background: "#1A0F35", border: "1px solid rgba(164,134,213,0.3)" }}
          >
            <input
              type="email"
              placeholder="Seu e-mail"
              aria-label="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-transparent outline-none text-sm w-48"
              style={{ fontFamily: "var(--font-ui)", color: "#F4EEFF" }}
            />
            <button
              type="submit"
              className="text-sm font-semibold px-5 py-2 rounded-full transition-transform hover:scale-105"
              style={{ background: "#FFCC00", color: "#54318C", fontFamily: "var(--font-ui)" }}
            >
              Criar conta
            </button>
          </form>
        )}
        <button
          onClick={() => scrollTo("como-funciona")}
          className="text-sm flex items-center gap-2 transition-opacity hover:opacity-75"
          style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}
        >
          ▶ Ver como funciona
        </button>
      </div>

      {/* stats row */}
      <div className="flex flex-wrap justify-center gap-8">
        {statItems.map((s) => (
          <div key={s.label} className="flex flex-col items-center">
            <span
              className="text-2xl md:text-3xl font-bold"
              style={{ fontFamily: "var(--font-display)", color: "#FFCC00" }}
            >
              {s.value}
            </span>
            <span className="text-xs mt-1" style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}>{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
