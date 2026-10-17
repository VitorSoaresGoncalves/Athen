import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase, supabaseConfigured } from "../lib/supabase";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargo, setCargo] = useState<"aluno" | "professor" | "">("");
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
          cargo: cargo.trim(),
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
      <main className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-[350px] rounded-[10px] border border-[#ddd] p-[30px]">
          <h1 className="mb-[25px] text-center text-2xl font-bold">Cadastro</h1>
          <p className="mb-4">{message}</p>
          <Link
            to="/login-page"
            className="text-blue-600 underline hover:text-blue-800"
          >
            Ir para o login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-[350px] rounded-[10px] border border-[#ddd] p-[30px]">
        <h1 className="mb-[25px] text-center text-2xl font-bold">Cadastro</h1>

        <form onSubmit={(event) => void handleRegister(event)}>
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
                minLength={6}
                className="min-w-0 flex-1 rounded-[5px] border border-[#ccc] p-[10px] pr-[70px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 border-0 bg-transparent px-2 py-1 text-[0.85rem] text-[#555] cursor-pointer"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div className="mb-5 flex flex-col">
            <label htmlFor="cargo" className="mb-[5px]">
              Cargo
            </label>
            <select
              id="cargo"
              value={cargo}
              onChange={(event) =>
                setCargo(event.target.value as "aluno" | "professor" | "")
              }
              required
              className="rounded-[5px] border border-[#ccc] p-[10px]"
            >
              <option value="" disabled>
                Selecione seu cargo
              </option>
              <option value="aluno">Aluno</option>
              <option value="professor">Professor</option>
            </select>
          </div>

          <div className="mb-5 flex flex-col">
            <label htmlFor="nomeUsuario" className="mb-[5px]">
              Nome de usuário
            </label>
            <input
              type="text"
              id="nomeUsuario"
              placeholder="Digite seu nome de usuário"
              value={nomeUsuario}
              onChange={(event) => setNomeUsuario(event.target.value)}
              required
              className="rounded-[5px] border border-[#ccc] p-[10px]"
            />
          </div>

          {message && <p className="mb-4">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-[5px] border-0 p-[10px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Criando..." : "Cadastrar"}
          </button>
        </form>

        <p className="mt-5">
          Já tem conta?{" "}
          <Link
            to="/login-page"
            className="text-blue-600 underline hover:text-blue-800"
          >
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
