import { useState } from "react";
import "./HomePage.css";
const logoColor = "/Athen.png";
const logoGhost = "/Athen_ghost.png";

const NAV_LINKS = ["Explorar", "Comunidade", "Ranking", "Criar Curso"];

const CATEGORIES = [
  { icon: "🧬", label: "Ciências" },
  { icon: "🎨", label: "Arte & Design" },
  { icon: "💻", label: "Tecnologia" },
  { icon: "📚", label: "Literatura" },
  { icon: "🎵", label: "Música" },
  { icon: "🌍", label: "Idiomas" },
  { icon: "🧮", label: "Matemática" },
  { icon: "🏛️", label: "História" },
];

const COURSES = [
  {
    title: "Introdução à Astronomia",
    author: "stella_cosmo",
    xp: 1200,
    students: 3847,
    badge: "⭐ Em Alta",
    bg: "#54318C",
    accent: "#FFCC00",
  },
  {
    title: "Python para Iniciantes",
    author: "dev_lucas",
    xp: 950,
    students: 7210,
    badge: "🔥 Popular",
    bg: "#FFCC00",
    accent: "#54318C",
  },
  {
    title: "História da Arte Medieval",
    author: "arte_viva",
    xp: 780,
    students: 2103,
    badge: "🆕 Novo",
    bg: "#A486D5",
    accent: "#FFEB99",
  },
  {
    title: "Lógica e Pensamento Crítico",
    author: "filosofia_on",
    xp: 1100,
    students: 5589,
    badge: "🏆 Top Avaliado",
    bg: "#FFDE5C",
    accent: "#54318C",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Explore cursos da comunidade",
    desc: "Descubra milhares de cursos criados por pessoas apaixonadas pelos seus temas.",
  },
  {
    step: "02",
    title: "Aprenda e ganhe XP",
    desc: "Complete lições, responda desafios e acumule pontos de experiência a cada avanço.",
  },
  {
    step: "03",
    title: "Suba de nível e desbloqueie conquistas",
    desc: "Evolua seu perfil, conquiste medalhas e apareça no ranking global da plataforma.",
  },
  {
    step: "04",
    title: "Crie e compartilhe seu curso",
    desc: "Use nosso editor intuitivo para montar seu próprio curso e contribuir com a comunidade.",
  },
];

const STATS = [
  { value: "48.000+", label: "Alunos ativos" },
  { value: "12.500+", label: "Cursos criados" },
  { value: "320+", label: "Categorias" },
  { value: "99%", label: "Satisfação" },
];

const TESTIMONIALS = [
  {
    name: "Marina Souza",
    handle: "@marinasouza",
    avatar: "M",
    text: "Comecei como aluna e em três meses já lancei meu primeiro curso sobre permacultura. A comunidade é incrível!",
    xp: "Nível 12 · 8.400 XP",
  },
  {
    name: "Carlos Henrique",
    handle: "@carlosdev",
    avatar: "C",
    text: "A gamificação faz toda a diferença. Nunca aprendi tanto em tão pouco tempo. Virei viciado em subir de nível.",
    xp: "Nível 18 · 15.200 XP",
  },
  {
    name: "Fernanda Lima",
    handle: "@fernandalima",
    avatar: "F",
    text: "O que me surpreendeu foi a qualidade dos cursos feitos por pessoas comuns. Muito melhor que plataformas tradicionais.",
    xp: "Nível 9 · 5.800 XP",
  },
];

export default function InitialPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden"
      style={{ fontFamily: "var(--font-body)", background: "#0E0820", color: "#F4EEFF" }}
    >
      {/* Nav */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-16 py-4"
        style={{ background: "rgba(14,8,32,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(164,134,213,0.15)" }}
      >
        <a href="#" className="flex items-center gap-2 select-none">
          <img
            src={logoColor}
            alt="Athen logo"
            className="w-9 h-9 rounded-xl object-cover"
          />
          <span
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "#FFCC00", letterSpacing: "0.04em" }}
          >
            athen
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <a
              key={l}
              href="#"
              className="text-sm transition-colors hover:opacity-80"
              style={{ fontFamily: "var(--font-ui)", color: "#C9B8E8" }}
            >
              {l}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            className="text-sm px-4 py-2 rounded-full transition-opacity hover:opacity-80"
            style={{ fontFamily: "var(--font-ui)", color: "#A486D5", border: "1px solid #A486D5" }}
          >
            Entrar
          </button>
          <button
            className="text-sm px-5 py-2 rounded-full font-semibold transition-transform hover:scale-105"
            style={{ fontFamily: "var(--font-ui)", background: "#FFCC00", color: "#54318C" }}
          >
            Começar grátis
          </button>
        </div>

        <button className="md:hidden p-2" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
          <span style={{ color: "#FFCC00", fontSize: 24 }}>{menuOpen ? "✕" : "☰"}</span>
        </button>
      </header>

      {menuOpen && (
        <div
          className="md:hidden flex flex-col gap-4 px-6 py-6"
          style={{ background: "#1A0F35", borderBottom: "1px solid rgba(164,134,213,0.2)" }}
        >
          {NAV_LINKS.map((l) => (
            <a key={l} href="#" style={{ fontFamily: "var(--font-ui)", color: "#C9B8E8" }}>{l}</a>
          ))}
          <button
            className="text-sm px-5 py-2 rounded-full font-semibold mt-2"
            style={{ fontFamily: "var(--font-ui)", background: "#FFCC00", color: "#54318C" }}
          >
            Começar grátis
          </button>
        </div>
      )}

      {/* Hero */}
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
          <div
            className="flex items-center gap-2 rounded-full overflow-hidden pl-5 pr-2 py-2"
            style={{ background: "#1A0F35", border: "1px solid rgba(164,134,213,0.3)" }}
          >
            <input
              type="email"
              placeholder="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-transparent outline-none text-sm w-48"
              style={{ fontFamily: "var(--font-ui)", color: "#F4EEFF" }}
            />
            <button
              className="text-sm font-semibold px-5 py-2 rounded-full transition-transform hover:scale-105"
              style={{ background: "#FFCC00", color: "#54318C", fontFamily: "var(--font-ui)" }}
            >
              Entrar
            </button>
          </div>
          <button
            className="text-sm flex items-center gap-2 transition-opacity hover:opacity-75"
            style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}
          >
            ▶ Ver como funciona
          </button>
        </div>

        {/* stats row */}
        <div className="flex flex-wrap justify-center gap-8">
          {STATS.map((s) => (
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

      {/* Categories */}
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

      {/* Featured Courses */}
      <section className="px-6 md:px-16 py-16">
        <div className="flex items-center justify-between mb-10">
          <h2
            className="text-3xl md:text-4xl"
            style={{ fontFamily: "var(--font-display)", color: "#F4EEFF" }}
          >
            Cursos em destaque
          </h2>
          <a href="#" className="text-sm hidden sm:block" style={{ color: "#FFCC00", fontFamily: "var(--font-ui)" }}>
            Ver todos →
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {COURSES.map((c) => (
            <div
              key={c.title}
              className="relative rounded-3xl overflow-hidden cursor-pointer group"
              style={{ background: c.bg, minHeight: 220 }}
            >
              <div className="absolute inset-0 flex flex-col justify-between p-5">
                <div>
                  <span
                    className="inline-block text-xs px-3 py-1 rounded-full mb-4 font-semibold"
                    style={{ background: "rgba(0,0,0,0.2)", color: c.accent, fontFamily: "var(--font-ui)" }}
                  >
                    {c.badge}
                  </span>
                  <h3
                    className="text-xl leading-snug mb-2"
                    style={{ fontFamily: "var(--font-display)", color: c.accent }}
                  >
                    {c.title}
                  </h3>
                  <p className="text-xs opacity-75" style={{ color: c.accent, fontFamily: "var(--font-ui)" }}>
                    por {c.author}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded-full"
                    style={{ background: "rgba(0,0,0,0.15)", color: c.accent, fontFamily: "var(--font-ui)" }}
                  >
                    ⚡ {c.xp} XP
                  </span>
                  <span className="text-xs opacity-60" style={{ color: c.accent, fontFamily: "var(--font-ui)" }}>
                    {c.students.toLocaleString("pt-BR")} alunos
                  </span>
                </div>
              </div>
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                style={{ background: "rgba(84,49,140,0.7)" }}
              >
                <span
                  className="font-semibold text-sm px-5 py-2 rounded-full"
                  style={{ background: "#FFCC00", color: "#54318C", fontFamily: "var(--font-ui)" }}
                >
                  Começar agora
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        className="px-6 md:px-16 py-24 my-8 mx-4 md:mx-16 rounded-3xl"
        style={{ background: "linear-gradient(135deg, #1A0F35 0%, #2D1A52 100%)", border: "1px solid rgba(164,134,213,0.2)" }}
      >
        <h2
          className="text-3xl md:text-4xl text-center mb-14"
          style={{ fontFamily: "var(--font-display)", color: "#FFCC00" }}
        >
          Como funciona a Athen?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {HOW_IT_WORKS.map((item, i) => (
            <div key={item.step} className="flex flex-col gap-3">
              <div
                className="text-5xl font-bold mb-2"
                style={{ fontFamily: "var(--font-display)", color: i % 2 === 0 ? "#FFCC00" : "#A486D5", opacity: 0.4 }}
              >
                {item.step}
              </div>
              <h3
                className="text-xl leading-snug"
                style={{ fontFamily: "var(--font-display)", color: "#F4EEFF" }}
              >
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "#A486D5", fontFamily: "var(--font-body)" }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Gamification highlight */}
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
            {["⚡ XP & Níveis", "🏅 Medalhas", "🏆 Rankings", "🔓 Conquistas", "🎯 Desafios diários"].map((tag) => (
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
              {[["🧬", "Ciências"], ["💻", "Tech"], ["🎨", "Arte"]].map(([icon, label]) => (
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
                {["🔥", "⚡", "📚", "🎯", "🌟"].map((e) => (
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
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 md:px-16 py-16">
        <h2
          className="text-3xl md:text-4xl text-center mb-12"
          style={{ fontFamily: "var(--font-display)", color: "#F4EEFF" }}
        >
          O que a comunidade diz
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
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
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        className="mx-4 md:mx-16 mb-16 rounded-3xl px-8 py-20 flex flex-col items-center text-center relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #54318C 0%, #A486D5 100%)" }}
      >
        <div
          className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: "#FFCC00", transform: "translate(30%, -30%)" }}
        />
        {/* ghost watermark no CTA */}
        <img
          src={logoGhost}
          alt=""
          aria-hidden="true"
          className="absolute pointer-events-none select-none"
          style={{ width: 500, height: 500, bottom: -60, left: -80, opacity: 0.12 }}
        />
        <img
          src={logoColor}
          alt="Athen"
          className="w-30 h-30 rounded-3xl object-cover mb-6 relative z-10"
        />
        <h2
          className="text-4xl md:text-5xl max-w-2xl leading-tight mb-6 relative z-10"
          style={{ fontFamily: "var(--font-display)", color: "#FFCC00" }}
        >
          Pronto para começar sua jornada?
        </h2>
        <p className="text-base mb-10 max-w-md relative z-10" style={{ color: "#F4EEFF", fontFamily: "var(--font-body)" }}>
          Junte-se a mais de 48.000 alunos e criadores que estão transformando a forma de aprender.
        </p>
        <button
          className="text-base font-semibold px-10 py-4 rounded-full transition-transform hover:scale-105 relative z-10"
          style={{ background: "#FFCC00", color: "#54318C", fontFamily: "var(--font-ui)" }}
        >
          Criar minha conta grátis →
        </button>
      </section>

      {/* Footer */}
      <footer
        className="px-6 md:px-16 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8"
        style={{ borderTop: "1px solid rgba(164,134,213,0.15)" }}
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <img
              src={logoColor}
              alt="Athen"
              className="w-8 h-8 rounded-lg object-cover"
            />
            <span
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-display)", color: "#FFCC00" }}
            >
              athen
            </span>
          </div>
          <p className="text-xs mt-2 max-w-xs" style={{ color: "#A486D5", fontFamily: "var(--font-body)" }}>
            Plataforma educacional gamificada criada pela comunidade.
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          {["Sobre", "Blog", "Carreiras", "Ajuda", "Privacidade", "Termos"].map((l) => (
            <a key={l} href="#" className="text-xs hover:opacity-80 transition-opacity" style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}>
              {l}
            </a>
          ))}
        </div>
        <p className="text-xs" style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}>
          © 2026 Athen. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
