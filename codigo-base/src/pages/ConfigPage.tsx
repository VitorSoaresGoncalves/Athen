import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "../components/layout/PageLayout";
import { usuarioRepository } from "../data/repositories";
import { supabase } from "../lib/supabase";
import "./ConfigPage.css";

// Cada toggle da UI corresponde a uma chave do notification_preferences (JSON em
// profiles). Convenção do repositório: chave AUSENTE ou true = ativada.
type NotificationKey = "atualizacao_curso" | "pedido_amizade" | "lembrete_estudo";

type AccountForm = {
  username: string;
  displayName: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type NotificationSettings = Record<NotificationKey, boolean>;

const emptyAccount: AccountForm = {
  username: "",
  displayName: "",
  email: "",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const notificationItems: Array<{ key: NotificationKey; title: string; description: string }> = [
  {
    key: "atualizacao_curso",
    title: "Atualização de curso",
    description: "Receba avisos quando houver novidades nos cursos em que você estuda.",
  },
  {
    key: "pedido_amizade",
    title: "Pedido de amizade",
    description: "Seja avisado quando outra pessoa enviar um pedido de amizade.",
  },
  {
    key: "lembrete_estudo",
    title: "Lembrete de estudo",
    description: "Receba um lembrete para manter sua sequência diária de estudos.",
  },
];

// chave ausente => ativada (convenção do backend).
function prefAtiva(prefs: Record<string, boolean>, key: NotificationKey): boolean {
  return prefs[key] !== false;
}

export default function ConfiguracoesPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountForm>(emptyAccount);
  const [notifications, setNotifications] = useState<NotificationSettings>({
    atualizacao_curso: true,
    pedido_amizade: true,
    lembrete_estudo: true,
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackErro, setFeedbackErro] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);

  // Carrega o perfil e as preferências do usuário logado.
  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const perfil = await usuarioRepository.obterAtual();
        if (cancelado) return;

        setUserId(perfil?.id ?? null);
        setAccount({
          ...emptyAccount,
          username: perfil?.username ?? "",
          displayName: perfil?.display_name ?? "",
          email: userData.user?.email ?? "",
        });

        const prefs = (perfil?.notification_preferences ?? {}) as Record<string, boolean>;
        setNotifications({
          atualizacao_curso: prefAtiva(prefs, "atualizacao_curso"),
          pedido_amizade: prefAtiva(prefs, "pedido_amizade"),
          lembrete_estudo: prefAtiva(prefs, "lembrete_estudo"),
        });
      } catch (error) {
        if (!cancelado) {
          setFeedbackErro(true);
          setFeedback(error instanceof Error ? error.message : "Não foi possível carregar suas configurações.");
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();
    return () => { cancelado = true; };
  }, []);

  function handleAccountChange(field: keyof AccountForm, event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setAccount((current) => ({ ...current, [field]: value }));
    setFeedback("");
  }

  function handleNotificationToggle(key: NotificationKey) {
    setNotifications((current) => ({ ...current, [key]: !current[key] }));
    setFeedback("");
  }

  function mostrarFeedback(mensagem: string, erro = false) {
    setFeedback(mensagem);
    setFeedbackErro(erro);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;

    // Validação da troca de senha (quando preenchida).
    if (account.newPassword || account.confirmPassword) {
      if (account.newPassword.length < 6) {
        mostrarFeedback("A nova senha deve ter ao menos 6 caracteres.", true);
        return;
      }
      if (account.newPassword !== account.confirmPassword) {
        mostrarFeedback("A nova senha e a confirmação não coincidem.", true);
        return;
      }
    }

    setSalvando(true);
    try {
      // 1. Nome de exibição e nome de usuário.
      await usuarioRepository.atualizar(userId, {
        display_name: account.displayName.trim(),
        username: account.username.trim(),
      });

      // 2. Preferências de notificação.
      await usuarioRepository.atualizarPreferenciasNotificacao(userId, {
        atualizacao_curso: notifications.atualizacao_curso,
        pedido_amizade: notifications.pedido_amizade,
        lembrete_estudo: notifications.lembrete_estudo,
      });

      // 3. Senha (opcional) — via Supabase Auth.
      if (account.newPassword) {
        const { error } = await supabase.auth.updateUser({ password: account.newPassword });
        if (error) throw new Error(error.message);
        setAccount((current) => ({ ...current, currentPassword: "", newPassword: "", confirmPassword: "" }));
      }

      mostrarFeedback("Alterações salvas com sucesso.");
    } catch (error) {
      mostrarFeedback(error instanceof Error ? error.message : "Não foi possível salvar as alterações.", true);
    } finally {
      setSalvando(false);
    }
  }

  async function handleDeleteConfirmation() {
    setDeleteConfirmationOpen(false);
    setSalvando(true);
    try {
      await usuarioRepository.desativarConta();
      await supabase.auth.signOut();
      navigate("/login-page");
    } catch (error) {
      mostrarFeedback(error instanceof Error ? error.message : "Não foi possível excluir a conta.", true);
      setSalvando(false);
    }
  }

  return (
    <PageLayout variant="bare">
      <div className="configuracoes">
        <div className="configuracoes__main" aria-labelledby="configuracoes-title">
          <div className="configuracoes__brilho" />

          <header className="configuracoes__cabecalho">
            <p className="configuracoes__caminho">PLATAFORMA / <span>CONFIGURAÇÕES</span></p>
            <h1 className="configuracoes__titulo" id="configuracoes-title">Configurações</h1>
            <p className="configuracoes__subtitulo">
              Gerencie seus dados de acesso e escolha quais avisos deseja receber no Athen.
            </p>
          </header>

          <form className="configuracoes-content" onSubmit={(event) => void handleSubmit(event)}>
          <section className="configuracoes-card" aria-labelledby="conta-title">
            <div className="configuracoes-card__heading">
              <div>
                <p className="configuracoes-card__eyebrow">Sua identidade</p>
                <h2 id="conta-title">Conta</h2>
              </div>
              <span className="configuracoes-card__icon" aria-hidden="true">◉</span>
            </div>

            <div className="configuracoes-fields">
              <label className="configuracoes-field">
                <span>Nome de usuário</span>
                <input
                  type="text"
                  value={account.username}
                  onChange={(event) => handleAccountChange("username", event)}
                  autoComplete="username"
                  placeholder="Digite seu nome de usuário"
                  disabled={carregando || salvando}
                />
                <small>Esse nome pode ser usado para encontrar seu perfil.</small>
              </label>

              <label className="configuracoes-field">
                <span>Nome display</span>
                <input
                  type="text"
                  value={account.displayName}
                  onChange={(event) => handleAccountChange("displayName", event)}
                  autoComplete="name"
                  placeholder="Digite o nome exibido no perfil"
                  disabled={carregando || salvando}
                />
                <small>É o nome que aparecerá nas interações dentro da plataforma.</small>
              </label>

              <label className="configuracoes-field configuracoes-field--full">
                <span>E-mail</span>
                <input
                  type="email"
                  value={account.email}
                  readOnly
                  disabled
                  autoComplete="email"
                  aria-describedby="email-help"
                />
                <small id="email-help">A alteração de e-mail será habilitada junto ao fluxo de confirmação do Supabase.</small>
              </label>
            </div>

            <div className="configuracoes-divider" />

            <div className="configuracoes-subheading">
              <h3>Senha</h3>
              <p>Preencha a nova senha para alterá-la. Deixe em branco para manter a atual.</p>
            </div>

            <div className="configuracoes-fields">
              <label className="configuracoes-field configuracoes-field--full">
                <span>Senha atual</span>
                <input
                  type="password"
                  value={account.currentPassword}
                  onChange={(event) => handleAccountChange("currentPassword", event)}
                  autoComplete="current-password"
                  placeholder="Digite sua senha atual"
                  disabled={carregando || salvando}
                />
              </label>

              <label className="configuracoes-field">
                <span>Nova senha</span>
                <input
                  type="password"
                  value={account.newPassword}
                  onChange={(event) => handleAccountChange("newPassword", event)}
                  autoComplete="new-password"
                  placeholder="Digite a nova senha"
                  disabled={carregando || salvando}
                />
              </label>

              <label className="configuracoes-field">
                <span>Confirmar nova senha</span>
                <input
                  type="password"
                  value={account.confirmPassword}
                  onChange={(event) => handleAccountChange("confirmPassword", event)}
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                  disabled={carregando || salvando}
                />
              </label>
            </div>
          </section>

          <section className="configuracoes-card" aria-labelledby="notificacoes-title">
            <div className="configuracoes-card__heading">
              <div>
                <p className="configuracoes-card__eyebrow">Escolha o que deseja acompanhar</p>
                <h2 id="notificacoes-title">Notificações</h2>
              </div>
              <span className="configuracoes-card__icon" aria-hidden="true">◌</span>
            </div>

            <div className="configuracoes-notifications">
              {notificationItems.map((item) => {
                const enabled = notifications[item.key];

                return (
                  <div className="configuracoes-notification" key={item.key}>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                    <button
                      className={`configuracoes-switch ${enabled ? "configuracoes-switch--enabled" : ""}`}
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${item.title}: ${enabled ? "ativada" : "desativada"}`}
                      onClick={() => handleNotificationToggle(item.key)}
                      disabled={carregando || salvando}
                    >
                      <span aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="configuracoes-danger" aria-labelledby="excluir-conta-title">
            <div>
              <p className="configuracoes-card__eyebrow">Zona de atenção</p>
              <h2 id="excluir-conta-title">Excluir conta</h2>
              <p>
                Esta ação desativa a sua conta e apaga seus dados pessoais. Você precisará
                excluir ou transferir seus cursos e salas antes de prosseguir.
              </p>
            </div>
            <button
              className="configuracoes-danger__button"
              type="button"
              onClick={() => setDeleteConfirmationOpen(true)}
              disabled={carregando || salvando}
            >
              Excluir conta
            </button>
          </section>

          {deleteConfirmationOpen && (
            <div className="configuracoes-confirmation" role="alert">
              <p>Tem certeza? Esta ação é irreversível.</p>
              <div className="configuracoes-confirmation__actions">
                <button
                  className="configuracoes-button configuracoes-button--secondary"
                  type="button"
                  onClick={() => setDeleteConfirmationOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className="configuracoes-button configuracoes-button--danger"
                  type="button"
                  onClick={() => void handleDeleteConfirmation()}
                >
                  Confirmar exclusão
                </button>
              </div>
            </div>
          )}

          <div className="configuracoes-actions">
            <button className="configuracoes-button configuracoes-button--primary" type="submit" disabled={carregando || salvando}>
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
            {feedback && (
              <p className="configuracoes-feedback" role="status" style={feedbackErro ? { color: "#f2b4bd" } : undefined}>
                {feedback}
              </p>
            )}
          </div>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
