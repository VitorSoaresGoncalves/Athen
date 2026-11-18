import type { ReactNode } from "react";
import InfoPageLayout, { ActionLink, P, TextLink } from "./InfoPageLayout";

const LINE = "rgba(201, 184, 232, 0.18)";

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 py-7 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10" style={{ borderTop: `1px solid ${LINE}` }}>
      <h3 className="text-xl" style={{ fontFamily: "var(--font-display)", color: "#FFCC00" }}>
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}

export default function SobrePage() {
  return (
    <InfoPageLayout
      title="Estudar rende mais quando dá para ver o caminho"
      intro="O Athen é uma plataforma educacional gamificada. Cada curso vira uma trilha, cada resposta vale XP e o seu progresso fica visível do primeiro módulo ao último."
    >
      <section aria-labelledby="o-que-voce-encontra">
        <h2 id="o-que-voce-encontra" className="text-2xl mb-6" style={{ fontFamily: "var(--font-display)", color: "#F4EEFF" }}>
          O que você encontra no Athen
        </h2>

        <Row title="Cursos e trilhas">
          <P>
            No catálogo você escolhe um curso e se matricula. Os módulos e as aulas aparecem numa trilha que mostra onde você está, o que já concluiu e o que vem a seguir.
          </P>
        </Row>
        <Row title="Aulas com questões">
          <P>
            Cada aula tem questões para responder, com feedback na hora. Ao finalizar a atividade, o resultado e o XP são calculados pela própria plataforma, para que a pontuação seja a mesma para todo mundo.
          </P>
        </Row>
        <Row title="XP, nível e ligas">
          <P>
            O XP que você ganha soma no seu perfil e define seu nível. O ranking e as ligas comparam esse desempenho por temporada, com zonas de subida e descida de categoria.
          </P>
        </Row>
        <Row title="Salas e amigos">
          <P>
            Em uma sala, um grupo estuda junto, com avisos e missões. Com amigos, você acompanha a evolução de quem estuda ao seu lado.
          </P>
        </Row>
        <Row title="Caderno">
          <P>Suas anotações ficam num caderno, e cada curso pode ter o seu, acessível sem sair da trilha.</P>
        </Row>
        <div style={{ borderTop: `1px solid ${LINE}` }} />
      </section>

      <section className="mt-16" aria-labelledby="como-pensamos">
        <h2 id="como-pensamos" className="text-2xl mb-4" style={{ fontFamily: "var(--font-display)", color: "#F4EEFF" }}>
          Como pensamos o produto
        </h2>
        <P>
          Gamificação só ajuda quando é confiável. Por isso as regras de pontuação, conclusão e ranking ficam no banco de dados, e não na tela: o que você vê é o que foi registrado.
        </P>
        <P>
          Também tratamos o seu perfil com cuidado. Você escolhe como aparece para os outros, e explicamos em linguagem simples quais dados guardamos na{" "}
          <TextLink to="/privacidade">Política de Privacidade</TextLink>
          .
        </P>
      </section>

      <section className="mt-16 rounded-3xl p-8 sm:p-10" style={{ background: "rgba(84,49,140,0.35)", border: `1px solid ${LINE}` }} aria-labelledby="comecar">
        <h2 id="comecar" className="text-2xl mb-3" style={{ fontFamily: "var(--font-display)", color: "#FFCC00" }}>
          Pronto para começar?
        </h2>
        <p className="mb-6 leading-relaxed" style={{ color: "#D9CCF0", maxWidth: "52ch" }}>
          Escolha um curso no catálogo ou veja as respostas para as dúvidas mais comuns.
        </p>
        <div className="flex flex-wrap gap-3">
          <ActionLink to="/catalogo" primary>
            Ver catálogo
          </ActionLink>
          <ActionLink to="/ajuda">Central de ajuda</ActionLink>
        </div>
      </section>
    </InfoPageLayout>
  );
}
