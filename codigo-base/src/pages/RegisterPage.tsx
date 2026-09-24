import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase, supabaseConfigured } from "../lib/supabase";
import "./RegisterPage.css";
/** Teste de Commit */
export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nomeExibicao, setNomeExibicao] = useState("");
  const [nomeUsuario, setNomeUsuario] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabaseConfigured) {
      setMessage("Supabase não configurado.");
      return;
    }

    setLoading(true);
    setMessage("Criando usuário...");

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: nomeExibicao.trim(),
          username: nomeUsuario.trim(),
        },
      },
    });

    if (error) {
      setMessage(`Falha no cadastro: ${error.message}`);
      setLoading(false);
      return;
    }

    setMessage("Cadastro realizado com sucesso!");
    setRegistered(true);
    setLoading(false);
  };

  if (registered) {
    return (
      <main className="register-container">
        <div className="register-box">
          <h1>Cadastro</h1>
          <p className="register-message">{message}</p>
          <Link to="/LoginPage">Ir para o login</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="register-container">
      <div className="register-box">
        <h1>Cadastro</h1>
        <form onSubmit={(event) => void handleRegister(event)}>
          <div className="input-group">
            <label htmlFor="email">E-mail</label>
            <input
              type="email"
              id="email"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="senha">Senha</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="senha"
                placeholder="Digite sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="nomeExibicao">Nome de exibição</label>
            <input
              type="text"
              id="nomeExibicao"
              placeholder="Digite seu nome de exibição"
              value={nomeExibicao}
              onChange={(event) => setNomeExibicao(event.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="nomeUsuario">Nome de usuário</label>
            <input
              type="text"
              id="nomeUsuario"
              placeholder="Digite seu nome de usuário"
              value={nomeUsuario}
              onChange={(event) => setNomeUsuario(event.target.value)}
              required
            />
          </div>

          {message && <p className="register-message">{message}</p>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Criando..." : "Cadastrar"}
          </button>
        </form>

        <p className="register-footer">
          Já tem conta? <Link to="/LoginPage">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
