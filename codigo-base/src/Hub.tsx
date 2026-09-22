import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/SupabaseConnect'
import { CrudConsole } from './pages/CrudConsole'
import { HomePage } from './pages/HomePage'
import {LoginPage} from './pages/LoginPage'
import {RegisterPage} from './pages/RegisterPage';

export default function Hub() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/crud" element={<ProtectedRoute><CrudConsole /></ProtectedRoute>} />
        <Route path="/LoginPage" element={<LoginPage />} />
        <Route path="/RegisterPage" element={<RegisterPage />} />
      </Routes>
    </BrowserRouter>
  )
}