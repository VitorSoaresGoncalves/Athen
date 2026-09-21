import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/SupabaseConnect'
import { CrudConsole } from './pages/CrudConsole'
import { HomePage } from './pages/HomePage'
import {LoginPage} from './pages/LoginPage';

export default function Hub() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/crud" element={<ProtectedRoute><CrudConsole /></ProtectedRoute>} />
        <Route path="/LoginPage" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  )
}