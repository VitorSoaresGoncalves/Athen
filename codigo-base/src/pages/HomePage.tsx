import React from 'react';
import { Link } from 'react-router-dom';
import { SupaConnect } from '../components/SupabaseConnect';
import './HomePage.css';

export const HomePage: React.FC = () => {
  return (
    <main className="home-container">
      <SupaConnect />
      <Link to="/crud">Console CRUD</Link>
      <hr />
      <h1>Athen: Plataforma de Educação</h1>
      <h2> Aprendizado por reforço e Competitividade amigável</h2>
      <Link to= "/LoginPage">Pagina 2Login</Link>

      <img 
        src="/Athen.png" 
        alt="Descrição da imagem" 
        style={{ width: '150px', height: 'auto' }} 
      />

      <section className="esquerda">
      <h2> Plataforma de aprendizado por reforço gamificada</h2>
      <p>Muitos tipos de atividades para criar sua própria trilha de estudos para seu objetivo</p>
      </section>

      <section className="direita">
        <h2>Trilha personalizável</h2>
        <p>Trilha de estudo com liberdade para ser criada de acordo com a sua necessidade</p>
      </section>

      <section className="esquerda">
        <h2>Biblioteca da comunidade</h2>
        <p>Você pode postar sua própria trilha ou utilizar uma que a comunidade criou</p>
      </section>

      <section className="direita">
        <h2>Salas de Aulas para competições entre pessas</h2>
        <p>Competa com outras pessoas no mesmo assunto dentro de uma sala de aula privada</p>
      </section>

      <footer>
        <div className="footer-container">
          <section>
            <h3>Quem somos</h3>
            <a href="x">Cursos</a>
            <a href="x">Método</a>
            <a href="x">Entre em contato</a>
          </section>

          <section>
            <h3>Produtos</h3>
            <a href="x">Curso Athen</a>
            <a href="x">Athen para escolas</a>
            <a href="x">Athen English</a>
            <a href="x">Athen para empresas</a>
          </section>

          <section>
            <h3>Aplicativos</h3>
            <a href="x">Athen para Android</a>
            <a href="x">Athen para iOS</a>
          </section>

          <section>
            <h3>Ajuda e suporte</h3>
            <a href="x">Dúvidas: Athen</a>
            <a href="x">Dúvidas: Escolas</a>
            <a href="x">Status</a>
          </section>

          <section>
            <h3>Termos e privacidade</h3>
            <a href="x">Normas da comunidade</a>
            <a href="x">Termos de uso</a>
            <a href="x">Privacidade</a>
          </section>

        </div>
      </footer>
    </main>
  )
}