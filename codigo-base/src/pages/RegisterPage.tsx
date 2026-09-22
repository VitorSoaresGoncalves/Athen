import React from "react";
import { Link } from "react-router-dom";
import { SupaConnect } from "../components/SupabaseConnect";
import "./RegisterPage.css";

export const RegisterPage: React.FC = () => {
  return (
    <main className="register-container">
      {" "}
      <div className="register-box">
        {" "}
        <h1>Cadastro</h1>{" "}
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
          <div className="input-group">
            {" "}
            <label htmlFor="nomeExibicao">Nome de exibição</label>{" "}
            <input
              type="text"
              id="nomeExibicao"
              placeholder="Digite seu nome de exibição"
            />{" "}
          </div>{" "}
          <div className="input-group">
            {" "}
            <label htmlFor="nomeUsuario">Nome de usuário</label>{" "}
            <input
              type="text"
              id="nomeUsuario"
              placeholder="Digite seu nome de usuário"
            />{" "}
          </div>{" "}
          <div className="input-group">
            {" "}
            <label htmlFor="cargo">Cargo</label>{" "}
            <select id="cargo" defaultValue="">
              {" "}
              <option value="" disabled>
                Selecione seu cargo
              </option>{" "}
              <option value="aluno">Aluno</option>{" "}
              <option value="professor">Professor</option>{" "}
            </select>{" "}
          </div>{" "}
          <button type="submit">Cadastrar</button>{" "}
        </form>{" "}
      </div>{" "}
    </main>
  );
};