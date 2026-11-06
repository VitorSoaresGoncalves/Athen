import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NAV_LINKS, ROUTES, logoColor, type Learner } from "../data";
import { useGuardedNavigate } from "../navigation";

interface HeaderProps {
  me: Learner | null;
  loggedIn: boolean;
  sessionReady: boolean;
  onSignOut: () => void;
}

export default function Header({ me, loggedIn, sessionReady, onSignOut }: HeaderProps) {
  const navigate = useNavigate();
  const goTo = useGuardedNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const greeting = me?.name ?? "Minha conta";

  return (
    <>
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-16 py-4"
        style={{
          background: "rgba(14,8,32,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(164,134,213,0.15)",
        }}
      >
        <a href="#" className="flex items-center gap-2 select-none">
          <img src={logoColor} alt="Athen logo" className="w-9 h-9 rounded-xl object-cover" />
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
              key={l.label}
              href={l.to}
              onClick={(e) => {
                e.preventDefault();
                void goTo(l.to);
              }}
              className="text-sm transition-colors hover:opacity-80"
              style={{ fontFamily: "var(--font-ui)", color: "#C9B8E8" }}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {!sessionReady ? null : loggedIn ? (
            <>
              <span className="text-sm" style={{ fontFamily: "var(--font-ui)", color: "#C9B8E8" }}>
                {me ? `${greeting} · Nível ${me.level}` : greeting}
              </span>
              <button
                onClick={onSignOut}
                className="text-sm px-4 py-2 rounded-full transition-opacity hover:opacity-80"
                style={{ fontFamily: "var(--font-ui)", color: "#A486D5", border: "1px solid #A486D5" }}
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate(ROUTES.login)}
                className="text-sm px-4 py-2 rounded-full transition-opacity hover:opacity-80"
                style={{ fontFamily: "var(--font-ui)", color: "#A486D5", border: "1px solid #A486D5" }}
              >
                Entrar
              </button>
              <button
                onClick={() => navigate(ROUTES.register)}
                className="text-sm px-5 py-2 rounded-full font-semibold transition-transform hover:scale-105"
                style={{ fontFamily: "var(--font-ui)", background: "#FFCC00", color: "#54318C" }}
              >
                Começar grátis
              </button>
            </>
          )}
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
            <a
              key={l.label}
              href={l.to}
              onClick={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                void goTo(l.to);
              }}
              style={{ fontFamily: "var(--font-ui)", color: "#C9B8E8" }}
            >
              {l.label}
            </a>
          ))}
          {sessionReady && loggedIn ? (
            <button
              onClick={onSignOut}
              className="text-sm px-5 py-2 rounded-full font-semibold mt-2"
              style={{ fontFamily: "var(--font-ui)", background: "#FFCC00", color: "#54318C" }}
            >
              Sair
            </button>
          ) : (
            sessionReady && (
              <>
                <button
                  onClick={() => navigate(ROUTES.login)}
                  className="text-sm px-5 py-2 rounded-full"
                  style={{ fontFamily: "var(--font-ui)", color: "#A486D5", border: "1px solid #A486D5" }}
                >
                  Entrar
                </button>
                <button
                  onClick={() => navigate(ROUTES.register)}
                  className="text-sm px-5 py-2 rounded-full font-semibold"
                  style={{ fontFamily: "var(--font-ui)", background: "#FFCC00", color: "#54318C" }}
                >
                  Começar grátis
                </button>
              </>
            )
          )}
        </div>
      )}
    </>
  );
}
