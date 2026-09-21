import React from "react";
import { Link } from "react-router-dom";
import { SupaConnect } from "../components/SupabaseConnect";
import "./LoginPage.css";

export const LoginPage: React.FC = () => {
  return (
    <main className="login-container">
      {" "}
      <div className="login-box">
        {" "}
        <h1>Login</h1>{" "}
        <form>
          {" "}
          <div className="input-group">
            {" "}
            <label htmlFor="email">E-mail</label>{" "}
            <input
              type="email"
              id="email"
              placeholder="Digite seu e-mail"
            />{" "}
          </div>{" "}
          <div className="input-group">
            {" "}
            <label htmlFor="senha">Senha</label>{" "}
            <input
              type="password"
              id="senha"
              placeholder="Digite sua senha"
            />{" "}
          </div>{" "}
          <button type="submit">Entrar</button>{" "}
        </form>{" "}
      </div>{" "}
    </main>
  );
};
