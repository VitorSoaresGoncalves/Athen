import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "../home-page/HomePage.css";
import Header from "../home-page/components/Header";
import Footer from "../home-page/components/Footer";
import { useMe } from "../home-page/hooks";

// ⚠️ Ajuste estes dois valores antes de publicar.
export const CONTACT_EMAIL = "contato@athen.com.br";
export const LAST_UPDATED = "18 de novembro de 2026";

const TEXT = "#D9CCF0";
const MUTED = "#C9B8E8";
const GOLD = "#FFCC00";
const LINE = "rgba(201, 184, 232, 0.18)";
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFCC00]";

// ---------------------------------------------------------------------------
// Blocos de texto reutilizáveis
// ---------------------------------------------------------------------------

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 leading-[1.75]" style={{ color: TEXT, maxWidth: "68ch" }}>
      {children}
    </p>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mb-4 list-disc pl-5 space-y-2 leading-[1.7] marker:text-[#FFCC00]" style={{ color: TEXT, maxWidth: "68ch" }}>
      {children}
    </ul>
  );
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={`underline underline-offset-4 hover:opacity-80 ${FOCUS}`} style={{ color: GOLD }}>
      {children}
    </Link>
  );
}

export function MailLink({ subject }: { subject?: string }) {
  const href = `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return (
    <a href={href} className={`underline underline-offset-4 hover:opacity-80 ${FOCUS}`} style={{ color: GOLD }}>
      {CONTACT_EMAIL}
    </a>
  );
}

export function ActionLink({ to, children, primary = false }: { to: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`inline-block rounded-full px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 ${FOCUS}`}
      style={{
        fontFamily: "var(--font-ui)",
        background: primary ? GOLD : "transparent",
        color: primary ? "#54318C" : MUTED,
        border: primary ? "none" : `1px solid ${LINE}`,
      }}
    >
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Estrutura da página
// ---------------------------------------------------------------------------

interface InfoPageLayoutProps {
  title: string;
  intro: string;
  updatedAt?: string;
  children: ReactNode;
}

export default function InfoPageLayout({ title, intro, updatedAt, children }: InfoPageLayoutProps) {
  const me = useMe();

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden flex flex-col"
      style={{ fontFamily: "var(--font-body)", background: "#0E0820", color: "#F4EEFF" }}
    >
      <Header me={me.profile} loggedIn={me.loggedIn} sessionReady={me.ready} onSignOut={() => void me.signOut()} />

      <main className="flex-1">
        <div style={{ background: "radial-gradient(ellipse 70% 100% at 15% 0%, rgba(84,49,140,0.55), transparent 70%)" }}>
          <div className="mx-auto max-w-5xl px-5 sm:px-8 pt-28 pb-14">
            <h1 className="text-4xl sm:text-5xl leading-tight mb-5" style={{ fontFamily: "var(--font-display)", color: GOLD }}>
              {title}
            </h1>
            <p className="text-lg leading-relaxed" style={{ color: MUTED, maxWidth: "58ch" }}>
              {intro}
            </p>
            {updatedAt && (
              <p className="mt-5 text-sm" style={{ color: MUTED, opacity: 0.75, fontFamily: "var(--font-ui)" }}>
                Atualizado em {updatedAt}
              </p>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-5 sm:px-8 pb-24">{children}</div>
      </main>

      <Footer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documento longo com índice lateral (Privacidade e Termos)
// ---------------------------------------------------------------------------

export interface LegalSection {
  id: string;
  title: string;
  content: ReactNode;
}

export function LegalDocument({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[230px_minmax(0,1fr)]">
      <nav aria-label="Neste documento" className="lg:sticky lg:top-24 self-start">
        <p className="mb-3 text-sm font-semibold" style={{ color: MUTED, fontFamily: "var(--font-ui)" }}>
          Neste documento
        </p>
        <ol className="space-y-2 text-sm" style={{ fontFamily: "var(--font-ui)" }}>
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={`hover:underline underline-offset-4 ${FOCUS}`} style={{ color: TEXT }}>
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div>
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-24 py-8 first:pt-0" style={{ borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
            <h2 className="text-2xl mb-4" style={{ fontFamily: "var(--font-display)", color: GOLD }}>
              {i + 1}. {s.title}
            </h2>
            {s.content}
          </section>
        ))}
      </div>
    </div>
  );
}
