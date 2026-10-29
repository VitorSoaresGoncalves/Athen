import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/SupabaseConnect'
import { CrudConsole } from './pages/CrudConsole'
import {LoginPage} from './pages/LoginPage'
import {RegisterPage} from './pages/RegisterPage';
import HomePage  from './pages/home-page/HomePage';
import Dashboard from './pages/Dashboard';
import Salas from './pages/Salas'
import Ligas from './pages/Ligas'
import Profile  from './pages/profile/Profile';
import ConfigPage from './pages/ConfigPage'
import Amigos from './pages/Amigos';
import NotebookPage from './pages/Notebook';
import Catalogo from './pages/Catalogo';
import CriarCurso from './pages/criar-curso/CriarCurso';
import Notificacoes from './pages/Notificacoes';

export default function Hub() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rotas públicas */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login-page" element={<LoginPage />} />
        <Route path="/register-page" element={<RegisterPage />} />

        {/* Rotas internas: exigem sessão (redirecionam para "/" sem login) */}
        <Route path="/crud" element={<ProtectedRoute><CrudConsole /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/salas" element={<ProtectedRoute><Salas /></ProtectedRoute>} />
        {/* <Route path="/ranking" element={<ProtectedRoute><Ranking /></ProtectedRoute>} /> */}
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><ConfigPage /></ProtectedRoute>} />
        <Route path="/amigos" element={<ProtectedRoute><Amigos /></ProtectedRoute>} />
        <Route path="/caderno" element={<ProtectedRoute><NotebookPage /></ProtectedRoute>} />
        <Route path="/notificacoes" element={<ProtectedRoute><Notificacoes /></ProtectedRoute>} />
        <Route path="/catalogo" element={<ProtectedRoute><Catalogo/></ProtectedRoute>}/> 
        <Route path="/criar-curso" element={<ProtectedRoute><CriarCurso /></ProtectedRoute>} /> 
        <Route path="/ligas" element={<ProtectedRoute><Ligas /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}