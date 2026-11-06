import { logoColor } from "../data";

const FOOTER_LINKS = ["Sobre", "Blog", "Carreiras", "Ajuda", "Privacidade", "Termos"];

export default function Footer() {
  return (
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
        {FOOTER_LINKS.map((l) => (
          <a key={l} href="#" className="text-xs hover:opacity-80 transition-opacity" style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}>
            {l}
          </a>
        ))}
      </div>
      <p className="text-xs" style={{ color: "#A486D5", fontFamily: "var(--font-ui)" }}>
        © 2026 Athen. Todos os direitos reservados.
      </p>
    </footer>
  );
}
