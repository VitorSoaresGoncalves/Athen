import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/SupabaseConnect'
import { CrudConsole } from './pages/CrudConsole'
import {LoginPage} from './pages/LoginPage'
import {RegisterPage} from './pages/RegisterPage';
import  HomePage  from './pages/home-page/HomePage';
import Dashboard from './pages/Dashboard'
import ConfigPage from './pages/ConfigPage'

export default function Hub() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/crud" element={<ProtectedRoute><CrudConsole /></ProtectedRoute>} />
        <Route path="/login-page" element={<LoginPage />} />
        <Route path="/register-page" element={<RegisterPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/configuracoes" element={<ConfigPage />} />
      </Routes>
    </BrowserRouter>
  )
}