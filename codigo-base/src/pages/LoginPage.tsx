import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase, supabaseConfigured } from "../lib/supabase";
import "./LoginPage.css";

export function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabaseConfigured) {
      setMessage("Supabase não configurado.");
      return;
    }

    setLoading(true);
    setMessage("Entrando...");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(`Falha no login: ${error.message}`);
      setLoading(false);
      return;
    }

    setLoading(false);
    navigate("/dashboard");
  };

  return (
    <main className="login-container">
      <div className="login-box">
        <h1>Login</h1>
        <form onSubmit={(event) => void handleLogin(event)}>
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

          {message && <p className="login-message">{message}</p>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="login-footer">
          Não tem conta? <Link to="/register-page">Cadastrar</Link>
        </p>
      </div>
    </main>
  );
};