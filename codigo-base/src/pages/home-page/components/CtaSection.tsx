import { logoColor, logoGhost } from "../data";

export default function CtaSection() {
  return (
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
  );
}
