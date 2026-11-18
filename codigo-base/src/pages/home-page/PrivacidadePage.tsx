import InfoPageLayout, { LAST_UPDATED, LegalDocument, MailLink, P, TextLink, UL, type LegalSection } from "./InfoPageLayout";

// ⚠️ Texto-base alinhado ao que o projeto faz hoje (Supabase, Google OAuth, SMS, e-mail, Storage).
// Preencha os dados do controlador e revise com assessoria jurídica antes de publicar.
const SECTIONS: LegalSection[] = [
  {
    id: "quem-somos",
    title: "Quem é o responsável pelos seus dados",
    content: (
      <>
        <P>
          O Athen é a plataforma educacional gamificada à qual esta política se refere. O controlador dos dados pessoais é [NOME DO RESPONSÁVEL / ORGANIZAÇÃO], que pode ser contatado em <MailLink subject="Privacidade e dados pessoais" />.
        </P>
        <P>Esta política segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, a LGPD).</P>
      </>
    ),
  },
  {
    id: "dados-coletados",
    title: "Quais dados coletamos",
    content: (
      <>
        <UL>
          <li>
            <strong>Conta:</strong> e-mail, nome de exibição, nome de usuário e, quando você usa essa opção, número de telefone para código por SMS. A senha é tratada pelo sistema de autenticação e não fica legível para nós. Se você entra com Google, recebemos os dados básicos da conta autorizados por você.
          </li>
          <li>
            <strong>Perfil:</strong> bio, foto de avatar e banner, nível e XP.
          </li>
          <li>
            <strong>Atividade de estudo:</strong> matrículas, tentativas, respostas, conclusões de aulas, XP, avaliações de cursos e posição em rankings e ligas.
          </li>
          <li>
            <strong>Conteúdo que você cria:</strong> anotações do caderno e dados de salas que você cria ou frequenta.
          </li>
          <li>
            <strong>Relações sociais:</strong> amizades, solicitações e notificações.
          </li>
          <li>
            <strong>Dados técnicos:</strong> informações de sessão necessárias para manter você conectado e proteger a conta.
          </li>
        </UL>
        <P>Não pedimos dados sensíveis. Evite incluí-los em bio, anotações ou comentários.</P>
      </>
    ),
  },
  {
    id: "finalidades",
    title: "Para que usamos os dados",
    content: (
      <>
        <UL>
          <li>Criar e manter sua conta e permitir o acesso (execução do contrato).</li>
          <li>Registrar seu progresso, calcular XP, níveis, rankings e ligas (execução do contrato).</li>
          <li>Permitir recursos sociais, como amigos, salas e notificações (execução do contrato).</li>
          <li>Enviar e-mails e mensagens de autenticação e avisos do serviço (execução do contrato).</li>
          <li>Proteger a plataforma contra fraude e uso indevido, e cumprir obrigações legais (legítimo interesse e obrigação legal).</li>
        </UL>
        <P>Não vendemos seus dados pessoais.</P>
      </>
    ),
  },
  {
    id: "visibilidade",
    title: "O que outras pessoas veem",
    content: (
      <>
        <P>
          Para o ranking, as ligas, as salas e os amigos funcionarem, algumas informações do seu perfil são visíveis para outros usuários: nome de exibição, nome de usuário, nível, XP e, conforme o contexto, foto e bio.
        </P>
        <P>
          Você pode ajustar as opções de privacidade do perfil em Configurações. Quando a ocultação de identidade está ativa, a foto não é exibida nas ligas. Suas anotações do caderno são privadas.
        </P>
      </>
    ),
  },
  {
    id: "compartilhamento",
    title: "Com quem compartilhamos",
    content: (
      <>
        <P>Usamos prestadores que tratam dados em nosso nome, apenas para operar o serviço:</P>
        <UL>
          <li>Supabase: autenticação, banco de dados e armazenamento de arquivos, como avatar e banner.</li>
          <li>Vercel: hospedagem da aplicação.</li>
          <li>Resend: envio de e-mails de autenticação e avisos.</li>
          <li>Google: login com conta Google, quando você escolhe essa opção.</li>
          <li>Provedor de SMS: envio de códigos de verificação, quando você usa essa opção.</li>
        </UL>
        <P>Também podemos compartilhar dados quando houver obrigação legal ou ordem de autoridade competente.</P>
      </>
    ),
  },
  {
    id: "transferencia",
    title: "Transferência internacional",
    content: (
      <P>
        Alguns prestadores podem armazenar ou processar dados fora do Brasil. Nesses casos, buscamos garantias adequadas, como cláusulas contratuais e prestadores com padrões reconhecidos de segurança, conforme a LGPD.
      </P>
    ),
  },
  {
    id: "retencao",
    title: "Por quanto tempo guardamos",
    content: (
      <P>
        Mantemos os dados enquanto sua conta estiver ativa. Ao excluir a conta, apagamos ou anonimizamos os dados pessoais, exceto aqueles que precisarmos guardar por obrigação legal ou para exercício regular de direitos, pelo prazo necessário.
      </P>
    ),
  },
  {
    id: "direitos",
    title: "Seus direitos",
    content: (
      <>
        <P>Pela LGPD, você pode pedir, a qualquer momento:</P>
        <UL>
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei;</li>
          <li>portabilidade, nos termos da regulamentação;</li>
          <li>informação sobre com quem compartilhamos seus dados;</li>
          <li>revogação de consentimento, quando essa for a base legal, e eliminação dos dados tratados com ele.</li>
        </UL>
        <P>
          Para exercer esses direitos, escreva para <MailLink subject="Direitos do titular (LGPD)" />. Você também pode contatar a Autoridade Nacional de Proteção de Dados (ANPD).
        </P>
      </>
    ),
  },
  {
    id: "seguranca",
    title: "Como protegemos os dados",
    content: (
      <P>
        As regras de acesso aos dados ficam no banco, com políticas de segurança por linha (RLS), e a conexão com o serviço é criptografada. Nenhum sistema é totalmente imune a falhas. Se houver um incidente que possa causar risco relevante a você, comunicaremos você e a ANPD, conforme a lei.
      </P>
    ),
  },
  {
    id: "cookies",
    title: "Cookies e armazenamento local",
    content: (
      <P>
        Usamos armazenamento do navegador para manter sua sessão e lembrar preferências básicas de uso. Não usamos esses recursos para publicidade de terceiros.
      </P>
    ),
  },
  {
    id: "menores",
    title: "Crianças e adolescentes",
    content: (
      <P>
        Menores de 18 anos devem usar o Athen com ciência e acompanhamento dos pais ou responsáveis. O tratamento de dados de crianças e adolescentes é feito no melhor interesse deles, como a LGPD exige. Se você é responsável e acredita que um menor se cadastrou sem autorização, fale com a gente.
      </P>
    ),
  },
  {
    id: "mudancas",
    title: "Mudanças nesta política",
    content: (
      <P>
        Podemos atualizar esta política. Quando a mudança for relevante, avisaremos pelo serviço ou por e-mail. A data de atualização fica no topo desta página. Consulte também os <TextLink to="/termos">Termos de Uso</TextLink>.
      </P>
    ),
  },
];

export default function PrivacidadePage() {
  return (
    <InfoPageLayout
      title="Política de Privacidade"
      intro="Explicamos quais dados do Athen guardamos, para que servem, com quem compartilhamos e como você controla tudo isso."
      updatedAt={LAST_UPDATED}
    >
      <LegalDocument sections={SECTIONS} />
    </InfoPageLayout>
  );
}
