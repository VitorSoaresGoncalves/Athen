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
import Catalago from './pages/Catalago';

export default function Hub() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/crud" element={<ProtectedRoute><CrudConsole /></ProtectedRoute>} />
        <Route path="/login-page" element={<LoginPage />} />
        <Route path="/register-page" element={<RegisterPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/salas" element={<Salas />} />
        <Route path="/ligas" element={<Ligas />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/configuracoes" element={<ConfigPage />} />
        <Route path="/amigos" element={<Amigos />} />
        <Route path="/caderno" element={<NotebookPage />} />
        <Route path="/catalago" element={<ProtectedRoute><Catalago /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}