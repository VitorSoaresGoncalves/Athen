import InfoPageLayout, { LAST_UPDATED, LegalDocument, MailLink, P, TextLink, UL, type LegalSection } from "./InfoPageLayout";

// ⚠️ Texto-base. Preencha os dados do responsável e revise com assessoria jurídica antes de publicar.
const SECTIONS: LegalSection[] = [
  {
    id: "aceitacao",
    title: "Aceitação dos termos",
    content: (
      <>
        <P>
          Ao criar uma conta ou usar o Athen, você concorda com estes Termos de Uso e com a <TextLink to="/privacidade">Política de Privacidade</TextLink>. Se não concordar, não utilize a plataforma.
        </P>
        <P>O serviço é oferecido por [NOME DO RESPONSÁVEL / ORGANIZAÇÃO]. Dúvidas podem ser enviadas para <MailLink subject="Termos de Uso" />.</P>
      </>
    ),
  },
  {
    id: "servico",
    title: "O que é o serviço",
    content: (
      <P>
        O Athen é uma plataforma educacional gamificada, com cursos organizados em trilhas, aulas com questões, XP, níveis, rankings, ligas, salas, amigos e caderno de anotações. Os recursos podem mudar, ser acrescentados ou retirados ao longo do tempo.
      </P>
    ),
  },
  {
    id: "conta",
    title: "Sua conta",
    content: (
      <>
        <UL>
          <li>Você deve fornecer informações verdadeiras e mantê-las atualizadas.</li>
          <li>Você é responsável por manter sua senha e seus códigos de acesso em segredo e por tudo o que acontece na sua conta.</li>
          <li>Cada pessoa deve ter uma única conta. Avise-nos se suspeitar de acesso indevido.</li>
          <li>Menores de 18 anos devem usar o Athen com ciência e autorização dos pais ou responsáveis.</li>
        </UL>
      </>
    ),
  },
  {
    id: "conduta",
    title: "Como usar a plataforma",
    content: (
      <>
        <P>Ao usar o Athen, você se compromete a não:</P>
        <UL>
          <li>burlar o sistema de pontuação, como automatizar respostas, explorar falhas ou criar contas para ganhar XP;</li>
          <li>assediar, ameaçar, discriminar ou expor outras pessoas em salas, avaliações, nomes de usuário ou bios;</li>
          <li>publicar conteúdo ilegal, ofensivo, enganoso ou que viole direitos de terceiros;</li>
          <li>tentar acessar dados de outras pessoas, sobrecarregar ou interferir no funcionamento da plataforma;</li>
          <li>copiar ou redistribuir conteúdos de cursos fora do que a plataforma permite.</li>
        </UL>
      </>
    ),
  },
  {
    id: "conteudo",
    title: "Conteúdo criado por você",
    content: (
      <>
        <P>
          Cursos, avaliações, anotações, bio, foto e outros conteúdos que você publica continuam sendo seus. Para que o serviço funcione, você nos autoriza a armazenar, exibir e processar esse conteúdo dentro do Athen, de acordo com a visibilidade que você escolher.
        </P>
        <P>
          Se você cria cursos, é responsável por ter os direitos sobre o material publicado. Podemos remover conteúdo que viole estes termos ou direitos de terceiros.
        </P>
      </>
    ),
  },
  {
    id: "pontuacao",
    title: "XP, rankings e ligas",
    content: (
      <>
        <P>
          O XP, o nível, as conclusões, o ranking e as ligas são calculados pela plataforma. O resultado registrado pelo sistema é o oficial.
        </P>
        <P>
          Podemos corrigir inconsistências e anular pontuação obtida por fraude, erro ou violação destes termos, o que pode alterar sua posição no ranking e nas ligas. XP, níveis e posições não têm valor monetário e não podem ser trocados ou vendidos.
        </P>
      </>
    ),
  },
  {
    id: "propriedade",
    title: "Propriedade intelectual",
    content: (
      <P>
        O nome Athen, a identidade visual, o software e os materiais produzidos pela plataforma pertencem ao responsável pelo serviço ou a seus licenciantes. Estes termos não transferem a você nenhum direito sobre eles, além do uso pessoal do serviço.
      </P>
    ),
  },
  {
    id: "disponibilidade",
    title: "Disponibilidade do serviço",
    content: (
      <P>
        Trabalhamos para manter o Athen disponível, mas não garantimos funcionamento ininterrupto ou livre de erros. Podemos interromper o serviço temporariamente para manutenção, correções ou por motivos fora do nosso controle.
      </P>
    ),
  },
  {
    id: "suspensao",
    title: "Suspensão e encerramento",
    content: (
      <P>
        Você pode parar de usar o Athen e pedir a exclusão da conta quando quiser. Podemos suspender ou encerrar contas que violem estes termos, com aviso quando possível. O tratamento dos dados após o encerramento segue a Política de Privacidade.
      </P>
    ),
  },
  {
    id: "responsabilidade",
    title: "Limites de responsabilidade",
    content: (
      <P>
        O Athen é uma ferramenta de apoio ao estudo e não garante resultados em provas, concursos ou avaliações. Dentro do que a lei permite, não respondemos por danos indiretos decorrentes do uso do serviço ou de conteúdos de terceiros. Isso não afasta direitos que o Código de Defesa do Consumidor assegura a você.
      </P>
    ),
  },
  {
    id: "mudancas",
    title: "Mudanças nestes termos",
    content: (
      <P>
        Podemos atualizar estes termos. Quando a mudança for relevante, avisaremos pelo serviço ou por e-mail antes de ela valer. Continuar usando o Athen depois disso significa que você aceita a nova versão.
      </P>
    ),
  },
  {
    id: "lei",
    title: "Lei aplicável e foro",
    content: (
      <P>
        Estes termos seguem as leis do Brasil. Para resolver conflitos, fica eleito o foro do domicílio do usuário, quando ele for consumidor, ou o foro de [COMARCA], nos demais casos.
      </P>
    ),
  },
];

export default function TermosPage() {
  return (
    <InfoPageLayout
      title="Termos de Uso"
      intro="As regras para usar o Athen: o que esperamos de você, o que você pode esperar de nós e como tratamos XP, conteúdo e contas."
      updatedAt={LAST_UPDATED}
    >
      <LegalDocument sections={SECTIONS} />
    </InfoPageLayout>
  );
}
