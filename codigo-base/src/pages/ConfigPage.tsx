import { useState, type ChangeEvent, type FormEvent } from "react";
import { SidebarLeft } from "../components/sidebar/SidebarLeft";
import "./ConfigPage.css";

type NotificationKey = "courseUpdates" | "friendRequests" | "streakReminder";

type AccountForm = {
  username: string;
  displayName: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type NotificationSettings = Record<NotificationKey, boolean>;

const initialAccountForm: AccountForm = {
  username: "athen.learner",
  displayName: "Athen learner",
  email: "usuario@exemplo.com",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const initialNotifications: NotificationSettings = {
  courseUpdates: true,
  friendRequests: true,
  streakReminder: false,
};

const notificationItems: Array<{
  key: NotificationKey;
  title: string;
  description: string;
}> = [
  {
    key: "courseUpdates",
    title: "Atualização de curso",
    description: "Receba avisos quando houver novidades nos cursos em que você estuda.",
  },
  {
    key: "friendRequests",
    title: "Pedido de amizade",
    description: "Seja avisado quando outra pessoa enviar um pedido de amizade.",
  },
  {
    key: "streakReminder",
    title: "Lembrete de streak",
    description: "Receba um lembrete para manter sua sequência diária de estudos.",
  },
];

export default function ConfiguracoesPage() {
  const [account, setAccount] = useState<AccountForm>(initialAccountForm);
  const [notifications, setNotifications] = useState<NotificationSettings>(initialNotifications);
  const [feedback, setFeedback] = useState("");
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);

  function handleAccountChange(field: keyof AccountForm, event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setAccount((current) => ({ ...current, [field]: value }));
    setFeedback("");
  }

  function handleNotificationToggle(key: NotificationKey) {
    setNotifications((current) => ({ ...current, [key]: !current[key] }));
    setFeedback("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("Alterações preparadas localmente. A persistência será conectada em uma etapa futura.");
  }

  function handleDeleteConfirmation() {
    setFeedback("A exclusão de conta ainda não está conectada ao serviço de autenticação.");
    setDeleteConfirmationOpen(false);
  }

  return (
    <div className="configuracoes-layout">
      <SidebarLeft />

      <main className="configuracoes-page" aria-labelledby="configuracoes-title">
        <header className="configuracoes-header">
          <p className="configuracoes-eyebrow">Preferências da conta</p>
          <h1 id="configuracoes-title">Configurações</h1>
          <p className="configuracoes-intro">
            Gerencie seus dados de acesso e escolha quais avisos deseja receber no Athen.
          </p>
        </header>

        <form className="configuracoes-content" onSubmit={handleSubmit}>
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
              <p>Os campos estão preparados para a futura integração com o sistema de autenticação.</p>
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
                Essa ação será irreversível quando o fluxo real for implementado. Nesta etapa, nenhuma conta é removida.
              </p>
            </div>
            <button
              className="configuracoes-danger__button"
              type="button"
              onClick={() => setDeleteConfirmationOpen(true)}
            >
              Excluir conta
            </button>
          </section>

          {deleteConfirmationOpen && (
            <div className="configuracoes-confirmation" role="alert">
              <p>Confirmação visual: deseja preparar a exclusão desta conta?</p>
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
                  onClick={handleDeleteConfirmation}
                >
                  Confirmar exclusão
                </button>
              </div>
            </div>
          )}

          <div className="configuracoes-actions">
            <button className="configuracoes-button configuracoes-button--primary" type="submit">
              Salvar alterações
            </button>
            {feedback && <p className="configuracoes-feedback" role="status">{feedback}</p>}
          </div>
        </form>
      </main>
    </div>
  );
}