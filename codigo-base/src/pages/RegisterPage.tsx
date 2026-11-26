import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase, supabaseConfigured } from "../lib/supabase";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargo, setCargo] = useState<"student" | "educator" | "">("");
  const [nomeUsuario, setNomeUsuario] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
          role: cargo,
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

  // Cadastro/entrada com Google: o Supabase cria a conta no primeiro acesso e volta
  // ao /dashboard com a sessão ativa. O Google não leva cargo nem nome de usuário,
  // então a conta nasce como estudante, com o nome de usuário derivado do e-mail.
  const handleGoogleSignUp = async () => {
    if (!supabaseConfigured) {
      setMessage("Supabase não configurado.");
      return;
    }

    setGoogleLoading(true);
    setMessage("Redirecionando para o Google...");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });

    // Em caso de sucesso o navegador sai da página; só chegamos aqui se houve erro.
    if (error) {
      setMessage(`Falha ao cadastrar com Google: ${error.message}`);
      setGoogleLoading(false);
    }
  };

  if (registered) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#141322] px-4 font-body text-[#f4eeff]">
        <div className="w-full max-w-[400px] rounded-2xl border border-[#a486d5]/25 bg-[#1d1a31] p-8 text-center shadow-2xl shadow-black/40">
          <p className="font-display text-[32px] tracking-[5px] text-gold">ATHEN</p>
          <h1 className="mt-3 font-display text-2xl text-[#f4eeff]">Cadastro</h1>
          <p className="mt-4 text-sm text-[#d8c9f2]">{message}</p>
          <Link
            to="/login-page"
            className="mt-6 inline-block w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-[#211029] transition hover:bg-gold-light"
          >
            Ir para o login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#141322] px-4 py-10 font-body text-[#f4eeff]">
      <div className="w-full max-w-[400px] rounded-2xl border border-[#a486d5]/25 bg-[#1d1a31] p-8 shadow-2xl shadow-black/40">
        <div className="mb-8 text-center">
          <p className="font-display text-[32px] tracking-[5px] text-gold">ATHEN</p>
          <h1 className="mt-3 font-display text-2xl text-[#f4eeff]">Criar conta</h1>
          <p className="mt-1 text-sm text-[#b8aacb]">Comece sua jornada de estudos.</p>
        </div>

        <form onSubmit={(event) => void handleRegister(event)}>
          <div className="mb-5 flex flex-col">
            <label htmlFor="email" className="mb-1.5 text-sm font-bold text-[#d8c9f2]">
              E-mail
            </label>
            <input
              type="email"
              id="email"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="rounded-lg border border-[#a486d5]/40 bg-[#171628] px-3.5 py-2.5 text-sm text-[#f4eeff] outline-none transition placeholder:text-[#8f829f] focus:border-gold focus:ring-2 focus:ring-gold/25"
            />
          </div>

          <div className="mb-5 flex flex-col">
            <label htmlFor="senha" className="mb-1.5 text-sm font-bold text-[#d8c9f2]">
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
                className="min-w-0 flex-1 rounded-lg border border-[#a486d5]/40 bg-[#171628] px-3.5 py-2.5 pr-[76px] text-sm text-[#f4eeff] outline-none transition placeholder:text-[#8f829f] focus:border-gold focus:ring-2 focus:ring-gold/25"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md px-2 py-1 text-xs font-bold text-[#a486d5] hover:text-gold"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div className="mb-5 flex flex-col">
            <label htmlFor="cargo" className="mb-1.5 text-sm font-bold text-[#d8c9f2]">
              Cargo
            </label>
            <select
              id="cargo"
              value={cargo}
              onChange={(event) =>
                setCargo(event.target.value as "student" | "educator" | "")
              }
              required
              className="rounded-lg border border-[#a486d5]/40 bg-[#171628] px-3.5 py-2.5 text-sm text-[#f4eeff] outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25"
            >
              <option value="" disabled>
                Selecione seu cargo
              </option>
              <option value="student">Estudante</option>
              <option value="educator">Educador</option>
            </select>
          </div>

          <div className="mb-5 flex flex-col">
            <label htmlFor="nomeUsuario" className="mb-1.5 text-sm font-bold text-[#d8c9f2]">
              Nome de usuário
            </label>
            <input
              type="text"
              id="nomeUsuario"
              placeholder="Digite seu nome de usuário"
              value={nomeUsuario}
              onChange={(event) => setNomeUsuario(event.target.value)}
              required
              className="rounded-lg border border-[#a486d5]/40 bg-[#171628] px-3.5 py-2.5 text-sm text-[#f4eeff] outline-none transition placeholder:text-[#8f829f] focus:border-gold focus:ring-2 focus:ring-gold/25"
            />
          </div>

          {message && <p className="mb-4 text-center text-sm text-[#d8c9f2]">{message}</p>}

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full cursor-pointer rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-[#211029] transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Criando..." : "Cadastrar"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-[#8f829f]" role="separator">
          <span className="h-px flex-1 bg-[#a486d5]/25" />
          ou
          <span className="h-px flex-1 bg-[#a486d5]/25" />
        </div>

        <button
          type="button"
          onClick={() => void handleGoogleSignUp()}
          disabled={loading || googleLoading}
          className="flex w-full min-w-0 cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-[#a486d5]/40 bg-[#171628] px-4 py-2.5 text-sm font-bold text-[#f4eeff] transition hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-60"
        >
          <img src="/google.svg" alt="" width={18} height={18} className="size-[18px] shrink-0" aria-hidden="true" />
          Cadastrar com Google
        </button>
        <p className="mt-2 text-center text-xs text-[#8f829f]">Contas criadas com o Google entram como Estudante.</p>

        <p className="mt-6 text-center text-sm text-[#b8aacb]">
          Já tem conta?{" "}
          <Link
            to="/login-page"
            className="font-bold text-gold hover:text-gold-light hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}