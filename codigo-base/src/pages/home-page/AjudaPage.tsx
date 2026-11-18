import { useMemo, useState } from "react";
import InfoPageLayout, { MailLink, TextLink } from "./InfoPageLayout";

const LINE = "rgba(201, 184, 232, 0.18)";
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFCC00]";

interface Faq {
  q: string;
  a: string;
}
interface FaqGroup {
  title: string;
  items: Faq[];
}

// ⚠️ Confira estas respostas com o comportamento atual do produto antes de publicar.
const GROUPS: FaqGroup[] = [
  {
    title: "Começando",
    items: [
      {
        q: "O que é o Athen?",
        a: "Uma plataforma de estudo gamificada. Você faz cursos em trilhas, responde questões, ganha XP e acompanha seu progresso no ranking.",
      },
      {
        q: "Como crio minha conta?",
        a: "Na página inicial, escolha criar conta. Você pode se cadastrar com e-mail e senha ou entrar com sua conta Google. Quando disponível, também é possível confirmar o acesso por um código enviado por SMS.",
      },
      {
        q: "Não recebi o e-mail de confirmação. O que faço?",
        a: "Confira a caixa de spam e veja se o endereço está escrito corretamente. Se o e-mail continuar sem chegar, escreva para a gente informando o endereço cadastrado.",
      },
      {
        q: "Esqueci minha senha.",
        a: "Use a opção de recuperação de senha na tela de login. Se ela não aparecer ou o e-mail não chegar, fale com a gente.",
      },
    ],
  },
  {
    title: "Cursos e aulas",
    items: [
      {
        q: "Como entro em um curso?",
        a: "Abra o Catálogo, escolha um curso e faça a matrícula. Depois disso ele passa a aparecer na sua trilha de estudo.",
      },
      {
        q: "Como funcionam as aulas?",
        a: "Cada aula tem questões. Você responde, recebe feedback e, ao finalizar a atividade, o resultado e o XP são calculados pela plataforma. Aulas sem questões contam como concluídas, mas não rendem XP.",
      },
      {
        q: "Por que uma aula não me deu XP?",
        a: "O XP vem das questões e é calculado quando a tentativa é finalizada. Aulas sem questões não geram XP.",
      },
      {
        q: "Para que serve o caderno?",
        a: "Para guardar suas anotações. Cada curso pode ter um caderno próprio, que você também acessa pela trilha.",
      },
    ],
  },
  {
    title: "XP, ranking e ligas",
    items: [
      {
        q: "O que é XP?",
        a: "É a pontuação que você ganha ao responder questões. Ele soma no seu perfil, define seu nível e sua posição no ranking.",
      },
      {
        q: "Como funcionam as ligas?",
        a: "As ligas funcionam por temporada, com seis categorias. A classificação mostra três zonas: quem sobe de categoria, quem permanece e quem desce. Para as zonas de subida e descida valerem, a liga precisa ter ao menos dez participantes com XP. A tela atualiza sozinha a cada minuto.",
      },
      {
        q: "Posso controlar como apareço no ranking?",
        a: "Sim. Veja as opções de privacidade do perfil em Configurações. Quando a ocultação de identidade está ativa, sua foto não aparece nas ligas.",
      },
    ],
  },
  {
    title: "Salas e amigos",
    items: [
      {
        q: "O que são salas?",
        a: "Espaços para estudar em grupo, com avisos e missões. Se a sala tiver um curso disponível, ele pode fornecer sua trilha inicial mesmo sem matrícula individual.",
      },
      {
        q: "Como adiciono amigos?",
        a: "Pela página Amigos. As solicitações e respostas aparecem em Notificações.",
      },
    ],
  },
  {
    title: "Conta e privacidade",
    items: [
      {
        q: "Como altero minha foto, banner e bio?",
        a: "Abra seu Perfil e use a edição de perfil. Preferências e operações de conta ficam em Configurações.",
      },
      {
        q: "Quais dados vocês guardam sobre mim?",
        a: "Guardamos os dados da conta, do perfil e da sua atividade de estudo. A Política de Privacidade explica cada um, para que servem e como exercer seus direitos.",
      },
      {
        q: "Como excluo minha conta e meus dados?",
        a: "Em Configurações ficam as operações de conta. Se precisar que apaguemos seus dados, escreva para a gente e atenderemos conforme a LGPD.",
      },
    ],
  },
];

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function AjudaPage() {
  const [query, setQuery] = useState("");
  const term = normalize(query.trim());

  const groups = useMemo(() => {
    if (!term) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => normalize(`${i.q} ${i.a}`).includes(term)),
    })).filter((g) => g.items.length > 0);
  }, [term]);

  return (
    <InfoPageLayout
      title="Central de ajuda"
      intro="Respostas rápidas sobre conta, cursos, XP e salas. Se não encontrar o que procura, fale com a gente."
    >
      <div className="mb-10">
        <label htmlFor="busca-ajuda" className="block mb-2 text-sm font-semibold" style={{ color: "#C9B8E8", fontFamily: "var(--font-ui)" }}>
          Buscar uma dúvida
        </label>
        <input
          id="busca-ajuda"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex.: XP, senha, matrícula"
          className={`w-full max-w-md rounded-full px-5 py-3 text-sm ${FOCUS}`}
          style={{ fontFamily: "var(--font-ui)", background: "rgba(255,255,255,0.06)", border: `1px solid ${LINE}`, color: "#F4EEFF" }}
        />
      </div>

      {groups.length === 0 ? (
        <div role="status" className="py-8">
          <p className="mb-2" style={{ color: "#F4EEFF" }}>
            Nenhuma pergunta encontrada para “{query.trim()}”.
          </p>
          <p style={{ color: "#C9B8E8" }}>
            Tente outra palavra ou escreva para <MailLink subject="Dúvida sobre o Athen" />.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {groups.map((g) => (
            <section key={g.title} aria-labelledby={`grupo-${normalize(g.title).replace(/\W+/g, "-")}`}>
              <h2
                id={`grupo-${normalize(g.title).replace(/\W+/g, "-")}`}
                className="text-2xl mb-3"
                style={{ fontFamily: "var(--font-display)", color: "#FFCC00" }}
              >
                {g.title}
              </h2>
              <div style={{ borderTop: `1px solid ${LINE}` }}>
                {g.items.map((item) => (
                  <details key={`${item.q}-${term ? "aberto" : "fechado"}`} open={!!term} className="group" style={{ borderBottom: `1px solid ${LINE}` }}>
                    <summary
                      className={`flex cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden ${FOCUS}`}
                      style={{ color: "#F4EEFF" }}
                    >
                      <span className="font-semibold">{item.q}</span>
                      <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45" style={{ color: "#FFCC00" }}>
                        +
                      </span>
                    </summary>
                    <p className="pb-5 leading-[1.75]" style={{ color: "#D9CCF0", maxWidth: "68ch" }}>
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="mt-16 rounded-3xl p-8 sm:p-10" style={{ background: "rgba(84,49,140,0.35)", border: `1px solid ${LINE}` }} aria-labelledby="contato">
        <h2 id="contato" className="text-2xl mb-3" style={{ fontFamily: "var(--font-display)", color: "#FFCC00" }}>
          Ainda precisa de ajuda?
        </h2>
        <p className="leading-relaxed" style={{ color: "#D9CCF0", maxWidth: "58ch" }}>
          Escreva para <MailLink subject="Preciso de ajuda no Athen" /> contando o que aconteceu e, se puder, em qual página. Dúvidas sobre dados pessoais estão na{" "}
          <TextLink to="/privacidade">Política de Privacidade</TextLink>.
        </p>
      </section>
    </InfoPageLayout>
  );
}
