import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase, supabaseConfigured } from "../lib/supabase";

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
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-[350px] rounded-[10px] border border-[#ddd] p-[30px]">
        <h1 className="mb-[25px] text-center text-2xl font-bold">Login</h1>

        <form onSubmit={(event) => void handleLogin(event)}>
          <div className="mb-5 flex flex-col">
            <label htmlFor="email" className="mb-[5px]">
              E-mail
            </label>
            <input
              type="email"
              id="email"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="rounded-[5px] border border-[#ccc] p-[10px]"
            />
          </div>

          <div className="mb-5 flex flex-col">
            <label htmlFor="senha" className="mb-[5px]">
              Senha
            </label>
            <div className="relative flex">
              <input
                type={showPassword ? "text" : "password"}
                id="senha"
                placeholder="Digite sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="min-w-0 flex-1 rounded-[5px] border border-[#ccc] p-[10px] pr-[70px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent px-2 py-1 text-[0.85rem] text-[#555]"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          {message && (
            <p className="mb-[15px] text-center text-[0.9rem]">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-[5px] border-0 p-[10px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-5 text-center text-[0.9rem]">
          Não tem conta?{" "}
          <Link
            to="/register-page"
            className="text-blue-600 underline hover:text-blue-800"
          >
            Cadastrar
          </Link>
        </p>
      </div>
    </main>
  );
}
